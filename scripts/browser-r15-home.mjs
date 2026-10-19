// Synthetic isolated profiles only. Serves the exact checked-out production files.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));try{res.setHeader('Content-Type',(f.endsWith('.js')||f.endsWith('.mjs'))?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.png')?'image/png':f.endsWith('.json')?'application/json':'application/octet-stream');let bytes=fs.readFileSync(f);if(process.env.LEDGERLY_A11Y_PATCH&&f.endsWith('index.html'))bytes=Buffer.from(bytes.toString().replace('</head>','<link rel="stylesheet" href="/validation/az-review/contrast-candidate.css"></head>'));res.end(bytes);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(8768,'127.0.0.1',r));
const engines=await import(process.env.LEDGERLY_PLAYWRIGHT_MODULE||'playwright');const engine=process.env.LEDGERLY_ENGINE||'chromium';
const b=await engines[engine].launch({...(engine==='chromium'?{executablePath:process.env.LEDGERLY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{}),headless:true});
const results=[];const observed=[];const coverage=[];const password='synthetic-password';
const file={name:'proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8AARGDiPwMAHfAD/aAzCYkAAAAASUVORK5CYII=','base64')};
async function test(name,fn){if(process.env.LEDGERLY_CASE&&!name.includes(process.env.LEDGERLY_CASE))return;const context=await b.newContext({viewport:{width:1440,height:900}});const p=await context.newPage();p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.addInitScript(()=>{window.azActions=[];document.addEventListener('click',e=>{const b=e.target.closest('[data-action],button[id]');if(b)window.azActions.push(b.dataset.action||'#'+b.id)},true);document.addEventListener('submit',e=>window.azActions.push('submit:'+e.target.id),true);});await p.coverage.startJSCoverage({resetOnNavigation:false});await p.goto('http://127.0.0.1:8768/');await p.evaluate(()=>{window.acceptanceToasts=[];new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1)window.acceptanceToasts.push(n.textContent);}).observe(document.querySelector('#toastStack'),{childList:true});});await fn(p);assert.deepEqual(errors,[]);results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.stack,modal:await p.locator('#modal').innerText(),toasts:await p.evaluate(()=>window.acceptanceToasts),form:await p.locator('#debtForm').evaluateAll(forms=>forms.map(f=>({dataset:{...f.dataset},name:f.elements.newCreditor?.value,amount:f.elements.amount?.value,files:f.elements.attachment?.files.length,passwordLength:f.querySelector('input[type=password]')?.value.length,valid:f.checkValidity()}))),errors});console.log('FAIL',name,e.message);}finally{observed.push(...await p.evaluate(()=>window.azActions||[]));coverage.push(...await p.coverage.stopJSCoverage());await context.close();}}
async function setup(p,recovery=false){await p.locator('#setupPassword').fill(password);await p.locator('#mandatorySecurityForm [name=confirm]').fill(password);if(!recovery)await p.locator('#mandatorySecurityForm [name=recovery]').uncheck();await p.locator('#mandatorySecurityForm button[type=submit]').click();if(!recovery){await p.locator('[data-action=finish-onboarding]').click();await p.locator('#modalBackdrop').waitFor({state:'hidden'});}}
async function close(p){await p.locator('#modal .modal-close').click();await p.locator('#modalBackdrop').waitFor({state:'hidden'});await p.waitForTimeout(100);}
async function settings(p,action){await p.locator('#settingsBtn').click();await p.locator(`[data-action=${action}]`).click();}
async function authorize(p,secret=password){await p.locator('#authorizeForm [name=password]').fill(secret);await p.locator('#authorizeForm button[type=submit]').click();await p.locator('#modalBackdrop').waitFor({state:'hidden'});await p.waitForTimeout(100);}
async function addDebt(p,amount='100',name='Acceptance creditor'){await p.locator('#heroAddDebtBtn').click();await p.locator('#debtForm [name=newCreditor]').fill(name);await p.locator('#debtForm [name=amount]').fill(amount);await p.locator('#debtForm [name=attachment]').setInputFiles(file);await p.locator('#debtForm button[type=submit]').click();await p.waitForFunction(()=>!document.querySelector('#debtForm')?.dataset.processing);await p.locator('#debtForm input[type=password]').fill(password);await p.locator('#debtForm button[type=submit]').click();await p.locator('#modalBackdrop').waitFor({state:'hidden'});await p.waitForTimeout(100);}
async function payment(p,amount){await p.locator('#heroAddPaymentBtn').click();await p.locator('#paymentForm [name=amount]').fill(amount);await p.locator('#paymentForm [name=attachment]').setInputFiles(file);await p.locator('#paymentForm button[type=submit]').click();await p.waitForFunction(()=>!document.querySelector('#paymentForm')?.dataset.processing);await p.locator('#paymentForm input[type=password]').fill(password);await p.locator('#paymentForm button[type=submit]').click();await p.locator('#modalBackdrop').waitFor({state:'hidden'});await p.waitForTimeout(100);}
async function balance(p,value){await p.waitForFunction(v=>document.querySelector('#balanceCard').innerText.includes('SAR '+v),value);}
async function backup(p){await settings(p,'backup-menu');const pending=p.waitForEvent('download');await p.locator('[data-action=export-backup]').click();const d=await pending;const bytes=fs.readFileSync(await d.path());await close(p);return {name:'backup.json',mimeType:'application/json',buffer:bytes};}
async function importPreview(p,data,mode='restore',secret=password){await settings(p,'backup-menu');await p.locator(`[data-action=${mode}-backup]`).click();await p.locator('#restoreFileInput').setInputFiles(data);await p.locator('#backupPasswordForm [name=password]').fill(secret);await p.locator('#backupPasswordForm button[type=submit]').click();await p.locator('#backupPasswordForm').waitFor({state:'detached'});}
async function inspect(p,secret=password){return p.evaluate(async secret=>{const storage=await import('./releases/20261019-home-r15/storage.3.1.0.js');const crypto=await import('./releases/20261019-home-r15/crypto.3.1.0.js');const core=await import('./releases/20261019-home-r15/ledger-core.3.1.0.js');const bundle=await storage.exportLedgerBundle();const key=await crypto.unlockSecurity(bundle.record.security,secret);const state=await crypto.decryptJson(bundle.record.envelope,key);for(const snapshot of await storage.listSnapshots()){if(snapshot.record.encrypted)await crypto.decryptJson(snapshot.record.envelope,key);for(const a of snapshot.attachments||[])await crypto.decryptAttachmentBytes(a,key);}return {transactions:state.transactions,attachments:bundle.attachments.map(a=>({id:a.id,transactionId:a.transactionId,type:a.type})),totals:core.overallSummary(state),snapshots:(await storage.listSnapshots()).map(s=>({id:s.id,reason:s.reason,revision:s.revision})),chain:await crypto.verifyLedgerAudit(state)};},secret);}




