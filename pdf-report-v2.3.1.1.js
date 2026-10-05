// Ledgerly Report v2 — dependency-free PDF generator.
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
    .replace(/[^\x20-\x7E]/g,'?');
}
function escPdf(value){return ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function fit(value,max=40){const s=ascii(value);return s.length<=max?s:s.slice(0,Math.max(1,max-3))+'...';}
function txt(x,y,size,value,font='F1'){return `BT /${font} ${size} Tf ${x} ${y} Td (${escPdf(value)}) Tj ET\n`;}
function line(x1,y1,x2,y2,w=.5){return `${w} w ${x1} ${y1} m ${x2} ${y2} l S\n`;}
function box(x,y,w,h,gray=.96){return `${gray} g ${x} ${y} ${w} ${h} re f 0 g\n`;}
function strokeBox(x,y,w,h,width=.6){return `${width} w ${x} ${y} ${w} ${h} re S\n`;}
function pdfDate(iso){
  const d=new Date(iso||Date.now());
  const p=n=>String(n).padStart(2,'0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function header(model,pageIndex,pageCount,title){
  let s='';
  s+=strokeBox(42,786,24,24,.8);s+=txt(50,793,11,'L','F2');
  s+=txt(75,800,10,'LEDGERLY','F2');
  s+=txt(75,783,18,title,'F2');
  s+=txt(42,763,7.5,`${model.generated} | ${model.timezone} | App v${model.version} | Build ${model.build} | Revision ${model.revision}`,'F1');
  s+=txt(42,751,7.5,`Snapshot ${model.reportId} | Currency ${model.currency} | Report format v2`,'F1');
  s+=line(42,742,553,742,.7);
  return s;
}
function footer(model,pageIndex,pageCount){
  let s='';
  s+=line(42,42,553,42,.4);
  s+=txt(42,29,7,model.redacted?'REDACTED REPORT | Ledgerly local encrypted ledger':'PRIVATE & CONFIDENTIAL | Ledgerly local encrypted ledger','F1');
  s+=txt(42,18,6.5,'Personal ledger record only; not creditor confirmation or independent legal proof of debt.','F1');
  s+=txt(476,29,7,`Page ${pageIndex+1} of ${pageCount}`,'F1');
  return s;
}

function makeBuilder(){
  const pages=[];let body=[];let y=720;
  const push=()=>{pages.push(body);body=[];y=720;};
  const ensure=(need=20)=>{if(y-need<58)push();};
  const write=(value,{x=42,size=8,font='F1',gap=13,max=90}={})=>{ensure(gap);body.push(txt(x,y,size,fit(value,max),font));y-=gap;};
  const rule=()=>{ensure(8);body.push(line(42,y,553,y,.25));y-=8;};
  const spacer=(h=8)=>{ensure(h);y-=h;};
  return {pages,get y(){return y;},set y(v){y=v;},push,ensure,write,rule,spacer,add:cmd=>body.push(cmd)};
}

function summaryBlock(b,model){
  b.ensure(112);
  b.add(box(42,626,511,96,.95));
  b.add(txt(54,704,7,'TOTAL ORIGINAL DEBT','F1'));b.add(txt(54,685,14,model.summary.original,'F2'));
  b.add(txt(188,704,7,'PAID','F1'));b.add(txt(188,685,14,model.summary.paid,'F2'));
  b.add(txt(307,704,7,'WAIVED / ADJ.','F1'));b.add(txt(307,685,10,model.summary.waivedAdjusted,'F2'));
  b.add(txt(430,704,7,'REMAINING','F1'));b.add(txt(430,685,14,model.summary.remaining,'F2'));
  b.add(txt(54,656,7.5,`Reconciliation: ${model.summary.equation}`,'F2'));
  b.add(txt(54,640,7.2,`${model.counts.creditors} creditors | ${model.counts.transactions} transactions | ${model.counts.active} active | ${model.counts.completed} paid`,'F1'));
  b.y=607;
}

function healthBlock(b,model){
  b.write('Integrity & data quality',{size:11,font:'F2',gap:18});
  const h=`Reconciliation: ${model.health.reconciliation} | Audit chain: ${model.health.audit} | Diagnostics: ${model.health.diagnostics}`;
  b.write(h,{size:7.5,max:100});
  const q=`Estimated: ${model.quality.estimated} | Disputed: ${model.quality.disputed} | Legacy without evidence: ${model.quality.legacyNoEvidence} | Missing evidence: ${model.quality.missingEvidence}`;
  b.write(q,{size:7.5,max:105});
  if(model.scopeText)b.write(`Scope: ${model.scopeText}`,{size:7.2,max:105});
  b.spacer(3);b.rule();
}

function creditorTable(b,model){
  b.write('Creditor summary',{size:11,font:'F2',gap:18});
  const widths=[150,65,62,68,60,58,48];
  const heads=['Creditor','Original','Paid','Remaining','Status','Due','Progress'];
  const row=(vals,bold=false)=>{b.ensure(17);let x=42;vals.forEach((v,i)=>{b.add(txt(x,b.y,7,fit(v,i===0?27:14),bold?'F2':'F1'));x+=widths[i];});b.add(line(42,b.y-5,553,b.y-5,.22));b.y-=17;};
  row(heads,true);
  for(const c of model.creditors){row([c.name,c.original,c.paid,c.remaining,c.status,c.nextDue,c.progress],false);}
  row(['TOTAL',model.summary.original,model.summary.paid,model.summary.remaining,'','',''],true);
  b.spacer(8);
}

function detailTransactions(b,model){
  b.write('Transaction detail',{size:11,font:'F2',gap:18});
  b.write(`Sorted: ${model.orderLabel} | Transaction range: ${model.transactionRange}`,{size:7.3,max:105});
  b.spacer(2);b.rule();
  for(const tx of model.transactions){
    b.ensure(tx.note?64:50);
    b.write(`${tx.effectiveDate} | Recorded ${tx.recordedAt} | ${tx.shortId} | ${tx.type} | ${tx.amount}`,{size:7.5,font:'F2',gap:13,max:105});
    b.write(`${tx.creditor} | ${tx.category} | ${tx.quality} | Evidence: ${tx.evidence}`,{size:7.1,gap:12,max:105});
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
  if(model.reportType!=='summary')detailTransactions(b,model);
  return finalizeBuilder(b);
}

function pdfBytes(pageContents,model,title){
  const objects=[];const add=s=>{objects.push(s);return objects.length;};
  const catalog=add('');const pagesObj=add('');
  const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const info=add(`<< /Title (${escPdf(title)}) /Author (Ledgerly) /Creator (Ledgerly Report v2) /Subject (${escPdf(model.scopeText)}) /Keywords (Ledgerly debt ledger report ${escPdf(model.reportId)}) /CreationDate (${pdfDate(model.generatedIso)}) >>`);
  const pageIds=[];
  for(let i=0;i<pageContents.length;i++){
    const content=header(model,i,pageContents.length,title)+pageContents[i].join('')+footer(model,i,pageContents.length);
    const stream=add(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);
    const page=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${stream} 0 R >>`);pageIds.push(page);
  }
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let out='%PDF-1.4\n%Ledgerly Report v2\n';const offsets=[0];
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
