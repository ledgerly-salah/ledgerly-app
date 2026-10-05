import { getStateRecord } from './storage.3.1.0.js';
import { unlockSecurity } from './crypto.3.1.0.js';

const PROTECTED_FORMS = new Map([
  ['adjustmentForm', 'Authorize adjustment'],
  ['waiverForm', 'Authorize settlement / waiver']
]);

function esc(v){
  return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function closeGuard(){
  document.getElementById('ledgerlyFinancialGuard')?.remove();
}

function openGuard(form,label){
  closeGuard();
  const wrap=document.createElement('div');
  wrap.id='ledgerlyFinancialGuard';
  wrap.className='modal-backdrop';
  wrap.style.zIndex='10050';
  wrap.innerHTML=`<div class="modal"><div class="modal-body">
    <div class="modal-head"><div><h2>Password required</h2><p>${esc(label)} · protected financial action</p></div><button id="fgClose" class="modal-close" type="button" aria-label="Close">×</button></div>
    <div class="danger-box"><strong>Master password required.</strong> This action changes the ledger balance without recording a normal cash payment, so Ledgerly requires re-authorization before saving it.</div>
    <form id="fgAuthForm">
      <div class="form-grid"><div class="field full"><label>Master password</label><input id="fgPassword" name="password" type="password" autocomplete="current-password" minlength="8" required></div></div>
      <div id="fgError" class="form-error"></div>
      <div class="form-actions"><button id="fgCancel" class="btn btn-soft" type="button">Cancel</button><button id="fgAuthorize" class="btn btn-primary" type="submit">Authorize & save</button></div>
    </form>
  </div></div>`;
  document.body.appendChild(wrap);

  const cancel=()=>closeGuard();
  wrap.querySelector('#fgClose').addEventListener('click',cancel);
  wrap.querySelector('#fgCancel').addEventListener('click',cancel);
  wrap.querySelector('#fgAuthForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=wrap.querySelector('#fgAuthorize');
    const err=wrap.querySelector('#fgError');
    btn.disabled=true;btn.textContent='Authorizing…';err.textContent='';
    try{
      const record=await getStateRecord();
      if(!record?.encrypted||!record.security)throw new Error('Protected ledger not found.');
      const password=wrap.querySelector('#fgPassword').value;
      await unlockSecurity(record.security,password,{recovery:false});
      form.dataset.ledgerlyFinancialAuthorized='1';
      closeGuard();
      queueMicrotask(()=>form.requestSubmit());
    }catch(ex){
      console.error('Financial action authorization failed',ex);
      err.textContent='Incorrect master password.';
      btn.disabled=false;btn.textContent='Authorize & save';
      setTimeout(()=>wrap.querySelector('#fgPassword')?.focus(),20);
    }
  });
  setTimeout(()=>wrap.querySelector('#fgPassword')?.focus(),50);
}

document.addEventListener('submit',e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement))return;
  const label=PROTECTED_FORMS.get(form.id);
  if(!label)return;
  if(form.dataset.ledgerlyFinancialAuthorized==='1'){
    delete form.dataset.ledgerlyFinancialAuthorized;
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  openGuard(form,label);
},true);
