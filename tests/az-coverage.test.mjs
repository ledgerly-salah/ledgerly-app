import {createSessionScope} from '../releases/20261016-contrast-r12/session.3.1.1.js';
import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {indexedDB} from 'fake-indexeddb';import {JSDOM} from 'jsdom';
import * as c from '../releases/20261016-contrast-r12/ledger-core.3.1.0.js';import * as k from '../releases/20261016-contrast-r12/crypto.3.1.0.js';import * as store from '../releases/20261016-contrast-r12/storage.3.1.0.js';
import {migrateLegacyState, detectLegacy, recoverLegacyMirror, decryptAndMigrateLegacy, cleanupLegacyKeys} from '../releases/20261016-contrast-r12/migrations.3.1.0.js';
import {buildLedgerReportPdf} from '../releases/20261016-contrast-r12/pdf-report-v2.3.1.1.js';import {pdfText} from '../releases/20261016-contrast-r12/pdf-unicode.3.1.1.js';
globalThis.indexedDB=indexedDB;globalThis.BroadcastChannel=undefined;globalThis.localStorage={getItem:()=>null};
function fixture(){const s=c.newEmptyState();s.creditors=[{id:'c',name:'Synthetic'}];return s;}
function tx(id,type,n,extra={}){return {...c.txBase({creditorId:'c',type,amountHalalas:n,effectiveDate:'2026-10-01'}),id,...extra};}
function amount(state){return c.overallSummary(state).remaining;}
const appSource=fs.readFileSync(new URL(`../releases/${process.env.LEDGERLY_APP_BASELINE||'20261016-contrast-r12'}/app.3.1.0.js`,import.meta.url),'utf8');
const reportSource=fs.readFileSync(new URL('../releases/20261016-contrast-r12/report-tools.3.1.1.js',import.meta.url),'utf8');
function appContext(){const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.invalid/ledgerly-app/'});const w=dom.window;const sessionScope=createSessionScope(w);const ctx={atob,btoa,captureSession:owner=>sessionScope.capture(owner),structuredClone,...c,...k,...store,BUILD_ID:'TEST',window:w,document:w.document,history:w.history,location:w.location,navigator:w.navigator,Event:w.Event,File:w.File,FormData:w.FormData,HTMLElement:w.HTMLElement,HTMLFormElement:w.HTMLFormElement,MutationObserver:w.MutationObserver,localStorage:w.localStorage,matchMedia:()=>({matches:true,addEventListener(){}}),requestAnimationFrame:()=>{},setTimeout:()=>0,clearTimeout(){},console,crypto:globalThis.crypto,CSS:{escape:v=>v},setLanguage(){},t:v=>v,Blob,URL};vm.createContext(ctx);vm.runInContext(appSource.replaceAll('import.meta.url',JSON.stringify('https://example.invalid/ledgerly-app/releases/20261016-contrast-r12/app.3.1.0.js')).replace(/^import[\s\S]*?;\n/gm,'').replace(/bootstrap\(\)\.catch\(err=>setSafeMode\('Ledgerly could not start safely\.',err\)\);/,''),ctx);vm.runInContext('render=()=>{};',ctx);return {ctx,dom,run:code=>vm.runInContext(code,ctx)};}
async function resetStore(){await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('ledgerly.production.v3');r.onsuccess=resolve;r.onerror=()=>reject(r.error);});}
async function saveFixture(s,{key=null,security=null,files=[]}={}){await resetStore();return store.saveStateRecord(key?{encrypted:true,revision:1,envelope:await k.encryptJson(s,key),security}:{encrypted:false,revision:1,payload:s},{attachments:files,validationState:s});}
function makeForm(t,fields,id='testForm'){const form=t.dom.window.document.createElement('form');form.id=id;for(const [name,value] of Object.entries(fields)){const el=t.dom.window.document.createElement('input');el.name=name;el.value=value;form.append(el);}t.dom.window.document.getElementById('modal').append(form);t.ctx.testForm=form;return form;}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r));

async function encryptedFixture(){const sec=await k.createSecurity('synthetic-password',{withRecovery:false}),s=fixture();s.evidence={};const r=await saveFixture(s,{key:sec.dek,security:sec.security});const t=appContext();Object.assign(t.ctx,{fixture:s,fixtureRecord:r,key:sec.dek,sec:sec.security});t.run('state=fixture;record=fixtureRecord;dek=key;security=sec;');return {t,s,r,sec};}


