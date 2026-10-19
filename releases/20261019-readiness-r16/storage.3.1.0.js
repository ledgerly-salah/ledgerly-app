import { nowIso, deepClone, validateAttachments } from './ledger-core.3.1.0.js';

const DB_NAME='ledgerly.production.v3';
const DB_VERSION=4;
const STATE_STORE='state';
const SNAPSHOT_STORE='snapshots';
const ATTACHMENT_STORE='attachments';
const JOURNAL_STORE='journal';
const META_STORE='meta';
const DRAFT_STORE='drafts';
function safeJournal(row){return {id:row.id,type:'ledger-write',expectedRevision:row.expectedRevision??null,status:row.status,createdAt:row.createdAt,completedAt:row.completedAt,failedAt:row.failedAt,errorCode:row.status==='failed'?'WRITE_FAILED':undefined};}
const BC_NAME='ledgerly-revision-v3';

export class RevisionConflictError extends Error { constructor(message='A newer ledger revision exists on this device.'){super(message);this.name='RevisionConflictError';this.code='REVISION_CONFLICT';} }

export function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);let abandoned=false;
    req.onblocked=()=>{abandoned=true;reject(new Error('Storage upgrade is blocked by another tab. Close other Ledgerly tabs and reload.'));};
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(SNAPSHOT_STORE)){ const s=db.createObjectStore(SNAPSHOT_STORE,{keyPath:'id'}); s.createIndex('createdAt','createdAt'); }
      if(!db.objectStoreNames.contains(ATTACHMENT_STORE)){ const a=db.createObjectStore(ATTACHMENT_STORE,{keyPath:'id'}); a.createIndex('transactionId','transactionId'); a.createIndex('creditorId','creditorId'); }
      if(!db.objectStoreNames.contains(JOURNAL_STORE)){ const j=db.createObjectStore(JOURNAL_STORE,{keyPath:'id'}); j.createIndex('status','status'); j.createIndex('createdAt','createdAt'); }
      if(!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>{
      const db=req.result;if(abandoned){db.close();return;}db.onversionchange=()=>db.close();const cleanup=db.transaction(JOURNAL_STORE,'readwrite');const cursor=cleanup.objectStore(JOURNAL_STORE).openCursor();
      cursor.onsuccess=()=>{const c=cursor.result;if(c){const row=safeJournal(c.value);if(JSON.stringify(row)!==JSON.stringify(c.value))c.update(row);c.continue();}};
      cleanup.oncomplete=()=>resolve(db);cleanup.onerror=cleanup.onabort=()=>{db.close();reject(cleanup.error||new Error('Journal cleanup failed.'));};
    }; req.onerror=()=>reject(req.error);
  });
}

function txDone(tx){ return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted.'));}); }
function reqResult(req){ return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}); }

export async function requestPersistentStorage(){
  try { if(!navigator.storage?.persist) return {supported:false,persisted:false}; const persisted=await navigator.storage.persist(); return {supported:true,persisted}; } catch { return {supported:true,persisted:false}; }
}
export async function storageEstimate({timeoutMs=1500}={}){
  const fallback={usage:0,quota:0,persisted:false};let timer;
  try{return await Promise.race([
    (async()=>{const e=await navigator.storage?.estimate?.();return {usage:Number(e?.usage||0),quota:Number(e?.quota||0),persisted:await navigator.storage?.persisted?.()};})(),
    new Promise(resolve=>{timer=setTimeout(()=>resolve(fallback),timeoutMs);})
  ]);}catch{return fallback;}finally{clearTimeout(timer);}
}

export async function getStateRecord(){ const db=await openDb(); try{ const tx=db.transaction(STATE_STORE,'readonly'); const rec=await reqResult(tx.objectStore(STATE_STORE).get('current')); await txDone(tx); return rec||null; } finally{db.close();} }
export async function getMeta(id){const db=await openDb();try{const tx=db.transaction(META_STORE,'readonly');const v=await reqResult(tx.objectStore(META_STORE).get(id));await txDone(tx);return v||null;}finally{db.close();}}
export async function setMeta(id,value){const db=await openDb();try{const tx=db.transaction(META_STORE,'readwrite');tx.objectStore(META_STORE).put({id,value,updatedAt:nowIso()});await txDone(tx);}finally{db.close();}}

