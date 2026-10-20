import {createSessionScope} from '../releases/20261019-readiness-r16/session.3.1.1.js';
import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {indexedDB} from 'fake-indexeddb';import {JSDOM} from 'jsdom';
import * as c from '../releases/20261019-readiness-r16/ledger-core.3.1.0.js';import * as k from '../releases/20261019-readiness-r16/crypto.3.1.0.js';import * as store from '../releases/20261019-readiness-r16/storage.3.1.0.js';
import {migrateLegacyState} from '../releases/20261019-readiness-r16/migrations.3.1.0.js';
import {buildLedgerReportPdf} from '../releases/20261019-readiness-r16/pdf-report-v2.3.1.1.js';import {pdfText} from '../releases/20261019-readiness-r16/pdf-unicode.3.1.1.js';
globalThis.indexedDB=indexedDB;globalThis.BroadcastChannel=undefined;globalThis.localStorage={getItem:()=>null};
function fixture(){const s=c.newEmptyState();s.creditors=[{id:'c',name:'Synthetic'}];return s;}
function tx(id,type,n,extra={}){return {...c.txBase({creditorId:'c',type,amountHalalas:n,effectiveDate:'2026-10-01'}),id,...extra};}
function amount(state){return c.overallSummary(state).remaining;}
const appSource=fs.readFileSync(new URL(`../releases/${process.env.LEDGERLY_APP_BASELINE||'20261019-readiness-r16'}/app.3.1.0.js`,import.meta.url),'utf8');
const reportSource=fs.readFileSync(new URL('../releases/20261019-readiness-r16/report-tools.3.1.1.js',import.meta.url),'utf8');
function appContext(){const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.invalid/ledgerly-app/'});const w=dom.window;const sessionScope=createSessionScope(w);const ctx={atob,btoa,captureSession:owner=>sessionScope.capture(owner),structuredClone,...c,...k,...store,BUILD_ID:'TEST',window:w,document:w.document,history:w.history,location:w.location,navigator:w.navigator,Event:w.Event,File:w.File,FormData:w.FormData,HTMLElement:w.HTMLElement,HTMLFormElement:w.HTMLFormElement,MutationObserver:w.MutationObserver,localStorage:w.localStorage,matchMedia:()=>({matches:true,addEventListener(){}}),requestAnimationFrame:()=>{},setTimeout:()=>0,clearTimeout(){},console,crypto:globalThis.crypto,CSS:{escape:v=>v},setLanguage(){},t:v=>v,Blob,URL};vm.createContext(ctx);vm.runInContext(appSource.replaceAll('import.meta.url',JSON.stringify('https://example.invalid/ledgerly-app/releases/20261019-readiness-r16/app.3.1.0.js')).replace(/^import[\s\S]*?;\n/gm,'').replace(/bootstrap\(\)\.catch\(err=>setSafeMode\('Ledgerly could not start safely\.',err\)\);/,''),ctx);vm.runInContext('render=()=>{};',ctx);return {ctx,dom,run:code=>vm.runInContext(code,ctx)};}
async function resetStore(){await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('ledgerly.production.v3');r.onsuccess=resolve;r.onerror=()=>reject(r.error);});}
async function saveFixture(s,{key=null,security=null,files=[]}={}){await resetStore();return store.saveStateRecord(key?{encrypted:true,revision:1,envelope:await k.encryptJson(s,key),security}:{encrypted:false,revision:1,payload:s},{attachments:files,validationState:s});}
function makeForm(t,fields,id='testForm'){const form=t.dom.window.document.createElement('form');form.id=id;for(const [name,value] of Object.entries(fields)){const el=t.dom.window.document.createElement('input');el.name=name;el.value=value;form.append(el);}t.dom.window.document.getElementById('modal').append(form);t.ctx.testForm=form;return form;}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r));

async function encryptedFixture(){const sec=await k.createSecurity('synthetic-password',{withRecovery:false}),s=fixture();s.evidence={};const r=await saveFixture(s,{key:sec.dek,security:sec.security});const t=appContext();Object.assign(t.ctx,{fixture:s,fixtureRecord:r,key:sec.dek,sec:sec.security});t.run('state=fixture;record=fixtureRecord;dek=key;security=sec;');return {t,s,r,sec};}