const out=[];
try{
for(const width of [390,1440]){
 const c=await b.newContext({viewport:{width,height:800}}),p=await c.newPage();p.setDefaultTimeout(15000);
 await p.goto('http://127.0.0.1:8768/');await setup(p);
 for(let i=0;i<2;i++)await addDebt(p,'100','Home creditor '+i);
 await p.waitForTimeout(4500);
 const before=await inspect(p);
 for(let i=0;i<2;i++)await p.locator('[data-action=toggle-creditor]').nth(i).click();
 assert.equal(await p.locator('[data-action=toggle-creditor][aria-expanded=true]').count(),2);
 await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(200);
 assert.equal(await p.locator('[data-action=toggle-creditor][aria-expanded=true]').count(),2);
 out.push({width,name:'Ordinary scrolling preserves expanded details',pass:true});
 const home=p.locator('a[href="#overview"]:visible').first();
 if(width===1440){await home.focus();await p.keyboard.press('Enter');}else await home.click();
 await p.waitForTimeout(700);
 assert.equal(await p.locator('.creditor-detail').count(),0);assert.equal(await p.locator('[data-action=toggle-creditor][aria-expanded=true]').count(),0);
 assert.equal(await p.evaluate(()=>location.hash),'#overview');
 assert.ok(await p.locator('#overview').evaluate(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}));
 await home.click();assert.equal(await p.locator('.creditor-detail').count(),0);
 const after=await inspect(p);assert.deepEqual(after,before);
 out.push({width,name:'Home closes all details and returns to overview without ledger changes',pass:true});
 await p.locator('[data-action=toggle-creditor]').first().click();assert.equal(await p.locator('.creditor-detail').count(),1);
 out.push({width,name:'Creditor can be reopened after Home',pass:true});
 await c.close();
}
}finally{console.log(JSON.stringify(out));fs.writeFileSync(path.join(root,'validation/r15/'+engine+'-home.json'),JSON.stringify(out,null,2));await b.close();server.close();}
