import {createSessionScope} from '../releases/20261014-coverage-r11/session.3.1.1.js';
import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {indexedDB} from 'fake-indexeddb';import {JSDOM} from 'jsdom';
import * as c from '../releases/20261014-coverage-r11/ledger-core.3.1.0.js';import * as k from '../releases/20261014-coverage-r11/crypto.3.1.0.js';import * as store from '../releases/20261014-coverage-r11/storage.3.1.0.js';
import {migrateLegacyState} from '../releases/20261014-coverage-r11/migrations.3.1.0.js';
import {buildLedgerReportPdf} from '../releases/20261014-coverage-r11/pdf-report-v2.3.1.1.js';import {pdfText} from '../releases/20261014-coverage-r11/pdf-unicode.3.1.1.js';
globalThis.indexedDB=indexedDB;globalThis.BroadcastChannel=undefined;globalThis.localStorage={getItem:()=>null};
function fixture(){const s=c.newEmptyState();s.creditors=[{id:'c',name:'Synthetic'}];return s;}
function tx(id,type,n,extra={}){return {...c.txBase({creditorId:'c',type,amountHalalas:n,effectiveDate:'2026-10-01'}),id,...extra};}
function amount(state){return c.overallSummary(state).remaining;}
const appSource=fs.readFileSync(new URL('../releases/20261014-coverage-r11/app.3.1.0.js',import.meta.url),'utf8');
const reportSource=fs.readFileSync(new URL('../releases/20261014-coverage-r11/report-tools.3.1.1.js',import.meta.url),'utf8');
function appContext(){const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://example.invalid/ledgerly-app/'});const w=dom.window;const sessionScope=createSessionScope(w);const ctx={atob,btoa,captureSession:owner=>sessionScope.capture(owner),structuredClone,...c,...k,...store,BUILD_ID:'TEST',window:w,document:w.document,history:w.history,location:w.location,navigator:w.navigator,Event:w.Event,File:w.File,FormData:w.FormData,HTMLElement:w.HTMLElement,HTMLFormElement:w.HTMLFormElement,MutationObserver:w.MutationObserver,localStorage:w.localStorage,matchMedia:()=>({matches:true,addEventListener(){}}),requestAnimationFrame:()=>{},setTimeout:()=>0,clearTimeout(){},console,crypto:globalThis.crypto,CSS:{escape:v=>v},setLanguage(){},t:v=>v,Blob,URL};vm.createContext(ctx);vm.runInContext(appSource.replaceAll('import.meta.url',JSON.stringify('https://example.invalid/ledgerly-app/releases/20261014-coverage-r11/app.3.1.0.js')).replace(/^import[\s\S]*?;\n/gm,'').replace(/bootstrap\(\)\.catch\(err=>setSafeMode\('Ledgerly could not start safely\.',err\)\);/,''),ctx);vm.runInContext('render=()=>{};',ctx);return {ctx,dom,run:code=>vm.runInContext(code,ctx)};}
async function resetStore(){await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('ledgerly.production.v3');r.onsuccess=resolve;r.onerror=()=>reject(r.error);});}
async function saveFixture(s,{key=null,security=null,files=[]}={}){await resetStore();return store.saveStateRecord(key?{encrypted:true,revision:1,envelope:await k.encryptJson(s,key),security}:{encrypted:false,revision:1,payload:s},{attachments:files,validationState:s});}
function makeForm(t,fields,id='testForm'){const form=t.dom.window.document.createElement('form');form.id=id;for(const [name,value] of Object.entries(fields)){const el=t.dom.window.document.createElement('input');el.name=name;el.value=value;form.append(el);}t.dom.window.document.getElementById('modal').append(form);t.ctx.testForm=form;return form;}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r));

