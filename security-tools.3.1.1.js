import './financial-action-guard.3.1.1.js';
import './report-tools.3.1.1.js';
import { getStateRecord, saveStateRecord, clearSnapshots } from './storage.3.1.0.js';
import {
  unlockSecurity, decryptJson, encryptJson, deriveKek, randomBytes,
  bytesToBase64, sha256Text, RECOVERY_ITERATIONS
} from './crypto.3.1.0.js';

const PATCH_BUILD='20261005-r3';
const APP_VERSION='3.1.0';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uid=(prefix='id')=>`${prefix}_${Date.now().toString(36)}_${(crypto.randomUUID?.()||Math.random().toString(36).slice(2)).replace(/-/g,'').slice(0,12)}`;
function b64url(bytes){return bytesToBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function newRecoveryKey(){return `LDG-${b64url(randomBytes(24)).match(/.{1,6}/g).join('-')}`;}

function patchBuildLabel(){
  const label=document.getElementById('versionLabel');
  if(label) label.textContent=`v${APP_VERSION} · ${PATCH_BUILD}`;
  const modal=document.getElementById('modal');
  const sub=modal?.querySelector('.modal-head p');
  if(sub?.textContent?.includes('20261005-r1')||sub?.textContent?.includes('20261005-r2')) sub.textContent=`v${APP_VERSION} · ${PATCH_BUILD}`;
}

function makeOverlay(bodyHtml){
  const existing=document.getElementById('ledgerlySecurityOverlay');
  if(existing) existing.remove();
  const wrap=document.createElement('div');
  wrap.id='ledgerlySecurityOverlay';
  wrap.className='modal-backdrop';
  wrap.innerHTML=`<div class="modal"><div class="modal-body">${bodyHtml}</div></div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow='hidden';
  return wrap;
}
function removeOverlay(){document.getElementById('ledgerlySecurityOverlay')?.remove();document.body.style.overflow='';}

function injectRotateButton(){
  patchBuildLabel();
  const modal=document.getElementById('modal');
  if(!modal||document.getElementById('rotateRecoveryKeyBtn')) return;
  const securityCard=[...modal.querySelectorAll('.settings-card')].find(card=>card.querySelector('h3')?.textContent?.trim()==='Security');
  if(!securityCard) return;
  const stack=securityCard.querySelector('.stack-actions');
  if(!stack) return;
  const btn=document.createElement('button');
  btn.id='rotateRecoveryKeyBtn';
  btn.className='btn btn-soft';
  btn.type='button';
  btn.textContent='Rotate recovery key';
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openRotateDialog();});
  stack.appendChild(btn);
}

function openRotateDialog(){
  const overlay=makeOverlay(`
    <div class="modal-head"><div><h2>Rotate recovery key</h2><p>Invalidate the old recovery key without changing your master password.</p></div><button id="rkCancel" class="modal-close" type="button" aria-label="Close">×</button></div>
    <div class="danger-box"><strong>Security maintenance.</strong> After rotation, the previous recovery key will no longer unlock the current Ledgerly data. Save the new key somewhere private before closing the result screen.</div>
    <form id="rkForm">
      <div class="form-grid"><div class="field full"><label>Current master password</label><input id="rkPassword" name="password" type="password" autocomplete="current-password" minlength="8" required></div></div>
      <div id="rkStatus" class="form-error"></div>
      <div class="form-actions"><button id="rkCancel2" class="btn btn-soft" type="button">Cancel</button><button id="rkSubmit" class="btn btn-primary" type="submit">Rotate recovery key</button></div>
    </form>`);
  const cancel=()=>removeOverlay();
  overlay.querySelector('#rkCancel').addEventListener('click',cancel);
  overlay.querySelector('#rkCancel2').addEventListener('click',cancel);
  overlay.querySelector('#rkForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const password=overlay.querySelector('#rkPassword').value;
    const status=overlay.querySelector('#rkStatus');
    const submit=overlay.querySelector('#rkSubmit');
    status.textContent=''; submit.disabled=true; submit.textContent='Rotating…';
    try{
      const recoveryKey=await rotateRecoveryKey(password);
      showNewRecoveryKey(recoveryKey);
    }catch(err){
      console.error('Recovery key rotation failed',err);
      status.textContent='Rotation failed. Check the current master password and try again.';
      submit.disabled=false;submit.textContent='Rotate recovery key';
    }
  });
  setTimeout(()=>overlay.querySelector('#rkPassword')?.focus(),50);
}

async function rotateRecoveryKey(password){
  const record=await getStateRecord();
  if(!record?.encrypted||!record.security) throw new Error('Protected ledger not found.');
  const dek=await unlockSecurity(record.security,password,{recovery:false});
  const state=await decryptJson(record.envelope,dek);
  const expected=Number(record.revision||0);
  const now=new Date().toISOString();

  const recoveryKey=newRecoveryKey();
  const rsalt=randomBytes(16);
  const rkek=await deriveKek(recoveryKey,rsalt,RECOVERY_ITERATIONS);
  const raw=new Uint8Array(await crypto.subtle.exportKey('raw',dek));
  const iv=randomBytes(12);
  const wrappedData=await crypto.subtle.encrypt({name:'AES-GCM',iv},rkek,raw);
  const nextSecurity={
    ...record.security,
    recovery:{
      kdf:'PBKDF2-SHA256',
      iterations:RECOVERY_ITERATIONS,
      salt:bytesToBase64(rsalt),
      wrappedDek:{iv:bytesToBase64(iv),data:bytesToBase64(wrappedData)}
    },
    recoveryRotatedAt:now
  };

  const next=JSON.parse(JSON.stringify(state));
  next.meta={...(next.meta||{}),revision:expected+1,updatedAt:now,appVersion:APP_VERSION};
  const prev=(next.audit||[])[0]?.hash||'';
  const audit={
    id:uid('audit'),ts:now,event:'Recovery key rotated',entityType:'system',entityId:null,creditorId:null,
    details:'Recovery key rotated; master password and data-encryption key retained.',before:null,after:null,
    reason:'Security maintenance',prevHash:prev,hash:null,appVersion:APP_VERSION
  };
  audit.hash=await sha256Text(JSON.stringify({...audit,hash:null}));
  next.audit=[audit,...(next.audit||[])];
  const envelope=await encryptJson(next,dek);
  await saveStateRecord({id:'current',encrypted:true,revision:expected+1,envelope,security:nextSecurity},{expectedRevision:expected,snapshotReason:null});
  await clearSnapshots();
  return recoveryKey;
}

function showNewRecoveryKey(key){
  const overlay=makeOverlay(`
    <div class="modal-head"><div><h2>New recovery key</h2><p>The previous recovery key is now invalid for the current ledger.</p></div></div>
    <div class="danger-box"><strong>Save this key now.</strong> Do not send it in chat, screenshots, email, or messages. Store it somewhere only you can access.</div>
    <div class="recovery-code" id="rkCode">${esc(key).replace(/-/g,'-<wbr>')}</div>
    <div id="rkCopyStatus" class="notice">Your master password has not changed. Previous rollback snapshots were cleared so the exposed recovery key cannot be reintroduced from an old local snapshot.</div>
    <div class="form-actions"><button id="rkCopy" class="btn btn-soft" type="button">Copy key</button><button id="rkDone" class="btn btn-primary" type="button">I saved it — reload Ledgerly</button></div>`);
  overlay.querySelector('#rkCopy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(key);overlay.querySelector('#rkCopyStatus').textContent='Recovery key copied. Save it somewhere private. Your master password has not changed.';}catch{overlay.querySelector('#rkCopyStatus').textContent='Copy was blocked by the browser. Select the key manually and save it privately.';}
  });
  overlay.querySelector('#rkDone').addEventListener('click',()=>location.reload());
}

const modal=document.getElementById('modal');
if(modal){new MutationObserver(injectRotateButton).observe(modal,{childList:true,subtree:true});}
window.addEventListener('load',()=>{patchBuildLabel();injectRotateButton();});
