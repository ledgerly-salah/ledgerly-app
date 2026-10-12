import {pdfText,addUnicodeFonts,textWidth} from './pdf-unicode.3.1.1.js';
// Ledgerly Report v3 — dependency-free PDF generator.
// Uses built-in PDF Helvetica fonts and stays fully offline.
const enc=new TextEncoder();

function ascii(value){
  return String(value??'')
    .replace(/[\u2010-\u2015\u2212]/g,'-')
    .replace(/[\u00B7\u2022]/g,'|')
    .replace(/[\u2018\u2019]/g,"'")
    .replace(/[\u201C\u201D]/g,'"')
    .replace(/\u00A0/g,' ')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[\r\n\t]/g,' ');
}
function escPdf(value){return ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function fit(value,max=40){const s=ascii(value);return s.length<=max?s:s.slice(0,Math.max(1,max-3))+'...';}
function txt(x,y,size,value,font='F1'){const p=pdfText(ascii(value),font);return `BT /${p.font} ${size} Tf ${x} ${y} Td ${p.token} Tj ET\n`;}
function refTxt(x,y,size,value){return `0.72 0.08 0.08 rg BT /F2 ${size} Tf ${x} ${y} Td (${escPdf(value)}) Tj ET 0 g\n`;}
function line(x1,y1,x2,y2,w=.5){return `${w} w ${x1} ${y1} m ${x2} ${y2} l S\n`;}
function box(x,y,w,h,gray=.96){return `${gray} g ${x} ${y} ${w} ${h} re f 0 g\n`;}
function strokeBox(x,y,w,h,width=.6){return `${width} w ${x} ${y} ${w} ${h} re S\n`;}
function pdfDate(iso){
  const d=new Date(iso||Date.now());
  const p=n=>String(n).padStart(2,'0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}
function issueMeta(model){
  const d=new Date(model.generatedIso||Date.now());
  const date=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d);
  const time=new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}).format(d).replace(/^0/,'').toUpperCase();
  const ref=String(model.issueRef||'?-0000');
  return {ref,date,time};
}
function watermark(){return `0.955 g BT /F2 34 Tf 0.707 0.707 -0.707 0.707 125 292 Tm (STRICTLY CONFIDENTIAL) Tj ET 0 g\n`;}

function header(model,pageIndex,pageCount,title){
  const meta=issueMeta(model);let s='';
  s+=strokeBox(42,786,24,24,.8);s+=txt(50,793,11,'L','F2');
  s+=txt(75,800,10,'LEDGERLY','F2');
  s+=txt(75,783,18,title,'F2');
  s+=refTxt(42,763,8.3,`Ref: ${meta.ref}`);
  s+=txt(116,763,7.8,`| Issue Date: ${meta.date} | Issue Time: ${meta.time} | ${model.timezone}`,'F1');
  s+=txt(42,751,7.5,`App v${model.version} | Ledger Rev. ${model.revision} | Currency ${model.currency} | Report format ${model.reportFormat||'3'}`,'F1');
  s+=txt(42,739,7.5,`Template ${model.templateRevision||'Ledger v3'} | Build ${model.build}`,'F1');
  s+=line(42,730,553,730,.7);
  return s;
}
function footer(model,pageIndex,pageCount){
  const meta=issueMeta(model);let s='';
  s+=line(42,42,553,42,.4);
  s+=txt(42,29,7,model.redacted?'REDACTED REPORT | STRICTLY CONFIDENTIAL':'STRICTLY CONFIDENTIAL | Ledgerly local encrypted ledger','F1');
  s+=refTxt(330,29,7,`Ref ${meta.ref}`);
  s+=txt(42,18,6.5,'Personal ledger record only; not creditor confirmation or independent legal proof of debt.','F1');
  s+=txt(476,29,7,`Page ${pageIndex+1} of ${pageCount}`,'F1');
  return s;
}

function makeBuilder(){
  const pages=[];let body=[];let y=720;
  const push=()=>{pages.push(body);body=[];y=720;};
  const ensure=(need=20)=>{if(y-need<58)push();};
  const write=(value,{x=42,size=8,font='F1',gap=13,max=90}={})=>{const words=ascii(value).split(/\s+/);let line='';const emit=()=>{if(!line)return;ensure(gap);body.push(txt(x,y,size,line,font));y-=gap;line='';};for(const word of words){if(line&&(line.length+word.length+1>max||textWidth(line+' '+word,size,font==='F2')>553-x)){emit();}for(const ch of word){if(line.length>=max||textWidth(line+ch,size,font==='F2')>553-x)emit();line+=ch;}line+=' ';}emit();};
  const rule=()=>{ensure(8);body.push(line(42,y,553,y,.25));y-=8;};
  const spacer=(h=8)=>{ensure(h);y-=h;};
  return {pages,get y(){return y;},set y(v){y=v;},push,ensure,write,rule,spacer,add:cmd=>body.push(cmd)};
}