test('ZC01 notes-only payment correction preserves explicit allocation, method and evidence',async()=>{
 const {t,s}=await encryptedFixture();s.transactions=[tx('d1','debt',10000),tx('d2','debt',10000),tx('p','payment',2500,{allocations:[{debtId:'d2',amountHalalas:2500}],allocationMode:'specific',method:'Bank',reference:'REF'})];t.ctx.fixture=s;t.run('state=fixture;');
 const before=structuredClone(s.transactions[2]);t.ctx.payload={...before,txId:'p',amount:2500,notes:'Notes changed',reason:'Notes correction',verified:'on'};await t.run('applyEditTx(payload)');const after=t.run("state.transactions.find(x=>x.id==='p')");assert.deepEqual(JSON.parse(JSON.stringify(after.allocations)),before.allocations);assert.equal(after.allocationMode,'specific');
});
test('ZC02 legacy migration never silently drops orphan debt or payment',()=>{
 for(const type of ['debts','payments']){const legacy={creditors:[{id:'c',name:'Synthetic'}],debts:[],payments:[]};legacy[type].push({id:'lost',creditorId:'missing',amount:100});assert.throws(()=>migrateLegacyState(legacy),/creditor|orphan|missing/i);}
});
test('ZC03 all allocation strategies and explicit debt choices conserve reductions',()=>{
 const s=fixture();s.transactions=[tx('low','debt',5000,{priority:'Low',dueDate:'2026-11-01'}),tx('high','debt',10000,{priority:'High',dueDate:'2026-12-01'}),tx('small','debt',2000,{priority:'Medium',dueDate:'2026-10-20'})];
 for(const [strategy,preferred,first] of [['oldest-first','','small'],['smallest-balance','','small'],['highest-priority','','high'],['oldest-first','low','low']]){const out=c.allocateReduction(s,'c',12000,strategy,preferred,'2026-10-02');assert.equal(out.allocations[0].debtId,first);assert.equal(out.allocations.reduce((n,a)=>n+a.amountHalalas,0)+out.unallocated,12000);}
 const out=c.allocateReduction(s,'c',20000);assert.equal(out.unallocated,3000);assert.equal(c.allocateReduction(s,'c',1000,'oldest-first','','2026-09-01').allocations.length,0);
});
test('ZC04 historical monthly balances and plan estimates do not mutate ledger',()=>{
 const s=fixture();s.transactions=[tx('d','debt',10000,{plan:{amountHalalas:1000,frequency:'Monthly'}}),tx('p','payment',2500,{effectiveDate:'2026-10-02'})];const before=JSON.stringify(s);const history=c.monthlyHistory(s,24);assert.equal(history.length,24);assert.ok(history.every(x=>x.liability-x.paid===x.remaining-x.advance));assert.equal(c.paymentPlanEstimate(s,'c').cycles,8);assert.equal(JSON.stringify(s),before);
 for(const frequency of ['Weekly','Quarterly','Yearly']){s.transactions[0].plan.frequency=frequency;assert.ok(c.paymentPlanEstimate(s,'c').cycles>0);}s.transactions[0].plan.amountHalalas=0;assert.equal(c.paymentPlanEstimate(s,'c'),null);
});
test('ZC05 invalid structural and monetary inputs fail closed',()=>{
 for(const mutate of [s=>s.schemaVersion=999,s=>s.meta.currency='USD',s=>s.creditors.push({...s.creditors[0]}),s=>s.transactions.push(tx('bad','bogus',100)),s=>s.transactions.push(tx('bad','debt',-1)),s=>s.transactions.push(tx('bad','debt',100,{effectiveDate:'2026-02-30'})),s=>s.transactions.push(tx('bad','adjustment',100,{adjustmentDirection:'invalid'})),s=>s.transactions.push(tx('bad','reversal',100,{reversedTransactionId:'missing'}))]){const s=fixture();mutate(s);assert.throws(()=>c.validateState(s));}
 for(const input of ['',null,'NaN','Infinity','--1','1.2.3','90071992547409.92'])assert.ok(Number.isNaN(c.sarToHalalas(input)));
});
test('ZC06 legacy detection, cleanup and authenticated migration',async()=>{
 const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const old={creditors:[{id:'c',name:'Synthetic'}],debts:[{id:'d',creditorId:'c',amount:100,createdAt:'2026-01-01'}],payments:[{id:'p',creditorId:'c',amount:25,dateTime:'2026-01-02'}]};map.set('ledgerly.debt-dashboard.v1',JSON.stringify(old));assert.equal(detectLegacy().type,'plain');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode('old-password'),'PBKDF2',false,['deriveKey']);const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt']);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(old)));const envelope={salt:Buffer.from(salt).toString('base64'),iv:Buffer.from(iv).toString('base64'),data:Buffer.from(encrypted).toString('base64')};map.set('ledgerly.secure.v1',JSON.stringify(envelope));assert.equal(detectLegacy().type,'encrypted');await assert.rejects(decryptAndMigrateLegacy(envelope,'wrong'));const migrated=await decryptAndMigrateLegacy(envelope,'old-password');c.validateState(migrated);assert.equal(c.overallSummary(migrated).remaining,7500);cleanupLegacyKeys();assert.equal(detectLegacy(),null);assert.equal(await recoverLegacyMirror(),null);
});
test('ZC07 metadata, draft deletion, snapshot pruning and storage fallbacks',async()=>{
 await resetStore();await store.setMeta('synthetic',{value:1});assert.equal((await store.getMeta('synthetic')).value.value,1);await store.saveDraft({id:'draft',payload:{text:'x'}});assert.equal((await store.getDraft('draft')).payload.text,'x');await store.deleteDraft('draft');assert.equal(await store.getDraft('draft'),null);await store.saveDraft({id:'another'});await store.clearDrafts();assert.equal(await store.getDraft('another'),null);
 const s=fixture(),r={encrypted:false,revision:1,payload:s};await store.saveStateRecord(r);for(let i=0;i<4;i++)await store.createManualSnapshot(r,'synthetic '+i);await store.pruneSnapshots(2);assert.equal((await store.listSnapshots()).length,2);await store.clearSnapshots();assert.equal((await store.listSnapshots()).length,0);assert.ok(await store.storageEstimate());assert.ok(await store.requestPersistentStorage());
});
test('ZC08 date boundaries and duplicate-window behavior',()=>{
 for(const [value,expected] of [['2024-02-29','2024-02-29'],['2026-02-29',''],['2026-13-01',''],['2026-04-31','']])assert.equal(c.safeDate(value),expected);
 const s=fixture();s.transactions=[tx('d','debt',10000)];assert.equal(c.duplicateCandidates(s,'c','debt',10000,'2026-10-03').length,1);assert.equal(c.duplicateCandidates(s,'c','debt',10000,'2026-10-04').length,0);assert.equal(c.duplicateCandidates(s,'c','payment',10000,'2026-10-01').length,0);
});
test('ZC09 invalid optional plan amount is rejected instead of silently removed',async()=>{
 const {t,s}=await encryptedFixture();s.transactions=[tx('d','debt',10000,{plan:{amountHalalas:1000,frequency:'Monthly'}})];t.ctx.fixture=s;t.run("state=fixture;openEditTx('d')");const form=t.ctx.document.querySelector('#editTxForm');form.elements.planAmount.value='not-money';form.elements.reason.value='Change plan';t.ctx.testForm=form;await t.run('prepareEditTx(testForm)');assert.equal(t.ctx.document.querySelector('#authorizeForm'),null);assert.match(t.ctx.document.querySelector('#toastStack').textContent,/plan/i);
});
test('ZC10 financial payment correction still reallocates when amount changes',async()=>{
 const {t,s}=await encryptedFixture();s.transactions=[tx('d','debt',10000),tx('p','payment',2500,{allocations:[{debtId:'d',amountHalalas:2500}]})];t.ctx.fixture=s;t.run('state=fixture');t.ctx.payload={txId:'p',amount:3000,effectiveDate:'2026-10-01',reason:'Correct amount'};await t.run('applyEditTx(payload)');assert.equal(t.run('overallSummary(state).remaining'),7000);assert.equal(t.run("state.transactions[1].allocations[0].amountHalalas"),3000);
});
test('ZC11 migration rejects malformed creditor identities and nonpositive legacy amounts',()=>{
 for(const old of [{creditors:[{name:'No ID'}],debts:[{amount:1}],payments:[]},{creditors:[{id:'c',name:'Synthetic'}],debts:[{creditorId:'c',amount:-1}],payments:[]}])assert.throws(()=>migrateLegacyState(old));
});
test('ZC12 thousand-record ledger reconciles and formats within a bounded run',()=>{
 const s=c.newEmptyState();for(let i=0;i<20;i++)s.creditors.push({id:'c'+i,name:'Synthetic '+i});for(let i=0;i<1000;i++)s.transactions.push(tx('t'+i,i%2?'payment':'debt',i%2?25:100,{creditorId:'c'+Math.floor(i/50)}));const start=performance.now();c.validateState(s);assert.equal(c.overallSummary(s).remaining,37500);assert.equal(c.categoryBalances(s).reduce((n,x)=>n+x.remaining,0),37500);const ms=performance.now()-start;console.log('1000-record validation and summaries milliseconds:',Math.round(ms));assert.ok(ms<10000,'Ten-second bounded synthetic performance check');
});
