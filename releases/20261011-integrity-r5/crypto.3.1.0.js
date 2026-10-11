import { APP_VERSION, validateAttachments } from './ledger-core.3.1.0.js';

const enc=new TextEncoder(); const dec=new TextDecoder();
export const SECURITY_VERSION=2;
export const DEFAULT_ITERATIONS=420000;
export const RECOVERY_ITERATIONS=260000;

function b64(bytes){ const data=new Uint8Array(bytes);const parts=[];for(let i=0;i<data.length;i+=16384)parts.push(String.fromCharCode(...data.subarray(i,i+16384)));return btoa(parts.join('')); }
function unb64(value){ return Uint8Array.from(atob(String(value||'')),c=>c.charCodeAt(0)); }
function b64url(bytes){ return b64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function unb64url(value){ let s=String(value||'').replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return unb64(s); }
export { b64 as bytesToBase64, unb64 as base64ToBytes };

export async function sha256Bytes(bytes){ const h=await crypto.subtle.digest('SHA-256',bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)); return new Uint8Array(h); }
export async function sha256Text(text){ return b64url(await sha256Bytes(enc.encode(String(text)))); }

export async function deriveKek(secret,salt,iterations=DEFAULT_ITERATIONS){
  const material=await crypto.subtle.importKey('raw',enc.encode(String(secret)),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function importDek(rawBytes){ return crypto.subtle.importKey('raw',rawBytes,{name:'AES-GCM'},true,['encrypt','decrypt']); }
export function randomBytes(n){ const a=new Uint8Array(n); crypto.getRandomValues(a); return a; }

async function wrapDekRaw(dekRaw,kek){ const iv=randomBytes(12); const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},kek,dekRaw); return {iv:b64(iv),data:b64(data)}; }
async function unwrapDekRaw(wrapped,kek){ const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(wrapped.iv)},kek,unb64(wrapped.data)); return new Uint8Array(raw); }

export async function createSecurity(password,{withRecovery=true,autoLockMinutes=15,lockOnBackground=true}={}){
  if(String(password).length<8) throw new Error('Use at least 8 characters.');
  const dekRaw=randomBytes(32); const dek=await importDek(dekRaw);
  const salt=randomBytes(16); const kek=await deriveKek(password,salt,DEFAULT_ITERATIONS); const wrapped=await wrapDekRaw(dekRaw,kek);
  let recovery=null, recoveryKey=null;
  if(withRecovery){
    recoveryKey=`LDG-${b64url(randomBytes(24)).match(/.{1,6}/g).join('-')}`;
    const rsalt=randomBytes(16); const rkek=await deriveKek(recoveryKey,rsalt,RECOVERY_ITERATIONS); const rwrapped=await wrapDekRaw(dekRaw,rkek);
    recovery={kdf:'PBKDF2-SHA256',iterations:RECOVERY_ITERATIONS,salt:b64(rsalt),wrappedDek:rwrapped};
  }
  return { dek, recoveryKey, security:{version:SECURITY_VERSION,kdf:'PBKDF2-SHA256',iterations:DEFAULT_ITERATIONS,salt:b64(salt),wrappedDek:wrapped,recovery,autoLockMinutes:Number(autoLockMinutes)||15,lockOnBackground:Boolean(lockOnBackground),createdAt:new Date().toISOString(),createdByVersion:APP_VERSION} };
}

export async function unlockSecurity(security,secret,{recovery=false}={}){
  if(Number(security?.version)!==SECURITY_VERSION) throw new Error('Unsupported security envelope.');
  const source=recovery?security.recovery:security; if(!source) throw new Error('Recovery is not configured.');
  const salt=unb64(source.salt); const kek=await deriveKek(secret,salt,Number(source.iterations)||DEFAULT_ITERATIONS);
  const raw=await unwrapDekRaw(source.wrappedDek,kek); return importDek(raw);
}

export async function encryptJson(value,dek){ const iv=randomBytes(12); const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},dek,enc.encode(JSON.stringify(value))); return {version:2,alg:'AES-GCM',iv:b64(iv),data:b64(data)}; }
export async function decryptJson(envelope,dek){ const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv)},dek,unb64(envelope.data)); return JSON.parse(dec.decode(plain)); }

