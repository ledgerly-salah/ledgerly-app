import {createSessionScope} from '../releases/20261019-readiness-r16/session.3.1.1.js';
import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {IDBFactory,IDBObjectStore,indexedDB} from 'fake-indexeddb';import {JSDOM} from 'jsdom';
import * as c from '../releases/20261019-readiness-r16/ledger-core.3.1.0.js';import * as k from '../releases/20261019-readiness-r16/crypto.3.1.0.js';import * as store from '../releases/20261019-readiness-r16/storage.3.1.0.js';
import {migrateLegacyState} from '../releases/20261019-readiness-r16/migrations.3.1.0.js';
import {buildLedgerReportPdf} from '../releases/20261019-readiness-r16/pdf-report-v2.3.1.1.js';import {pdfText} from '../releases/20261019-readiness-r16/pdf-unicode.3.1.1.js';
globalThis.indexedDB=indexedDB;globalThis.BroadcastChannel=undefined;globalThis.localStorage={getItem:()=>null};
function fixture(){const s=c.newEmptyState();s.creditors=[{id:'c',name:'Synthetic'}];return s;}
function tx(id,type,n,extra={}){return {...c.txBase({creditorId:'c',type,amountHalalas:n,effectiveDate:'2026-10-01'}),id,...extra};}
function amount(state){return c.overallSummary(state).remaining;}
const appSource=fs.readFileSync(new URL('../releases/20261019-readiness-r16/app.3.1.0.js',import.meta.url),'utf8');
const reportSource=fs.readFileSync(new URL('../releases/20261019-readiness-r16/report-tools.3.1.1.js',import.meta.url),'utf8');
function appContext(){const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.invalid/ledgerly-app/'});const w=dom.window;const sessionScope=createSessionScope(w);const ctx={atob,btoa,captureSession:owner=>sessionScope.capture(owner),structuredClone,...c,...k,...store,BUILD_ID:'TEST',window:w,document:w.document,history:w.history,location:w.location,navigator:w.navigator,Event:w.Event,File:w.File,FormData:w.FormData,HTMLElement:w.HTMLElement,HTMLFormElement:w.HTMLFormElement,MutationObserver:w.MutationObserver,localStorage:w.localStorage,matchMedia:()=>({matches:true,addEventListener(){}}),requestAnimationFrame:()=>{},setTimeout:()=>0,clearTimeout(){},console,crypto:globalThis.crypto,CSS:{escape:v=>v},setLanguage(){},t:v=>v,Blob,URL};vm.createContext(ctx);vm.runInContext(appSource.replaceAll('import.meta.url',JSON.stringify('https://example.invalid/ledgerly-app/releases/20261019-readiness-r16/app.3.1.0.js')).replace(/^import[\s\S]*?;\n/gm,'').replace(/bootstrap\(\)\.catch\(err=>setSafeMode\('Ledgerly could not start safely\.',err\)\);/,''),ctx);vm.runInContext('render=()=>{};',ctx);return {ctx,dom,run:code=>vm.runInContext(code,ctx)};}
async function resetStore(){await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('ledgerly.production.v3');r.onsuccess=resolve;r.onerror=()=>reject(r.error);});}
async function saveFixture(s,{key=null,security=null,files=[]}={}){await resetStore();return store.saveStateRecord(key?{encrypted:true,revision:1,envelope:await k.encryptJson(s,key),security}:{encrypted:false,revision:1,payload:s},{attachments:files,validationState:s});}
function makeForm(t,fields,id='testForm'){const form=t.dom.window.document.createElement('form');form.id=id;for(const [name,value] of Object.entries(fields)){const el=t.dom.window.document.createElement('input');el.name=name;el.value=value;form.append(el);}t.dom.window.document.getElementById('modal').append(form);t.ctx.testForm=form;return form;}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r));