function summaryBlock(b,model){
  b.ensure(112);
  b.add(box(42,626,511,96,.95));
  b.add(txt(54,704,7,'TOTAL ORIGINAL DEBT','F1'));b.add(txt(54,685,14,model.summary.original,'F2'));
  b.add(txt(188,704,7,'PAID','F1'));b.add(txt(188,685,14,model.summary.paid,'F2'));
  b.add(txt(307,704,7,'WAIVED / ADJ.','F1'));
  b.add(txt(307,689,8.5,`W ${model.summary.waived||'SAR 0.00'}`,'F2'));
  b.add(txt(307,676,8.5,`A ${model.summary.adjustment||model.summary.waivedAdjusted}`,'F2'));
  b.add(txt(430,704,7,'REMAINING','F1'));b.add(txt(430,685,14,model.summary.remaining,'F2'));
  b.add(txt(54,656,7.5,`Reconciliation: ${model.summary.equation}`,'F2'));
  b.add(txt(54,640,7.2,`${model.counts.creditors} creditors | ${model.counts.transactions} transactions | ${model.counts.active} open creditors | ${model.counts.completed} fully paid`,'F1'));
  b.y=607;
}

function healthBlock(b,model){
  b.write('Integrity & data quality',{size:11,font:'F2',gap:18});
  const h=`Reconciliation: ${model.health.reconciliation} | Audit chain: ${model.health.audit} | Diagnostics: ${model.health.diagnostics}`;
  b.write(h,{size:7.5,max:100});
  const q=`Estimated: ${model.quality.estimated} | Disputed: ${model.quality.disputed} | Legacy records without attachments: ${model.quality.legacyNoEvidence} | Missing evidence: ${model.quality.missingEvidence}`;
  b.write(q,{size:7.5,max:110});
  if(model.scopeText)b.write(`Scope: ${model.scopeText}`,{size:7.2,max:105});
  b.spacer(3);b.rule();
}

function creditorTable(b,model){
  b.write('Creditor summary',{size:11,font:'F2',gap:17});
  b.write(`Amounts in ${model.currency||'SAR'} | Net adjustments exclude waivers`,{size:7.2,gap:17});
  const widths=[140,58,58,58,65,60,36,36];
  const heads=['Creditor','Original','Net adj.','Paid','Remaining','Status','Due','Cleared'];
  const numberText=v=>String(v??'').replace(/SAR\s*/g,'');
  const row=(vals,bold=false)=>{
    const name=ascii(vals[0]);const cut=name.length>28?name.lastIndexOf(' ',28):-1;
    const names=cut>0?[name.slice(0,cut),name.slice(cut+1)]:[name];
    const height=names.length>1?27:19;b.ensure(height);let x=42;
    vals.forEach((value,i)=>{
      let v=i>=1&&i<=4?numberText(value):String(value??'');
      if(i===0){names.forEach((part,j)=>b.add(txt(x,b.y-j*10,7.2,fit(part,32),bold?'F2':'F1')));}
      else if(i>=1&&i<=4&&v==='REDACTED'){b.add(txt(x+3,b.y,6.8,v,bold?'F2':'F1'));}
      else if(i>=1&&i<=4){const w=[...v].reduce((n,c)=>n+(c==='.'||c===','?.278:c==='-'?.333:c==='+'?.584:.556),0)*7.2;b.add(txt(x+widths[i]-6-w,b.y,7.2,v,bold?'F2':'F1'));}
      else b.add(txt(x,b.y,i===6?6:7.2,fit(i===6?v.replace(/ (\d{4})$/,''):v,i===5?14:12),bold?'F2':'F1'));
      x+=widths[i];
    });
    b.add(line(42,b.y-height+10,553,b.y-height+10,.22));b.y-=height;
  };
  const heading=()=>{let x=42;heads.forEach((h,i)=>{b.add(txt(x,b.y,7.2,h,'F2'));x+=widths[i];});b.add(line(42,b.y-5,553,b.y-5,.3));b.y-=19;};
  heading();
  for(const c of model.creditors){if(b.y-27<58){b.push();heading();}row([c.name,c.original,c.adjustment,c.paid,c.remaining,c.status,c.nextDue,c.progress]);}
  if(b.y-19<58){b.push();heading();}
  row(['TOTAL',model.summary.original,model.summary.adjustment,model.summary.paid,model.summary.remaining,'','',''],true);
  b.spacer(8);
}

