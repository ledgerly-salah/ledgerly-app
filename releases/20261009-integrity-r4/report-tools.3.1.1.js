import { getStateRecord, saveStateRecord, listAttachments, exportLedgerBundle } from './storage.3.1.0.js';
import { unlockSecurity, decryptJson, encryptJson, checksumObject, sha256Text } from './crypto.3.1.0.js';
import {
  APP_VERSION, reconcileState, validateState, diagnostics, overallSummary,
  txEffect, formatSAR, shortDate, shortDateTime, safeDate, categoryBalances, validateAttachments
} from './ledger-core.3.1.0.js';
import { buildLedgerReportPdf } from './pdf-report-v2.3.1.1.js';
import { buildVisualReportPdf } from './visual-report-v1.3.1.1.js';
import { buildInfographicReportPdf } from './infographic-report-v1.3.1.1.js';

import { BUILD_ID } from './release.3.1.1.js';
const REPORT_FORMAT='3';
const REPORT_REF_KEY='ledgerly-report-reference-sequences-v2';
const REPORT_REF_PREFIX={summary:'S',detailed:'D',redacted:'R',infographic:'I',visual:'V'};
const REPORT_TEMPLATE={summary:'Ledger v3',detailed:'Ledger v3',redacted:'Ledger v3',infographic:'Infographic v2',visual:'Visual v2'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function toast(title,message=''){
  const stack=document.getElementById('toastStack');if(!stack)return;
  const el=document.createElement('div');el.className='toast';el.innerHTML=`<strong>${esc(title)}</strong>${message?`<p>${esc(message)}</p>`:''}`;stack.appendChild(el);setTimeout(()=>el.remove(),5000);
}
function dl(bytes,name,type='application/pdf'){
  const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200);
}
window.addEventListener('ledgerly-locked',()=>closeOverlay());
function closeOverlay(){document.getElementById('ledgerlyReportOverlay')?.remove();document.body.style.overflow='';}
function ensureReportStyles(){
  if(document.getElementById('ledgerlyReportV2Styles'))return;
  const style=document.createElement('style');style.id='ledgerlyReportV2Styles';style.textContent=`
    #ledgerlyReportOverlay .settings-row select,
    #ledgerlyReportOverlay .settings-row input[type="date"]{
      min-height:40px;border:1px solid var(--line);border-radius:10px;
      background:var(--surface2);color:var(--ink);padding:8px 10px;
    }
    #ledgerlyReportOverlay .settings-row select{max-width:58%;}
    #ledgerlyReportOverlay .settings-row input[type="date"]{max-width:58%;}
    body.dark #ledgerlyReportOverlay .settings-row select,
    body.dark #ledgerlyReportOverlay .settings-row input[type="date"]{color-scheme:dark;}
    body:not(.dark) #ledgerlyReportOverlay .settings-row select,
    body:not(.dark) #ledgerlyReportOverlay .settings-row input[type="date"]{color-scheme:light;}
    #ledgerlyReportOverlay .settings-row select option{background:var(--surface);color:var(--ink);}
    #ledgerlyReportOverlay .report-visual-note{font-size:12px;color:var(--muted);margin:-2px 0 8px 0;}
    @media(max-width:620px){
      #ledgerlyReportOverlay .settings-row{align-items:center;}
      #ledgerlyReportOverlay .settings-row select,
      #ledgerlyReportOverlay .settings-row input[type="date"]{max-width:56%;min-width:160px;}
    }
  `;document.head.appendChild(style);
}
function overlay(html,wide=true){
  ensureReportStyles();closeOverlay();const wrap=document.createElement('div');wrap.id='ledgerlyReportOverlay';wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal${wide?' wide':''}"><div class="modal-body">${html}</div></div>`;document.body.appendChild(wrap);document.body.style.overflow='hidden';return wrap;
}
function header(title,subtitle=''){return `<div class="modal-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button id="reportClose" class="modal-close" type="button" aria-label="Close">×</button></div>`;}
function bindClose(wrap){wrap.querySelector('#reportClose')?.addEventListener('click',closeOverlay);}
function patchBuildLabel(){const el=document.getElementById('versionLabel');if(el)el.textContent=`v${APP_VERSION} · ${BUILD_ID}`;}