export async function saveStateRecord(record,{expectedRevision=null,snapshotReason=null,operationId=null,attachments=null,putAttachments=[],deleteAttachmentIds=[],validationState=null,signal=null,replacementSnapshots=null,expectedSnapshotIds=null,clearDraftRecords=false,metaUpdates=[]}={}){
  const run=async()=>{
    const db=await openDb();
    let tx=null;let abortListener=null;
    try{
      if(signal?.aborted)throw new DOMException('Session ended.','AbortError');
      const stores=[STATE_STORE,SNAPSHOT_STORE,JOURNAL_STORE,ATTACHMENT_STORE,DRAFT_STORE,META_STORE];
      tx=db.transaction(stores,'readwrite');abortListener=()=>{try{tx.abort();}catch{}};signal?.addEventListener('abort',abortListener,{once:true}); const stateStore=tx.objectStore(STATE_STORE); const snapStore=tx.objectStore(SNAPSHOT_STORE); const journalStore=tx.objectStore(JOURNAL_STORE);
      const current=await reqResult(stateStore.get('current'));
      const currentRev=Number(current?.revision||0);
      if(expectedRevision!==null && currentRev!==Number(expectedRevision)){tx.abort();throw new RevisionConflictError();}
      const next={...record,id:'current',revision:Number(record.revision??currentRev+1),savedAt:nowIso()};
      const attachmentStore=tx.objectStore(ATTACHMENT_STORE);
      const currentFiles=await reqResult(attachmentStore.getAll());
      const futureFiles=new Map((attachments===null?currentFiles:attachments).map(a=>[a.id,a]));
      for(const a of putAttachments)futureFiles.set(a.id,a);for(const id of deleteAttachmentIds)futureFiles.delete(id);
      const checked=validationState||(!record.encrypted&&record.payload?.transactions?record.payload:null);
      if(checked)validateAttachments(checked,[...futureFiles.values()]);
      if(replacementSnapshots!==null){const existing=await reqResult(snapStore.getAll());if(JSON.stringify(existing.map(x=>x.id).sort())!==JSON.stringify([...(expectedSnapshotIds||[])].sort()))throw new RevisionConflictError('Snapshots changed during security rotation. Retry.');snapStore.clear();for(const snapshot of replacementSnapshots)snapStore.put(snapshot);}
      if(clearDraftRecords)tx.objectStore(DRAFT_STORE).clear();
      if(signal?.aborted)throw new DOMException('Session ended.','AbortError');
      if(snapshotReason && current){const files=await reqResult(attachmentStore.getAll());snapStore.put({id:`snapshot_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,createdAt:nowIso(),reason:snapshotReason,revision:currentRev,record:deepClone(current),attachments:files});}
      if(attachments!==null){attachmentStore.clear();for(const item of attachments)attachmentStore.put(item);}
      for(const item of putAttachments)attachmentStore.put(item);
      for(const id of deleteAttachmentIds)attachmentStore.delete(id);
      stateStore.put(next);
      for(const item of metaUpdates)tx.objectStore(META_STORE).put({id:item.id,value:item.value,updatedAt:nowIso()});
      if(operationId) journalStore.put({id:operationId,status:'completed',completedAt:nowIso(),createdAt:nowIso()});
      await txDone(tx);
      broadcastRevision(next.revision);
      void pruneSnapshots(40).catch(err=>console.warn("Snapshot retention could not finish",err));
      return next;
    }catch(err){try{tx?.abort();}catch{}throw err;}finally{if(abortListener)signal?.removeEventListener('abort',abortListener);db.close();}
  };
  if(navigator.locks?.request) return navigator.locks.request('ledgerly-write-lock',{mode:'exclusive'},run);
  return run();
}

export async function beginOperation({type,reason='',expectedRevision=null}){
  const id=`op_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; const db=await openDb();
  try{const tx=db.transaction(JOURNAL_STORE,'readwrite');tx.objectStore(JOURNAL_STORE).put(safeJournal({id,expectedRevision,status:'pending',createdAt:nowIso()}));await txDone(tx);return id;}finally{db.close();}
}
export async function failOperation(id,error){if(!id)return;const db=await openDb();try{const tx=db.transaction(JOURNAL_STORE,'readwrite');const s=tx.objectStore(JOURNAL_STORE);const rec=await reqResult(s.get(id));s.put(safeJournal({...rec,id,status:'failed',failedAt:nowIso()}));await txDone(tx);}finally{db.close();}}
export async function pendingOperations(){const db=await openDb();try{const tx=db.transaction(JOURNAL_STORE,'readonly');const all=await reqResult(tx.objectStore(JOURNAL_STORE).getAll());await txDone(tx);return (all||[]).filter(x=>x.status==='pending');}finally{db.close();}}

export async function createManualSnapshot(record,reason='Manual snapshot'){
  const db=await openDb();try{const tx=db.transaction([STATE_STORE,SNAPSHOT_STORE,ATTACHMENT_STORE],'readwrite');const current=await reqResult(tx.objectStore(STATE_STORE).get('current'));if(current&&Number(current.revision)!==Number(record?.revision)){tx.abort();throw new RevisionConflictError();}const files=await reqResult(tx.objectStore(ATTACHMENT_STORE).getAll());tx.objectStore(SNAPSHOT_STORE).put({id:`snapshot_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,createdAt:nowIso(),reason,revision:Number(record?.revision||0),record:deepClone(record),attachments:files});await txDone(tx);}finally{db.close();}
}

export async function orphanAttachmentIds(referencedIds){const db=await openDb();try{const tx=db.transaction([SNAPSHOT_STORE,ATTACHMENT_STORE],'readonly');const [snaps,files]=await Promise.all([reqResult(tx.objectStore(SNAPSHOT_STORE).getAll()),reqResult(tx.objectStore(ATTACHMENT_STORE).getAll())]);await txDone(tx);const protectedIds=new Set(referencedIds);for(const snap of snaps){for(const a of snap.attachments||[])protectedIds.add(a.id);if(!Array.isArray(snap.attachments))return [];}return files.filter(a=>!protectedIds.has(a.id)).map(a=>a.id);}finally{db.close();}}
export async function listSnapshots(limit=20){const db=await openDb();try{const tx=db.transaction(SNAPSHOT_STORE,'readonly');const all=await reqResult(tx.objectStore(SNAPSHOT_STORE).getAll());await txDone(tx);return (all||[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,limit);}finally{db.close();}}
export async function getSnapshot(id){const db=await openDb();try{const tx=db.transaction(SNAPSHOT_STORE,'readonly');const r=await reqResult(tx.objectStore(SNAPSHOT_STORE).get(id));await txDone(tx);return r||null;}finally{db.close();}}
export async function pruneSnapshots(keep=40){const db=await openDb();try{const tx=db.transaction(SNAPSHOT_STORE,'readwrite');const s=tx.objectStore(SNAPSHOT_STORE);const all=await reqResult(s.getAll());const sorted=(all||[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));sorted.slice(keep).forEach(x=>s.delete(x.id));await txDone(tx);}finally{db.close();}}

export async function putAttachment(record){const db=await openDb();try{const tx=db.transaction(ATTACHMENT_STORE,'readwrite');tx.objectStore(ATTACHMENT_STORE).put(record);await txDone(tx);return record;}finally{db.close();}}
export async function getAttachment(id){const db=await openDb();try{const tx=db.transaction(ATTACHMENT_STORE,'readonly');const r=await reqResult(tx.objectStore(ATTACHMENT_STORE).get(id));await txDone(tx);return r||null;}finally{db.close();}}
export async function listAttachments({transactionId=null,creditorId=null}={}){const db=await openDb();try{const tx=db.transaction(ATTACHMENT_STORE,'readonly');const s=tx.objectStore(ATTACHMENT_STORE);let r;if(transactionId)r=await reqResult(s.index('transactionId').getAll(transactionId));else if(creditorId)r=await reqResult(s.index('creditorId').getAll(creditorId));else r=await reqResult(s.getAll());await txDone(tx);return r||[];}finally{db.close();}}
export async function deleteAttachment(id){const db=await openDb();try{const tx=db.transaction(ATTACHMENT_STORE,'readwrite');tx.objectStore(ATTACHMENT_STORE).delete(id);await txDone(tx);}finally{db.close();}}
export async function exportAllAttachments(){return listAttachments();}
export async function exportLedgerBundle(){const db=await openDb();try{const tx=db.transaction([STATE_STORE,ATTACHMENT_STORE],'readonly');const [record,attachments]=await Promise.all([reqResult(tx.objectStore(STATE_STORE).get('current')),reqResult(tx.objectStore(ATTACHMENT_STORE).getAll())]);await txDone(tx);return {record,attachments};}finally{db.close();}}
export async function replaceAllAttachments(items=[]){const db=await openDb();try{const tx=db.transaction(ATTACHMENT_STORE,'readwrite');const s=tx.objectStore(ATTACHMENT_STORE);s.clear();for(const item of items)s.put(item);await txDone(tx);}finally{db.close();}}

export async function clearLegacyDatabase(){
  try{indexedDB.deleteDatabase('ledgerly.local.v2');}catch{}
}

let channel=null;
export function revisionChannel(callback){
  if(!('BroadcastChannel'in globalThis)) return ()=>{};
  channel=channel||new BroadcastChannel(BC_NAME); const handler=e=>callback?.(e.data); channel.addEventListener('message',handler); return()=>channel.removeEventListener('message',handler);
}
export function broadcastRevision(revision){try{channel=channel||new BroadcastChannel(BC_NAME);channel.postMessage({type:'revision',revision:Number(revision),at:nowIso()});}catch{}}
export async function clearSnapshots(){const db=await openDb();try{const tx=db.transaction(SNAPSHOT_STORE,'readwrite');tx.objectStore(SNAPSHOT_STORE).clear();await txDone(tx);}finally{db.close();}}

export async function saveDraft(record){const db=await openDb();try{const tx=db.transaction(DRAFT_STORE,'readwrite');tx.objectStore(DRAFT_STORE).put(record);await txDone(tx);}finally{db.close();}}
export async function getDraft(id){const db=await openDb();try{const tx=db.transaction(DRAFT_STORE,'readonly');const r=await reqResult(tx.objectStore(DRAFT_STORE).get(id));await txDone(tx);return r||null;}finally{db.close();}}
export async function deleteDraft(id){const db=await openDb();try{const tx=db.transaction(DRAFT_STORE,'readwrite');tx.objectStore(DRAFT_STORE).delete(id);await txDone(tx);}finally{db.close();}}
export async function clearDrafts(){const db=await openDb();try{const tx=db.transaction(DRAFT_STORE,'readwrite');tx.objectStore(DRAFT_STORE).clear();await txDone(tx);}finally{db.close();}}