test('C01 every supported two-decimal amount round-trips without a changed halala',()=>{
 for(let n=9007199254740800n;n<=9007199254740991n;n++){
  const input=`${n/100n}.${String(n%100n).padStart(2,'0')}`;
  assert.equal(c.sarToHalalas(input),Number(n),input);
  assert.equal(c.formatNumber(Number(n)).replaceAll(',',''),input,input);
 }
 assert.equal(c.sarToHalalas('10.075'),1008);
 for(const input of ['0x10','1e3','1,2,3','12,34.56'])assert.ok(Number.isNaN(c.sarToHalalas(input)),input);
 assert.equal(c.sarToHalalas('١٬٢٣٤٫٥٦'),123456);
 assert.equal(c.sarToHalalas('1,25'),125);
});
test('C02 Cancel never submits creditor details or a move form',()=>{
 const t=appContext();t.ctx.fixture=fixture();t.ctx.fixture.transactions=[tx('d','debt',10000)];t.ctx.fixture.creditors.push({id:'other',name:'Other'});t.run('state=fixture;');
 for(const open of ["openCreditorDetails('c')","openMoveTx('d')"]){
  t.run(open);const form=t.ctx.document.querySelector('#modal form');let submitted=false;
  form.addEventListener('submit',e=>{e.preventDefault();submitted=true;});
  const reason=form.querySelector('[name=reason]');if(reason)reason.value='test';
  form.querySelector('[data-action=close-modal]').click();assert.equal(submitted,false,open);
 }
});
test('C03 correction preserves a yearly payment plan frequency',()=>{
 const t=appContext();t.ctx.fixture=fixture();t.ctx.fixture.transactions=[tx('d','debt',10000,{plan:{amountHalalas:1000,frequency:'Yearly'}})];t.run("state=fixture;openEditTx('d')");
 assert.equal(t.ctx.document.querySelector('[name=planFrequency]').value,'Yearly');
});
test('C04 invalid templates cannot be persisted into a healthy ledger',async()=>{
 for(const extra of [{amountHalalas:Infinity},{creditorId:'missing'},{nextDate:'2026-02-30'},{frequency:'Hourly'}]){
  const s=fixture();s.templates=[{id:'tp',name:'Bill',creditorId:'c',amountHalalas:100,frequency:'Monthly',nextDate:'2026-10-01',...extra}];
  assert.throws(()=>c.validateState(s),JSON.stringify(extra));
 }
});
test('C05 due-soon includes day 30 at local midnight in Riyadh',()=>{
 const previous=process.env.TZ;process.env.TZ='Asia/Riyadh';
 try{const t=appContext(),RealDate=Date;t.ctx.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-13T21:30:00Z']));}};
 const s=fixture();s.transactions=[tx('d','debt',10000,{dueDate:'2026-11-13'})];t.ctx.fixture=s;t.ctx.todayLocal=()=> '2026-10-14';t.run("state=fixture;ui.filter='Due soon'");assert.equal(t.run('visibleCreditorSummaries().length'),1);
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('C06 calendar export preserves arbitrary creditor text without injecting calendar fields',async()=>{
 const t=appContext();const s=fixture();s.creditors[0].name='عميل, طويل; \\ اختبار\nBEGIN:VEVENT\n'+ 'أ'.repeat(80);s.transactions=[tx('d','debt',10000,{dueDate:'2026-11-01'})];t.ctx.fixture=s;t.ctx.TextEncoder=TextEncoder;t.ctx.URL={createObjectURL:blob=>{t.ctx.output=blob;return 'blob:synthetic';},revokeObjectURL(){}};t.dom.window.HTMLAnchorElement.prototype.click=function(){};t.run('state=fixture;exportIcs()');
 const out=await t.run('output.text()');const unfolded=out.replace(/\r\n[ \t]/g,'');assert.equal(unfolded.split('\r\n').filter(l=>l==='BEGIN:VEVENT').length,1);assert.match(unfolded,/DTSTAMP:\d{8}T\d{6}Z/);assert.match(unfolded,/\\nBEGIN:VEVENT\\n/);assert.ok(out.split('\r\n').every(l=>Buffer.byteLength(l)<=75));
});
test('C07 filters, search, sorting and settings persist without changing balances',async()=>{
 const {t,s}=await encryptedFixture();s.transactions=[tx('d','debt',10000,{dueDate:'2020-01-01'})];s.creditors[0].aliases=['Previous Name'];s.creditors[0].tags=['Housing'];t.ctx.fixture=s;t.run('state=fixture;');
 for(const query of ['Previous','housing','Synthetic']){t.ctx.query=query;t.run('ui.search=query');assert.equal(t.run('visibleCreditorSummaries().length'),1);}
 t.run("ui.search='absent'");assert.equal(t.run('visibleCreditorSummaries().length'),0);
 t.run("ui.search='';ui.filter='Overdue'");assert.equal(t.run('visibleCreditorSummaries().length'),1);
 t.run("ui.filter='Paid'");assert.equal(t.run('visibleCreditorSummaries().length'),0);
 await t.run('openSettingsModal()');for(const [id,value] of [['settingsTheme','dark'],['settingsPrivacy','amounts'],['settingsAllocation','highest-priority'],['settingsAutoLock','5']])t.ctx.document.getElementById(id).value=value;
 await t.run('saveSettingsFromModal()');assert.equal(t.run('state.settings.autoLockMinutes'),5);assert.equal(t.run('state.settings.autoAllocation'),'highest-priority');assert.equal(t.run('overallSummary(state).remaining'),10000);
});
test('C08 deterministic mixed ledgers agree with an independent integer oracle',()=>{
 let seed=43;const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let sample=0;sample<1000;sample++){
  const s=fixture();let expected=0n;
  for(let i=0;i<15;i++){const value=1+rnd(100000);let type=expected>BigInt(value)?['debt','payment','waiver','adjustment'][rnd(4)]:'debt';const direction=rnd(2)?'increase':'decrease';const reduction=['payment','waiver'].includes(type)||(type==='adjustment'&&direction==='decrease');const t=tx('x'+i,type,value,{adjustmentDirection:direction});s.transactions.push(t);expected+=BigInt(value)*(reduction?-1n:1n);
   if(type!=='debt'&&rnd(5)===0){s.transactions.push(tx('r'+i,'reversal',value,{reversedTransactionId:t.id}));expected-=BigInt(value)*(reduction?-1n:1n);}
  }
  c.validateState(s);assert.equal(c.overallSummary(s).remaining,Number(expected));assert.equal(c.categoryBalances(s).reduce((n,x)=>n+x.remaining,0),Number(expected));
 }
});
test('C09 text fields render as text and never create active markup',()=>{
 const t=appContext();const s=fixture();s.creditors[0].name='<img src=x onerror=alert(1)>';s.creditors[0].notes='</textarea><script>throw 1</script>';s.transactions=[tx('d','debt',10000,{description:'<svg onload=alert(1)>'})];t.ctx.fixture=s;t.run("state=fixture;openCreditorDetails('c')");assert.equal(t.ctx.document.querySelectorAll('#modal script,#modal img,#modal svg').length,0);assert.equal(t.ctx.document.querySelector('[name=notes]').value,s.creditors[0].notes);t.run("openStatement('c')");assert.equal(t.ctx.document.querySelectorAll('#modal script,#modal img,#modal svg').length,0);assert.match(t.ctx.document.querySelector('#modal').textContent,/<svg onload=/);
});
test('C10 all ordinary cent values and Arabic input retain the exact integer amount',()=>{
 for(let n=0;n<100000;n++){const input=`${Math.floor(n/100)}.${String(n%100).padStart(2,'0')}`;assert.equal(c.sarToHalalas(input),n);assert.equal(c.sarToHalalas(c.formatNumber(n)),n);}
 for(const [input,expected] of [['١٢٣٫٤٥',12345],['۱۲۳٫۴۵',12345],['1,234,567.89',123456789],['90071992547409.92',NaN],['-0.005',-1]])assert.equal(c.sarToHalalas(input),expected);
});