function attachmentAad(meta){return enc.encode(stableStringify({format:2,id:meta.id,transactionId:meta.transactionId,creditorId:meta.creditorId,name:meta.name||'',type:meta.type||'',size:Number(meta.size),createdAt:meta.createdAt||'',digest:meta.digest}));}
export async function encryptAttachmentRecord(meta,bytes,dek){
  const ab=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const bound={...meta,cryptoVersion:2,size:ab.byteLength,digest:b64url(await sha256Bytes(ab))};
  const iv=randomBytes(12);const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:attachmentAad(bound)},dek,ab);
  return {...bound,encrypted:true,iv:b64(iv),data:b64(data),updatedAt:new Date().toISOString()};
}
export async function decryptAttachmentBytes(record,dek){
  if(!record.encrypted){if(record.cryptoVersion===2)throw new Error('Attachment encryption downgrade rejected.');return unb64(record.data||'').buffer;}
  if(record.cryptoVersion!==undefined&&record.cryptoVersion!==2)throw new Error('Unsupported attachment protection.');
  const algorithm={name:'AES-GCM',iv:unb64(record.iv)};
  if(record.cryptoVersion===2)algorithm.additionalData=attachmentAad(record);
  const bytes=await crypto.subtle.decrypt(algorithm,dek,unb64(record.data));
  if(record.cryptoVersion===2&&(bytes.byteLength!==Number(record.size)||b64url(await sha256Bytes(bytes))!==record.digest))throw new Error('Attachment integrity check failed.');
  return bytes;
}
// Legacy evidence is authenticated and rebound before the manifest is persisted.
// Once present, the encrypted ledger manifest prevents envelope downgrade/substitution.
export async function secureEvidence(state,attachments,key,{migrate=true,allowFormatUpgrade=false}={}){
  validateAttachments({...state,evidence:undefined},attachments);
  for(const a of attachments){const bound=state.evidence?.[a.id];if(bound&&(!allowFormatUpgrade&&(bound.format!==(a.cryptoVersion||0))||bound.digest!==a.digest))throw new Error('Attachment does not match protected evidence.');}
  const files=[];const manifest={};const referenced=new Set(state.transactions.flatMap(t=>t.attachmentIds||[]));
  for(const a of attachments){
    const bytes=new Uint8Array(await decryptAttachmentBytes(a,key));
    try{
      const digest=b64url(await sha256Bytes(bytes));
      if(state.evidence?.[a.id]?.digest&&state.evidence[a.id].digest!==digest)throw new Error('Attachment content differs from the protected ledger.');
      const secured=migrate&&key&&(!a.encrypted||a.cryptoVersion!==2)?await encryptAttachmentRecord(a,bytes,key):(!a.encrypted?{...a,digest,cryptoVersion:0}:a);
      files.push(secured);if(referenced.has(a.id))manifest[a.id]={digest,format:secured.cryptoVersion||0};
    }finally{bytes.fill(0);}
  }
  if(migrate)state.evidence=manifest;
  return files;
}
export async function prepareKeyRotation({state,attachments,snapshots,oldKey,oldSecurity,newPassword,session}){
  const fresh=await createSecurity(newPassword,{withRecovery:Boolean(oldSecurity.recovery),autoLockMinutes:oldSecurity.autoLockMinutes,lockOnBackground:oldSecurity.lockOnBackground});session.assert();
  const rotateFiles=async(ledger,files)=>{
    await secureEvidence(ledger,files,oldKey,{migrate:false});session.assert();const result=[];
    for(const a of files){const bytes=new Uint8Array(await decryptAttachmentBytes(a,oldKey));try{session.assert();result.push(await encryptAttachmentRecord(a,bytes,fresh.dek));}finally{bytes.fill(0);}session.assert();}
    await secureEvidence(ledger,result,fresh.dek,{allowFormatUpgrade:true});session.assert();return result;
  };
  const newAttachments=await rotateFiles(state,attachments),newSnapshots=[];
  for(const snap of snapshots){
    const ledger=snap.record.encrypted?await decryptJson(snap.record.envelope,oldKey):structuredClone(snap.record.payload);session.assert();
    const files=await rotateFiles(ledger,Array.isArray(snap.attachments)?snap.attachments:attachments);
    newSnapshots.push({...snap,record:{...snap.record,encrypted:true,payload:null,security:fresh.security,envelope:await encryptJson(ledger,fresh.dek)},attachments:files});session.assert();
  }
  return {...fresh,newAttachments,newSnapshots,envelope:await encryptJson(state,fresh.dek)};
}
export function plainAttachmentRecord(meta,bytes){ return {...meta,encrypted:false,iv:null,data:b64(bytes),size:Number(meta.size||bytes.byteLength),updatedAt:new Date().toISOString()}; }

export async function legacyDecrypt(envelope,password){
  const salt=unb64(envelope.salt); const material=await crypto.subtle.importKey('raw',enc.encode(String(password)),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(envelope.iv)},key,unb64(envelope.data)); return JSON.parse(dec.decode(plain));
}

export async function checksumObject(obj){
  const clone=JSON.parse(JSON.stringify(obj)); delete clone.checksum; return sha256Text(stableStringify(clone));
}
export function stableStringify(value){
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(stableStringify).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
}

export function recoveryDisplay(key){ return String(key||'').replace(/(.{18})/g,'$1\n'); }