function openReportCenter(){
  const html=`${header('Report center','Audit-ready records + visual financial reports')}
  <div class="notice"><strong>Validated exports.</strong> Reports check the financial ledger, evidence links and current audit chain. As-of balances use the corrected ledger; they are not immutable historical snapshots.</div>
  <form id="reportV2Form">
    <div class="settings-sections">
      <div class="settings-card"><h3>Report type</h3>
        <label class="settings-row"><span>Summary report</span><input type="radio" name="reportType" value="summary" checked></label>
        <label class="settings-row"><span>Detailed ledger</span><input type="radio" name="reportType" value="detailed"></label>
        <label class="settings-row"><span>Redacted ledger</span><input type="radio" name="reportType" value="redacted"></label>
        <label class="settings-row"><span>Infographic report</span><input type="radio" name="reportType" value="infographic"></label>
        <div class="report-visual-note">One-page executive infographic with KPIs, progress ring, category donut, top creditors, insights, mini ledger and audit status.</div>
        <label class="settings-row"><span>Visual financial snapshot</span><input type="radio" name="reportType" value="visual"></label>
        <div class="report-visual-note">Four-page visual analysis with creditor exposure, categories, activity, progress and integrity insights.</div>
      </div>
      <div class="settings-card"><h3>Scope</h3>
        <div class="settings-row"><span>Creditors</span><select name="scope"><option value="all">All creditors</option><option value="outstanding">Outstanding only</option></select></div>
        <div class="settings-row"><span>Transactions from</span><input name="from" type="date"></div>
        <div class="settings-row"><span>Transactions through / balances as of</span><input name="to" type="date"></div>
        <div class="settings-row"><span>Transaction order</span><select name="order"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
        <div class="settings-row"><span>Infographic privacy</span><select name="infographicPrivacy"><option value="full">Full names</option><option value="masked">Masked names</option><option value="private">Private labels</option></select></div>
        <label class="settings-row"><span>Include notes</span><input name="includeNotes" type="checkbox" checked></label>
      </div>
      <div class="settings-card"><h3>Included automatically</h3><p class="tx-meta">Persistent type-specific reference (S/D/R/I/V), issue date/time, report scope, balances-as-of context, ledger revision, report template/build, timezone, reconciliation, data-quality exceptions and audit integrity. Reference counters are stored with the encrypted ledger and therefore travel with ledger backups.</p></div>
    </div>
    <div class="form-actions"><button class="btn btn-soft" type="button" id="reportCancel">Cancel</button><button class="btn btn-primary" type="submit">Continue to authorization</button></div>
  </form>`;
  const wrap=overlay(html,true);bindClose(wrap);wrap.querySelector('#reportCancel').addEventListener('click',closeOverlay);
  wrap.querySelector('#reportV2Form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const o=Object.fromEntries(new FormData(f).entries());o.includeNotes=f.elements.includeNotes.checked;openAuthorization(o);});
}

function openAuthorization(options){
  const visual=options.reportType==='visual',infographic=options.reportType==='infographic',visualLike=visual||infographic;
  const subtitle=infographic?'Infographic export · master password required':visual?'Visual financial export · master password required':'Sensitive financial export · master password required';
  const wrap=overlay(`${header('Authorize report export',subtitle)}
    <div class="notice">Your password is used only on this device to unlock the encrypted ledger for this export. It is never written into the report.</div>
    <form id="reportAuthForm"><div class="form-grid"><div class="field full"><label>Master password</label><input name="password" type="password" autocomplete="current-password" minlength="8" required></div></div><div id="reportAuthError" class="form-error"></div><div class="form-actions"><button id="reportBack" class="btn btn-soft" type="button">Back</button><button id="reportGenerate" class="btn btn-primary" type="submit">Generate report</button></div></form>`,false);
  bindClose(wrap);wrap.querySelector('#reportBack').addEventListener('click',openReportCenter);
  wrap.querySelector('#reportAuthForm').addEventListener('submit',async e=>{
    e.preventDefault();const btn=wrap.querySelector('#reportGenerate');const err=wrap.querySelector('#reportAuthError');btn.disabled=true;btn.textContent='Validating…';err.textContent='';
    try{await generateReport(options,new FormData(e.currentTarget).get('password'));closeOverlay();toast('Report exported',visualLike?'Visual report passed reconciliation and audit validation before export.':'Report passed reconciliation and current audit-chain checks before export.');}
    catch(ex){console.error(ex);err.textContent=ex?.message||'Report generation failed.';btn.disabled=false;btn.textContent='Generate report';}
  });
  setTimeout(()=>wrap.querySelector('input[name="password"]')?.focus(),50);
}

function isCurrentAuditEntry(entry){
  const id=String(entry?.id||'');const app=String(entry?.appVersion||'');
  return app===APP_VERSION && /^audit_[a-z0-9]{8,}_[a-z0-9]{8,}$/i.test(id) && typeof entry?.hash==='string' && entry.hash.length>=40;
}
async function verifyAuditChain(state){
  const items=[...(state.audit||[]),...(state.auditArchive||[])];
  if(!items.length)return {ok:true,count:0,verified:0,legacy:0,label:'EMPTY'};
  let verified=0,legacy=0,boundary=false;
  for(let i=0;i<items.length;i++){
    const entry=items[i];
    if(boundary||!isCurrentAuditEntry(entry)){boundary=true;legacy++;continue;}
    const expected=await sha256Text(JSON.stringify({...entry,hash:null}));
    if(expected!==entry.hash)return {ok:false,count:items.length,verified,legacy,reason:`Current audit hash mismatch at ${entry.id||i}`};
    const next=items[i+1];
    if(next){
      const prev=String(entry.prevHash||'');const nextHash=String(next.hash||'');const nextCurrent=isCurrentAuditEntry(next);
      if(nextCurrent && prev!==nextHash)return {ok:false,count:items.length,verified,legacy,reason:`Current audit link mismatch at ${entry.id||i}`};
      if(!nextCurrent && prev && (!nextHash||prev!==nextHash))return {ok:false,count:items.length,verified,legacy,reason:`Audit boundary link mismatch at ${entry.id||i}`};
    }
    verified++;
  }
  const label=legacy?(verified?`CURRENT VALID (${verified}) / LEGACY ${legacy}`:`LEGACY PRESERVED (${legacy})`):`VALID (${verified} events)`;
  return {ok:true,count:items.length,verified,legacy,label};
}
function tzLabel(){
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Local';const mins=-new Date().getTimezoneOffset();const sign=mins>=0?'+':'-';const h=Math.floor(Math.abs(mins)/60);const m=Math.abs(mins)%60;return `Time Zone: ${zone} (UTC${sign}${h}${m?':'+String(m).padStart(2,'0'):''})`;
}
function parseSeq(value){const n=Number.parseInt(value||'0',10);return Number.isFinite(n)&&n>0?n:0;}
function localRefSequences(){try{return JSON.parse(localStorage.getItem(REPORT_REF_KEY)||'{}')||{};}catch{return {};}}
function reportRefCandidate(state,reportType){
  const type=REPORT_REF_PREFIX[reportType]?reportType:'summary',prefix=REPORT_REF_PREFIX[type];
  const persisted=state.meta?.reportReferenceSequences||{},stored=localRefSequences(),legacy=(!stored.ledgerId||stored.ledgerId===state.meta.ledgerId)?stored:{},base={};
  for(const key of Object.keys(REPORT_REF_PREFIX))base[key]=Math.max(parseSeq(persisted[key]),parseSeq(legacy[key]));
  const next=base[type]+1;const seq={...base,[type]:next};return {type,ref:`${prefix}-${String(next).padStart(4,'0')}`,seq};
}
async function persistReportRef(record,state,dek,candidate){
  const nextState={...state,meta:{...(state.meta||{}),revision:Number(record.revision)+1,reportReferenceSequences:candidate.seq}};
  let nextRecord;
  if(record.encrypted){const envelope=await encryptJson(nextState,dek);nextRecord={...record,envelope,payload:null,revision:Number(record.revision||0)+1};}
  else nextRecord={...record,payload:nextState,revision:Number(record.revision||0)+1};
  await saveStateRecord(nextRecord,{expectedRevision:Number(record.revision||0)});
  try{localStorage.setItem(REPORT_REF_KEY,JSON.stringify({...candidate.seq,ledgerId:state.meta.ledgerId}));}catch{}
  window.dispatchEvent(new Event('ledgerly-record-changed'));
}
function typeLabel(tx){
  let label=({debt:'Debt',payment:'Payment',waiver:'Waiver',adjustment:tx.adjustmentDirection==='decrease'?'Adjustment decrease':'Adjustment increase',reversal:'Reversal'})[tx.type]||String(tx.type||'Record');
  if(tx.voidedAt)label+=' (VOID)';return label;
}
function moneyOrRedacted(h,redacted=false){return redacted?'REDACTED':formatSAR(Number(h||0));}
function signedAmount(state,tx,redacted=false){
  if(redacted)return 'REDACTED';if(tx.voidedAt)return `VOID ${formatSAR(tx.amountHalalas)}`;const eff=txEffect(state,tx);const sign=eff<0?'-':'+';return `${sign}${formatSAR(Math.abs(eff||tx.amountHalalas))}`;
}
function shortStable(hash){return `TX-${String(hash||'').replace(/[^A-Za-z0-9]/g,'').slice(0,7).toUpperCase()||'UNKNOWN'}`;}
function attachmentTypeSummary(items){
  if(!items.length)return '';let pdf=0,img=0,other=0;for(const a of items){const t=String(a.type||'').toLowerCase();if(t.includes('pdf'))pdf++;else if(t.startsWith('image/'))img++;else other++;}
  return [pdf?`${pdf} PDF`:'',img?`${img} image${img===1?'':'s'}`:'',other?`${other} file${other===1?'':'s'}`:''].filter(Boolean).join(' + ');
}
function qualityForSummary(summary){const q=new Set(summary.transactions.filter(x=>!x.voidedAt).map(x=>x.quality||'Confirmed'));return q.has('Disputed')?'Disputed':q.has('Estimated')?'Estimated':'Confirmed';}
function isLegacyTransaction(tx){const v=String(tx?.createdByVersion||'').toLowerCase();return !v||v==='legacy'||v.includes('migration')||v.startsWith('3.0');}
function maskName(name){return String(name||'').split(/\s+/).filter(Boolean).map(p=>p.length<=1?p:`${p[0]}${'*'.repeat(Math.min(6,p.length-1))}`).join(' ');}
function visualData(state,summaries,creditorIds,asOf,txs,txRows,{original,paid,reductions,remaining,liability},nameMap=null){
  const displayName=id=>nameMap?.get(id)||state.creditors.find(c=>c.id===id)?.name||'Unknown';
  const creditorRows=summaries.map(s=>({name:displayName(s.creditor.id),original:Number(s.original||0),paid:Number(s.paid||0),remaining:Number(s.remaining||0),adjustments:Number(s.adjustments||0),waivers:Number(s.waivers||0),progress:Number(s.progress||0),status:s.status,originalLabel:formatSAR(s.original),paidLabel:formatSAR(s.paid),remainingLabel:formatSAR(s.remaining)}));
  const asOfTx=state.transactions.filter(tx=>creditorIds.has(tx.creditorId)&&(!asOf||safeDate(tx.effectiveDate)<=asOf));
  const scopedState={...state,creditors:state.creditors.filter(c=>creditorIds.has(c.id)),transactions:asOfTx};
  const categories=categoryBalances(scopedState).map(c=>({...c,remainingLabel:formatSAR(c.remaining)}));
  const reversed=new Set(state.transactions.filter(r=>!r.voidedAt&&r.type==='reversal'&&r.reversedTransactionId&&(!asOf||safeDate(r.effectiveDate)<=asOf)).map(r=>r.reversedTransactionId));
  const payments=txs.filter(tx=>tx.type==='payment'&&!tx.voidedAt&&!reversed.has(tx.id)).map(tx=>({date:shortDate(tx.effectiveDate),creditor:displayName(tx.creditorId),amount:Number(tx.amountHalalas||0),amountLabel:formatSAR(tx.amountHalalas),method:String(tx.method||'')}));
  const monthly=new Map();for(const tx of txs){if(tx.type!=='payment'||tx.voidedAt||reversed.has(tx.id))continue;const month=safeDate(tx.effectiveDate).slice(0,7);if(!month)continue;monthly.set(month,(monthly.get(month)||0)+Number(tx.amountHalalas||0));}
  const paymentMonths=[...monthly.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,amount])=>({month,label:month,amount}));
  const open=creditorRows.filter(c=>c.remaining>0),largest=open[0]||null,lowest=[...open].sort((a,b)=>a.remaining-b.remaining)[0]||null,mostPaid=[...creditorRows].sort((a,b)=>b.paid-a.paid)[0]||null;
  const latest=[...txRows].sort((a,b)=>String(b.sortDate).localeCompare(String(a.sortDate))).slice(0,5).map(t=>({date:t.effectiveDate,creditor:t.creditor,type:t.type,amount:t.amount}));
  return {raw:{original,paid,reductions,remaining,liability},repaymentPct:liability>0?Math.max(0,Math.min(100,reductions/liability*100)):0,creditors:creditorRows,categories,paymentEvents:payments.length,payments,paymentMonths,latest,statusCounts:{open:open.length,outstanding:creditorRows.filter(c=>c.status==='Outstanding').length,partial:creditorRows.filter(c=>c.status==='Partially Paid').length,paid:creditorRows.filter(c=>c.status==='Paid').length},insights:{largest,lowest,mostPaid}};
}