async function encryptedFixture(){const sec=await k.createSecurity('synthetic-password',{withRecovery:false}),s=fixture();s.evidence={};const r=await saveFixture(s,{key:sec.dek,security:sec.security});const t=appContext();Object.assign(t.ctx,{fixture:s,fixtureRecord:r,key:sec.dek,sec:sec.security});t.run('state=fixture;record=fixtureRecord;dek=key;security=sec;');return {t,s,r,sec};}
test('A01 onboarding never replaces an unacknowledged recovery key',async()=>{
 const {t,s}=await encryptedFixture();s.creditors=[];t.run("showRecoveryKey('synthetic-recovery-key');maybeOnboard()");assert.match(t.ctx.document.querySelector('.recovery-code').textContent.replace(/\s/g,''),/synthetic-recovery-key/);assert.equal(t.run('ui.modal.type'),'recoveryKey');
});
test('A04 deferred programmatic back preserves a newer dialog; real back closes it',async()=>{
 const {t}=await encryptedFixture();t.run('revisionChannel=()=>{};setupStaticEvents()');t.dom.window.history.back=()=>{};t.run("openAddDebtModal('c');closeModal();openAddDebtModal()");const form=t.ctx.document.getElementById('modal').firstElementChild;t.dom.window.dispatchEvent(new t.dom.window.PopStateEvent('popstate'));assert.equal(form.isConnected,true);assert.equal(t.ctx.document.getElementById('modalBackdrop').hidden,false);t.dom.window.dispatchEvent(new t.dom.window.PopStateEvent('popstate'));assert.equal(t.ctx.document.getElementById('modalBackdrop').hidden,true);
});
test('A06 password change does not navigate back before presenting the new recovery key',async()=>{
 const {t,s,sec}=await encryptedFixture();sec.security.recovery={};t.ctx.sec=sec.security;t.run('security=sec;openChangePassword()');const form=t.ctx.document.getElementById('changePasswordForm');form.elements.old.value='synthetic-password';form.elements.new.value='new-synthetic-password';form.elements.confirm.value='new-synthetic-password';t.ctx.form=form;let backCalls=0;t.dom.window.history.back=()=>backCalls++;await t.run('changePasswordSubmit(form)');assert.equal(backCalls,0);assert.ok(t.ctx.document.querySelector('.recovery-code'));assert.equal((await k.unlockSecurity((await store.getStateRecord()).security,'new-synthetic-password')).type,'secret');
});
test('A07 all newer broadcast revisions are observed immediately after a local write',async()=>{
 const {t}=await encryptedFixture();t.run('let incoming;let reloads=0;revisionChannel=callback=>incoming=callback;reloadFromStorage=async()=>{reloads++;};setupStaticEvents();lastWriteAt=Date.now();');await t.run("incoming({type:'revision',revision:record.revision+1})");assert.equal(t.run('reloads'),1);await t.run("incoming({type:'revision',revision:record.revision})");assert.equal(t.run('reloads'),1);
});
test('A08 delayed draft restore cannot overwrite text already entered by the user',async()=>{
 const {t}=await encryptedFixture();t.run("openAddDebtModal('c')");const form=t.ctx.document.getElementById('debtForm');t.ctx.form=form;const gate=deferred();t.ctx.gate=gate;t.run("getDraft=async()=>{await gate.promise;return {};};decodeDraft=async()=>({values:{amount:'10'}});");const job=t.run('restoreFormDraft(form)');form.elements.amount.value='123';form.elements.amount.dispatchEvent(new t.dom.window.Event('input',{bubbles:true}));gate.resolve();await job;assert.equal(form.elements.amount.value,'123');
});
test('A08 delayed initial focus cannot interrupt typing in another field',async()=>{
 const {t}=await encryptedFixture();t.run('let delayed=[];setTimeout=fn=>delayed.push(fn);getDraft=async()=>null;openAddDebtModal()');const input=t.ctx.document.querySelector('[name=newCreditor]');input.focus();input.value='New name';input.dispatchEvent(new t.dom.window.Event('input',{bubbles:true}));await t.run('delayed[0]()');assert.equal(t.ctx.document.activeElement,input);assert.equal(input.value,'New name');
});
