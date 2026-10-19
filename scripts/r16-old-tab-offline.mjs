// Isolated synthetic ledger. Never points to production or a personal browser profile.
import {execFileSync} from 'node:child_process';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);let serveOld=true;const prior=new Map(['index.html','service-worker.js','version.json','LEDGERLY_RELEASE.json'].map(f=>[path.join(root,f),execFileSync('git',['show',(process.env.LEDGERLY_BASELINE_REF||'718a9c2')+':'+f],{cwd:root})]));const server=http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));try{res.setHeader('Content-Type',(f.endsWith('.js')||f.endsWith('.mjs'))?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':f.endsWith('.svg')?'image/svg+xml':f.endsWith('.png')?'image/png':f.endsWith('.json')?'application/json':'application/octet-stream');res.end(serveOld&&prior.has(f)?prior.get(f):(!serveOld&&process.env.LEDGERLY_SW_BASELINE&&f.endsWith('service-worker.js')?Buffer.from(prior.get(f).toString().replaceAll('20261019-home-r15','20261019-readiness-r16')):fs.readFileSync(f)));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(8765,'127.0.0.1',r));
const {chromium}=await import(process.env.LEDGERLY_PLAYWRIGHT_MODULE || 'playwright');
const b=await chromium.launch({executablePath:process.env.LEDGERLY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});const context=await b.newContext({viewport:{width:390,height:844}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8765/');await p.locator('#setupPassword').fill('synthetic-password');await p.locator('#mandatorySecurityForm [name=confirm]').fill('synthetic-password');await p.locator('#mandatorySecurityForm [name=recovery]').uncheck();await p.locator('#mandatorySecurityForm button[type=submit]').click();await p.locator('[data-action=finish-onboarding]').click();await p.locator('#modalBackdrop').waitFor({state:'hidden'});await p.waitForTimeout(150);


await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await p.locator('#unlockPassword').fill('synthetic-password');await p.locator('#unlockForm button').click();await p.locator('#lockScreen').waitFor({state:'hidden'});if(!(await p.locator('#versionLabel').innerText()).includes('home-r15'))throw Error('Old shell not loaded');serveOld=false;await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await p.locator('#updateBanner').waitFor();

await p.locator('#heroAddDebtBtn').click();
// A second tab can activate the waiting worker while this tab has an open form.
await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();r.waiting.postMessage({type:'SKIP_WAITING'});});
await p.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).waiting);
await p.waitForTimeout(500);await context.setOffline(true);
const loaded=await p.evaluate(async()=>{try{await import('./releases/20261019-home-r15/pdf-preview/pdf.mjs');return true;}catch(e){console.error(e.message);return false;}});

const retained=(await p.locator('#versionLabel').innerText()).includes('home-r15');let cleanup=null;
if(!process.env.LEDGERLY_SW_BASELINE){
 if(!loaded)throw new Error('Old PDF module is unavailable');
 await p.reload();await p.waitForFunction(()=>document.querySelector('#versionLabel').textContent.includes('readiness-r16'));
 await p.waitForFunction(async()=>!(await caches.keys()).some(k=>k.startsWith('ledgerly-shell-')&&!k.includes('readiness-r16')));
 cleanup=await p.evaluate(async()=>({keys:await caches.keys(),currentPdf:!!(await import('./releases/20261019-readiness-r16/pdf-preview/pdf.mjs'))}));
}
fs.writeFileSync('validation/r16/old-tab-offline'+(process.env.LEDGERLY_SW_BASELINE?'-before':'')+'.json',JSON.stringify({oldTabRetained:retained,oldPdfModuleAvailable:loaded,cleanup},null,2));
console.log('OLD TAB OFFLINE MODULE',loaded,'CLEANUP',cleanup);await b.close();server.close();