function debtCategoryMap(model){
  const map=new Map();
  for(const tx of model.transactions||[]){
    if(!String(tx.type||'').startsWith('Debt'))continue;
    const category=String(tx.category||'').trim();if(!category||category==='Personal')continue;
    if(!map.has(tx.creditor))map.set(tx.creditor,new Set());map.get(tx.creditor).add(category);
  }
  return map;
}
function displayCategory(tx,categoryMap){
  const current=String(tx.category||'Personal');
  if((String(tx.type||'').startsWith('Payment')||String(tx.type||'').startsWith('Waiver'))&&current==='Personal'){
    const categories=categoryMap.get(tx.creditor);if(categories?.size===1)return [...categories][0];
  }
  return current;
}
function displayEffectiveDate(tx){
  const legacy=String(tx.evidence||'').startsWith('Legacy');
  const sameRecordedDate=String(tx.recordedAt||'').startsWith(String(tx.effectiveDate||''));
  if(String(tx.type||'').startsWith('Debt')&&legacy&&sameRecordedDate)return 'Opening balance (date not set)';
  return tx.effectiveDate;
}
function displayEvidence(tx){
  return String(tx.evidence||'').startsWith('Legacy - no evidence')?'Legacy - no attachment':tx.evidence;
}

function detailTransactions(b,model){
  b.write('Transaction detail',{size:11,font:'F2',gap:18});
  b.write(`Sorted: ${model.orderLabel} | Transaction range: ${model.transactionRange}`,{size:7.3,max:105});
  b.spacer(2);b.rule();
  const categoryMap=debtCategoryMap(model);
  for(const tx of model.transactions){
    b.ensure(tx.note?64:50);
    b.write(`${displayEffectiveDate(tx)} | Recorded ${tx.recordedAt} | ${tx.shortId} | ${tx.type} | ${tx.amount}`,{size:7.5,font:'F2',gap:13,max:105});
    b.write(`${tx.creditor} | ${displayCategory(tx,categoryMap)} | ${tx.quality} | Evidence: ${displayEvidence(tx)}`,{size:7.1,gap:12,max:105});
    const refs=[tx.method?`Method: ${tx.method}`:'',tx.reference?`Ref: ${tx.reference}`:'',tx.allocation?`Allocation: ${tx.allocation}`:''].filter(Boolean).join(' | ');
    if(refs)b.write(refs,{size:6.8,gap:11,max:110});
    if(tx.note)b.write(`Note: ${tx.note}`,{size:6.8,gap:11,max:110});
    if(tx.verification)b.write(`Verification: ${tx.verification}`,{size:6.7,gap:11,max:110});
    b.rule();
  }
}

function finalizeBuilder(b){
  b.push();
  while(b.pages.length>1 && b.pages[b.pages.length-1].length===0)b.pages.pop();
  return b.pages;
}
function buildRawPages(model){
  const b=makeBuilder();summaryBlock(b,model);healthBlock(b,model);creditorTable(b,model);
  if(model.reportType!=='summary'){
    if(b.y<720)b.push();
    detailTransactions(b,model);
  }
  return finalizeBuilder(b);
}

function pdfBytes(pageContents,model,title){
  const objects=[];const add=s=>{objects.push(s);return objects.length;};
  const catalog=add('');const pagesObj=add('');
  const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const unicodeFonts=addUnicodeFonts(add);const info=add(`<< /Title (${escPdf(title)}) /Author (Ledgerly) /Creator (Ledgerly Report v3) /Subject (${escPdf(model.scopeText)}) /Keywords (Ledgerly debt ledger report Ref ${escPdf(model.issueRef||'')} ${escPdf(model.reportId)}) /CreationDate (${pdfDate(model.generatedIso)}) >>`);
  const pageIds=[];
  for(let i=0;i<pageContents.length;i++){
    const content=watermark()+header(model,i,pageContents.length,title)+pageContents[i].join('')+footer(model,i,pageContents.length);
    const stream=add(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);
    const page=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R /F3 ${unicodeFonts[0]} 0 R /F4 ${unicodeFonts[1]} 0 R >> >> /Contents ${stream} 0 R >>`);pageIds.push(page);
  }
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let out='%PDF-1.4\n%Ledgerly Report v3\n';const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets[i+1]=enc.encode(out).length;out+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=enc.encode(out).length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  out+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return enc.encode(out);
}

export function buildLedgerReportPdf(model){
  const title=model.reportType==='summary'?'Personal Debt Summary':model.redacted?'Redacted Debt Ledger':'Detailed Personal Debt Ledger';
  return pdfBytes(buildRawPages(model),model,title);
}