async function generateReport(options,password){
  const bundle=await exportLedgerBundle();const record=bundle.record;if(!record)throw new Error('Ledger record was not found on this device.');
  let rawState,dek=null;if(record.encrypted){if(!password)throw new Error('Master password is required.');dek=await unlockSecurity(record.security,password,{recovery:false});rawState=await decryptJson(record.envelope,dek);}else rawState=record.payload;
  const state=reconcileState(rawState);validateState(state);
  const diag=diagnostics(state);if(!diag.ok)throw new Error('Report blocked: ledger diagnostics found an integrity error.');
  const audit=await verifyAuditChain(state);if(!audit.ok)throw new Error(`Report blocked: ${audit.reason}.`);

  if((options.from&&!safeDate(options.from))||(options.to&&!safeDate(options.to))||(options.from&&options.to&&options.from>options.to))throw new Error('Invalid report date range.');const asOf=safeDate(options.to)||null;const allSummary=overallSummary(state,asOf);let summaries=[...allSummary.summaries];if(options.scope==='outstanding')summaries=summaries.filter(s=>s.remaining>0);
  summaries.sort((a,b)=>b.remaining-a.remaining||String(a.creditor.name).localeCompare(String(b.creditor.name)));
  const creditorIds=new Set(summaries.map(s=>s.creditor.id));const total=key=>summaries.reduce((n,s)=>n+Number(s[key]||0),0);
  const original=total('original'),adjustments=total('adjustments'),liability=total('liability'),paid=total('paid'),waivers=total('waivers'),reductions=total('reductions'),remaining=Math.max(0,liability-reductions);
  const sumRemaining=summaries.reduce((n,s)=>n+s.remaining,0);if(sumRemaining!==remaining)throw new Error('Report blocked: creditor balances do not reconcile to the report total.');

  const attachments=bundle.attachments;validateAttachments(state,attachments);const byTx=new Map();for(const a of attachments){if(!byTx.has(a.transactionId))byTx.set(a.transactionId,[]);byTx.get(a.transactionId).push(a);}
  let txs=state.transactions.filter(tx=>creditorIds.has(tx.creditorId));if(options.from)txs=txs.filter(tx=>safeDate(tx.effectiveDate)>=safeDate(options.from));if(options.to)txs=txs.filter(tx=>safeDate(tx.effectiveDate)<=safeDate(options.to));
  txs.sort((a,b)=>{const d=String(a.effectiveDate).localeCompare(String(b.effectiveDate))||String(a.createdAt).localeCompare(String(b.createdAt));return options.order==='oldest'?d:-d;});

  const qualityScope=state.transactions.filter(tx=>creditorIds.has(tx.creditorId)&&(!asOf||safeDate(tx.effectiveDate)<=asOf));
  const estimated=qualityScope.filter(tx=>!tx.voidedAt&&tx.quality==='Estimated').length,disputed=qualityScope.filter(tx=>!tx.voidedAt&&tx.quality==='Disputed').length;
  let legacyNoEvidence=0,missingEvidence=0;for(const tx of qualityScope.filter(tx=>!tx.voidedAt&&['debt','payment'].includes(tx.type))){const has=(byTx.get(tx.id)||[]).some(a=>(tx.attachmentIds||[]).includes(a.id));if(has)continue;if(isLegacyTransaction(tx))legacyNoEvidence++;else missingEvidence++;}

  const redacted=options.reportType==='redacted',visual=options.reportType==='visual',infographic=options.reportType==='infographic',privacy=infographic?(options.infographicPrivacy||'full'):'full';
  const checksumState=JSON.parse(JSON.stringify(state));if(checksumState.meta)delete checksumState.meta.reportReferenceSequences;
  const checksum=await checksumObject(checksumState),reportId=`${infographic?'INF':'LGR'}-${String(checksum).replace(/[^A-Za-z0-9]/g,'').slice(0,10).toUpperCase()}`;
  const creditorNames=new Map();summaries.forEach((s,i)=>{let name=s.creditor.name;if(redacted||infographic&&privacy==='private')name=`Creditor ${String(i+1).padStart(2,'0')}`;else if(infographic&&privacy==='masked')name=maskName(name);creditorNames.set(s.creditor.id,name);});
  const creditorRows=summaries.map(s=>({name:creditorNames.get(s.creditor.id),original:moneyOrRedacted(s.original,redacted),adjustment:redacted?'REDACTED':`${s.liability-s.original>0?'+':s.liability-s.original<0?'-':''}${formatSAR(Math.abs(s.liability-s.original))}`,paid:moneyOrRedacted(s.paid,redacted),remaining:moneyOrRedacted(s.remaining,redacted),status:s.status,progress:redacted?'--':`${Number(s.progress||0).toFixed(1)}%`,nextDue:s.nextDue?shortDate(s.nextDue):'--',quality:qualityForSummary(s)}));

  const txRows=[];for(const tx of txs){
    const h=await sha256Text(tx.id),att=byTx.get(tx.id)||[],legacy=isLegacyTransaction(tx);let evidence=attachmentTypeSummary(att);if(!evidence){if(['debt','payment'].includes(tx.type))evidence=legacy?'Legacy - no evidence':'Missing';else evidence='N/A';}
    let allocation='';if(['payment','waiver'].includes(tx.type)){const n=(tx.allocations||[]).length;allocation=n?`${n} debt record${n===1?'':'s'} | ${tx.allocationMode||'allocated'}`:'Unallocated';}
    let verification='';if(!redacted){const parts=[];if(tx.verificationSource)parts.push(tx.verificationSource);if(tx.verifiedAt)parts.push(shortDate(tx.verifiedAt));if(tx.verified)parts.push('Verified');verification=parts.join(' | ');}
    txRows.push({sortDate:tx.createdAt||tx.effectiveDate,effectiveDate:tx.effectiveDateUnknown?'Date pending':shortDate(tx.effectiveDate),recordedAt:shortDateTime(tx.createdAt),shortId:shortStable(h),creditor:creditorNames.get(tx.creditorId)||'Unknown',type:typeLabel(tx),amount:signedAmount(state,tx,redacted),category:redacted?'REDACTED':(tx.category||'Personal'),quality:tx.quality||'Confirmed',evidence,method:redacted?'':(tx.method||''),reference:redacted?'':(tx.reference||''),allocation:redacted?'':allocation,note:(!redacted&&options.includeNotes)?String(tx.notes||tx.description||'').trim():'',verification});
  }

  const generatedIso=new Date().toISOString(),generated=shortDateTime(generatedIso),rangeFrom=options.from?shortDate(options.from):'start',rangeTo=options.to?shortDate(options.to):'current';
  const scopeLabel=options.scope==='outstanding'?'Outstanding only':'All creditors, including archived',asOfLabel=options.to?`Balances as of ${shortDate(options.to)}`:'Balances: all recorded effective dates';
  const scopeText=`${options.scope==='outstanding'?'Outstanding creditors only':'All creditors, including archived'}; balances recomputed from the corrected ledger as of ${options.to?shortDate(options.to):'all recorded dates'}; transactions ${rangeFrom} through ${rangeTo}`;
  const adjText=redacted?'REDACTED':(waivers===0&&adjustments===0?'SAR 0.00':`W ${formatSAR(waivers)} / A ${(adjustments<0?'-':'+')+formatSAR(Math.abs(adjustments))}`),equation=redacted?'REDACTED':`${formatSAR(liability)} - ${formatSAR(reductions)} = ${formatSAR(remaining)}`;
  const candidate=reportRefCandidate(rawState,options.reportType);
  const model={reportType:redacted?'detailed':options.reportType,redacted,infographicPrivacy:privacy,generatedIso,generated,timezone:tzLabel(),version:APP_VERSION,build:BUILD_ID,templateRevision:REPORT_TEMPLATE[options.reportType]||'Ledger v2',revision:Number(record.revision||state.meta?.revision||0),reportFormat:REPORT_FORMAT,reportId,currency:state.meta?.currency||'SAR',scopeText,scopeLabel,asOfLabel,transactionRange:`${rangeFrom} to ${rangeTo}`,orderLabel:options.order==='oldest'?'Oldest first':'Newest first',summary:{original:moneyOrRedacted(original,redacted),paid:moneyOrRedacted(paid,redacted),waivedAdjusted:adjText,waived:moneyOrRedacted(waivers,redacted),adjustment:redacted?'REDACTED':`${adjustments>0?'+':adjustments<0?'-':''}${formatSAR(Math.abs(adjustments))}`,remaining:moneyOrRedacted(remaining,redacted),equation},counts:{creditors:summaries.length,transactions:txs.length,active:summaries.filter(s=>s.remaining>0).length,completed:summaries.filter(s=>s.remaining<=0).length},health:{reconciliation:'PASSED',audit:audit.label,diagnostics:'PASSED'},quality:{estimated,disputed,legacyNoEvidence,missingEvidence},creditors:creditorRows,transactions:txRows,issueRef:candidate.ref};
  if(visual||infographic)model.visual=visualData(state,summaries,creditorIds,asOf,txs,txRows,{original,paid,reductions,remaining,liability},infographic?creditorNames:null);

  const bytes=infographic?buildInfographicReportPdf(model):visual?buildVisualReportPdf(model):buildLedgerReportPdf(model);
  await persistReportRef(record,rawState,dek,candidate);
  const d=new Date(),p=n=>String(n).padStart(2,'0'),stamp=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_LR${model.revision}_${p(d.getHours())}${p(d.getMinutes())}`,kind=redacted?'Redacted':infographic?'Infographic':visual?'Visual':options.reportType==='summary'?'Summary':'Detailed';
  dl(bytes,`Ledgerly_${kind}_${model.issueRef}_${stamp}.pdf`);
}

document.addEventListener('click',e=>{const target=e.target.closest?.('[data-action="report-menu"]');if(!target)return;e.preventDefault();e.stopImmediatePropagation();openReportCenter();},true);
window.addEventListener('load',()=>{ensureReportStyles();patchBuildLabel();});