async function encryptedFixture(){const sec=await k.createSecurity('synthetic-password',{withRecovery:false}),s=fixture();s.evidence={};const r=await saveFixture(s,{key:sec.dek,security:sec.security});const t=appContext();Object.assign(t.ctx,{fixture:s,fixtureRecord:r,key:sec.dek,sec:sec.security});t.run('state=fixture;record=fixtureRecord;dek=key;security=sec;');return {t,s,r,sec};}

test('P01 restore atomically resets backup metadata and does not perform a post-commit metadata write',async()=>{
 const {t,s,sec}=await encryptedFixture();const imported=c.deepClone(s);imported.transactions=[tx('new','debt',7500)];
 await store.setMeta('backup',{at:'old',revision:1});Object.assign(t.ctx,{imported,notices:[]});
 t.run("ui.modal={ctx:{state:imported,dek:null,obj:{createdAt:'2026-10-19',attachments:[]}}};toast=(...args)=>notices.push(args);setMeta=async()=>{throw new Error('Unexpected separate metadata write')};applyRestore();");
 const form=t.ctx.document.getElementById('authorizeForm');form.elements.password.value='synthetic-password';t.ctx.form=form;await t.run('submitAuthorization(form)');
 const saved=await store.getStateRecord();assert.equal(saved.revision,2);assert.equal(c.overallSummary(await k.decryptJson(saved.envelope,sec.dek)).remaining,7500);
 assert.equal(t.ctx.notices.at(-1)[0],'Restore complete');assert.deepEqual((await store.getMeta('backup')).value,{at:null,revision:null});
});
test('P01 metadata transaction failure rolls back ledger, attachments and snapshot',async()=>{
 const {t,s,sec}=await encryptedFixture();const imported=c.deepClone(s);imported.transactions=[tx('new','debt',7500)];
 await store.setMeta('backup',{at:'old',revision:1});Object.assign(t.ctx,{imported,notices:[]});
 t.run("ui.modal={ctx:{state:imported,dek:null,obj:{createdAt:'2026-10-19',attachments:[]}}};toast=(...args)=>notices.push(args);applyRestore();");
 const form=t.ctx.document.getElementById('authorizeForm');form.elements.password.value='synthetic-password';t.ctx.form=form;
 const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='meta')throw new Error('Injected metadata quota failure');return put.apply(this,args)};
 try{await t.run('submitAuthorization(form)');}finally{IDBObjectStore.prototype.put=put;}
 const saved=await store.getStateRecord();assert.equal(saved.revision,1);assert.equal(c.overallSummary(await k.decryptJson(saved.envelope,sec.dek)).remaining,0);assert.equal((await store.listSnapshots()).length,0);
 assert.equal(t.ctx.notices.at(-1)[0],'Operation not saved');assert.deepEqual((await store.getMeta('backup')).value,{at:'old',revision:1});
});
for(const legacy of [false,true])test('P02 delayed '+(legacy?'encrypted migration':'fresh initialization')+' cannot replace another tab ledger',async()=>{
 await resetStore();const t=appContext(),gate=deferred(),entered=deferred();Object.assign(t.ctx,{gate,entered,realSave:store.saveStateRecord,legacyState:fixture()});
 t.run("setupStaticEvents=()=>{};setupServiceWorker=()=>{};updateConnectivity=()=>{};requestPersistentStorage=async()=>({});storageEstimate=async()=>({});detectLegacy=()=>null;recoverLegacyMirror=async()=>null;showProtectionSetup=()=>{};saveStateRecord=async(...args)=>{entered.resolve();await gate.promise;return realSave(...args)};");
 if(legacy)t.run("legacyContext={type:'encrypted',envelope:{}};decryptAndMigrateLegacy=async()=>legacyState;");
 const boot=t.run(legacy?"unlockCurrent('synthetic-password')":'bootstrap()');const settled=boot.catch(e=>e);await entered.promise;
 const s=fixture();s.transactions=[tx('existing','debt',10000)];const sec=await k.createSecurity('synthetic-password',{withRecovery:false});
 const before=await store.saveStateRecord({revision:2,encrypted:true,envelope:await k.encryptJson(s,sec.dek),security:sec.security});gate.resolve();await settled;
 const saved=await store.getStateRecord();assert.deepEqual(saved,before);assert.equal(c.overallSummary(await k.decryptJson(saved.envelope,sec.dek)).remaining,10000);assert.equal(t.run('state'),null);assert.equal(t.ctx.document.getElementById('safeScreen').hidden,false);
});
test('P02 expected revision zero allows only one initial writer',async()=>{
 await resetStore();const s=fixture();const results=await Promise.allSettled([1,2].map(()=>store.saveStateRecord({revision:1,encrypted:false,payload:s},{expectedRevision:0})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.name,'RevisionConflictError');
});
for(const method of ['estimate','persisted'])test('Storage telemetry cannot indefinitely block startup/settings: '+method,async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{estimate:async()=>({usage:123,quota:456}),persisted:async()=>false,[method]:()=>new Promise(()=>{})}}});
 try{const result=await Promise.race([store.storageEstimate({timeoutMs:5}),new Promise(r=>setTimeout(()=>r('blocked'),100))]);assert.notEqual(result,'blocked');assert.equal(result.usage,0);}
 finally{Object.defineProperty(globalThis,'navigator',descriptor);}
});

test('Blocked IndexedDB upgrade fails explicitly and a later attempt recovers',async()=>{
 const previous=globalThis.indexedDB;globalThis.indexedDB=new IDBFactory();let old;
 try{
  old=await new Promise((resolve,reject)=>{const r=globalThis.indexedDB.open('ledgerly.production.v3',3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const result=await Promise.race([store.openDb().then(db=>{db.close();return 'opened'},e=>e.message),new Promise(r=>setTimeout(()=>r('blocked forever'),100))]);
  assert.match(result,/another tab/i);old.close();old=null;await new Promise(r=>setTimeout(r,20));const db=await store.openDb();assert.equal(db.version,4);db.close();
 }finally{old?.close();globalThis.indexedDB=previous;}
});
test('Open database connection releases itself for a later schema upgrade',async()=>{
 const previous=globalThis.indexedDB;globalThis.indexedDB=new IDBFactory();let db;
 try{db=await store.openDb();const result=await new Promise((resolve,reject)=>{const r=globalThis.indexedDB.open('ledgerly.production.v3',5);r.onsuccess=()=>{r.result.close();resolve('upgraded')};r.onblocked=()=>resolve('blocked');r.onerror=()=>reject(r.error)});assert.equal(result,'upgraded');}
 finally{db?.close();globalThis.indexedDB=previous;}
});
test('Debt form delayed draft callback respects a field already focused',async()=>{
 const {t}=await encryptedFixture(),timers=[];t.ctx.setTimeout=(fn,ms)=>{timers.push({fn,ms});return 0;};
 t.run("openAddDebtModal();getDraft=async()=>null;");const field=t.ctx.document.querySelector('[name=newCreditor]');field.focus();
 for(const timer of timers.filter(x=>x.ms===30))await timer.fn();
 assert.equal(t.ctx.document.activeElement,field);assert.equal(field.form.dataset.userInteracted,'1');
});
test('Restored data remains a success when optional installation marker is unavailable',async()=>{
 const {t,s}=await encryptedFixture();t.ctx.imported=c.deepClone(s);t.ctx.notices=[];
 t.run("ui.modal={ctx:{state:imported,dek:null,obj:{createdAt:'2026-10-19',attachments:[]}}};toast=(...args)=>notices.push(args);applyRestore();");
 const form=t.ctx.document.getElementById('authorizeForm');form.elements.password.value='synthetic-password';t.ctx.form=form;t.ctx.localStorage={setItem(){throw new Error('Blocked localStorage')}};
 await t.run('submitAuthorization(form)');assert.equal((await store.getStateRecord()).revision,2);assert.equal(t.ctx.notices.at(-1)[0],'Restore complete');assert.ok(t.ctx.notices.some(x=>x[0]==='Storage notice'));
});
