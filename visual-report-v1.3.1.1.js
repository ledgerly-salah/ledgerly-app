// Ledgerly Visual Financial Snapshot v1 — dependency-free vector PDF generator.
// Fully offline; uses built-in PDF Helvetica fonts and native vector charts.
const enc=new TextEncoder();

const P={
  ink:'#12362F',muted:'#687A75',green:'#0F5B4B',mint:'#2EA67D',mintSoft:'#DDF3EA',
  red:'#C95A5A',redSoft:'#F8E5E3',amber:'#C58B2A',amberSoft:'#FAF0D9',blue:'#4D78A8',
  blueSoft:'#E6EEF8',violet:'#735F9E',teal:'#3F8F91',line:'#DDE5E2',panel:'#F5F8F7',white:'#FFFFFF',black:'#1E2926'
};
const CAT=[P.green,P.mint,P.blue,P.amber,P.violet,P.teal,P.red,'#6E8B74','#9B785A','#6D7785'];

function ascii(value){
  return String(value??'')
    .replace(/[\u2010-\u2015\u2212]/g,'-').replace(/[\u00B7\u2022]/g,'|')
    .replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u00A0/g,' ')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?');
}
function escPdf(value){return ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function fit(value,max=42){const s=ascii(value);return s.length<=max?s:s.slice(0,Math.max(1,max-3))+'...';}
function splitLabel(value,max=24){
  const s=ascii(value);if(s.length<=max)return [s];
  const cut=s.lastIndexOf(' ',max);if(cut<8)return [fit(s,max+8)];
  return [s.slice(0,cut),fit(s.slice(cut+1),max+8)];
}
function rgb(hex){const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255].map(x=>x.toFixed(3)).join(' ');}
function fill(hex){return `${rgb(hex)} rg\n`;}
function stroke(hex){return `${rgb(hex)} RG\n`;}
function txt(x,y,size,value,font='F1',color=P.ink){return `${fill(color)}BT /${font} ${size} Tf ${x} ${y} Td (${escPdf(value)}) Tj ET\n`;}
function line(x1,y1,x2,y2,w=.5,color=P.line){return `${stroke(color)}${w} w ${x1} ${y1} m ${x2} ${y2} l S\n`;}
function rect(x,y,w,h,color,strokeColor=null,sw=.6){let s=`${fill(color)}${x} ${y} ${w} ${h} re f\n`;if(strokeColor)s+=`${stroke(strokeColor)}${sw} w ${x} ${y} ${w} ${h} re S\n`;return s;}
function circlePath(cx,cy,r){const k=.5522847498*r;return `${cx+r} ${cy} m ${cx+r} ${cy+k} ${cx+k} ${cy+r} ${cx} ${cy+r} c ${cx-k} ${cy+r} ${cx-r} ${cy+k} ${cx-r} ${cy} c ${cx-r} ${cy-k} ${cx-k} ${cy-r} ${cx} ${cy-r} c ${cx+k} ${cy-r} ${cx+r} ${cy-k} ${cx+r} ${cy} c`;}
function circle(cx,cy,r,color){return `${fill(color)}${circlePath(cx,cy,r)} f\n`;}
function arcPath(cx,cy,r,startDeg,endDeg){
  const rad=d=>d*Math.PI/180;let start=rad(startDeg),end=rad(endDeg);const total=end-start;const segs=Math.max(1,Math.ceil(Math.abs(total)/(Math.PI/2)));const step=total/segs;
  let a=start;let x0=cx+r*Math.cos(a),y0=cy+r*Math.sin(a);let out=`${x0.toFixed(2)} ${y0.toFixed(2)} m `;
  for(let i=0;i<segs;i++){
    const b=a+step,k=4/3*Math.tan((b-a)/4);const x1=cx+r*Math.cos(a),y1=cy+r*Math.sin(a),x4=cx+r*Math.cos(b),y4=cy+r*Math.sin(b);
    const c1x=x1-k*r*Math.sin(a),c1y=y1+k*r*Math.cos(a),c2x=x4+k*r*Math.sin(b),c2y=y4-k*r*Math.cos(b);
    out+=`${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${x4.toFixed(2)} ${y4.toFixed(2)} c `;a=b;
  }
  return out;
}
function strokeArc(cx,cy,r,start,end,width,color){return `${stroke(color)}${width} w 1 J ${arcPath(cx,cy,r,start,end)} S\n0 J `;}
function donut(cx,cy,r,pct,centerTop,centerBottom){
  const p=Math.max(0,Math.min(100,Number(pct||0)));let s=strokeArc(cx,cy,r,0,360,13,P.line);if(p>0)s+=strokeArc(cx,cy,r,-90,-90+360*p/100,13,P.mint);
  s+=txt(cx-22,cy+2,15,`${p.toFixed(1)}%`,'F2',P.green);s+=txt(cx-24,cy-15,7,centerBottom||'paid','F1',P.muted);if(centerTop)s+=txt(cx-28,cy+24,6.8,fit(centerTop,16),'F1',P.muted);return s;
}
function progressBar(x,y,w,h,pct,fg=P.mint,bg=P.line){const p=Math.max(0,Math.min(100,Number(pct||0)));let s=rect(x,y,w,h,bg);if(p>0)s+=rect(x,y,w*p/100,h,fg);return s;}
function moneyNum(v){return Number(v||0)/100;}
function fullMoney(v){return `SAR ${moneyNum(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function signedMoney(v){const n=Number(v||0);return `${n>0?'+':n<0?'-':''}${fullMoney(Math.abs(n))}`;}
function reconciliationText(v){
  const adj=Number(v.raw.liability||0)-Number(v.raw.original||0);const parts=[fullMoney(v.raw.original)];
  if(adj!==0)parts.push(`${adj>0?'+':'-'} ${fullMoney(Math.abs(adj))}`);
  parts.push(`- ${fullMoney(v.raw.reductions)} = ${fullMoney(v.raw.remaining)}`);return parts.join(' ');
}
function shortMoney(v){const n=moneyNum(v);if(Math.abs(n)>=1000000)return `SAR ${(n/1000000).toFixed(1)}m`;if(Math.abs(n)>=1000)return `SAR ${(n/1000).toFixed(n>=10000?0:1)}k`;return `SAR ${n.toFixed(0)}`;}
function monthLabel(v){const [y,m]=String(v||'').split('-');const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return m?`${names[Number(m)-1]} ${String(y).slice(2)}`:v;}
function issueMeta(model){
  const d=new Date(model.generatedIso||Date.now());
  const date=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d);
  const time=new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}).format(d).replace(/^0/,'').toUpperCase();
  const seed=`${model.reportId||''}|${model.reportType||''}|${model.generatedIso||''}`;let h=0;
  for(let i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))>>>0;
  return {ref:String(1000+(h%9000)),date,time};
}
function watermark(){return `0.92 g BT /F2 42 Tf 0.707 0.707 -0.707 0.707 105 270 Tm (STRICTLY CONFIDENTIAL) Tj ET 0 g\n`;}

function header(model,title,subtitle=''){
  const meta=issueMeta(model);let s=rect(0,766,595,76,P.green);s+=txt(42,811,9,'LEDGERLY','F2',P.white);s+=txt(42,786,20,title,'F2',P.white);if(subtitle)s+=txt(42,772,7.2,`${subtitle} | ${model.timezone}`,'F1','#D6E9E2');
  s+=txt(408,810,6.5,`Ref: ${meta.ref}`,'F2','#D6E9E2');s+=txt(408,798,6.5,`Issuing Date: ${meta.date}`,'F1','#D6E9E2');s+=txt(408,786,6.5,`Issuing Time: ${meta.time}`,'F1','#D6E9E2');return s;
}
function footer(model,pageIndex,pageCount){const meta=issueMeta(model);let s=line(42,39,553,39,.4,P.line);s+=txt(42,24,6.5,`STRICTLY CONFIDENTIAL | Ref ${meta.ref} | Revision ${model.revision} | Build ${model.build}`,'F1',P.muted);s+=txt(481,24,6.5,`Page ${pageIndex+1} of ${pageCount}`,'F1',P.muted);return s;}
function card(x,y,w,h,label,value,{accent=P.green,soft=P.panel,valueSize=15}={}){let s=rect(x,y,w,h,soft,P.line,.35);s+=rect(x,y,w,4,accent);s+=txt(x+12,y+h-20,7,label.toUpperCase(),'F2',P.muted);s+=txt(x+12,y+16,valueSize,fit(value,24),'F2',P.ink);return s;}
function sectionTitle(y,title,sub=''){let s=txt(42,y,12,title,'F2',P.ink);if(sub)s+=txt(42,y-13,7,sub,'F1',P.muted);return s;}
function hBar(x,y,w,label,value,max,color=P.green,valueLabel=''){
  const ratio=max>0?Math.max(0,Math.min(1,value/max)):0;const labels=splitLabel(label,25);let s='';
  if(labels.length===1)s+=txt(x,y+9,7.2,labels[0],'F1',P.black);else{s+=txt(x,y+17,7,labels[0],'F1',P.black);s+=txt(x,y+9,7,labels[1],'F1',P.black);}
  s+=txt(x+w-64,y+9,7,valueLabel||shortMoney(value),'F2',P.ink);s+=rect(x,y,w,7,'#E8EFEC');if(ratio>0)s+=rect(x,y,w*ratio,7,color);return s;
}
function statusPill(x,y,label,count,color,soft){let s=rect(x,y,150,42,soft);s+=circle(x+18,y+21,5,color);s+=txt(x+31,y+25,7,label,'F2',P.muted);s+=txt(x+31,y+10,13,String(count),'F2',P.ink);return s;}

function pageOne(model){
  const v=model.visual,s=[];s.push(header(model,'Visual Financial Snapshot','Executive debt position and repayment progress'));
  // Hero
  s.push(rect(42,603,511,137,P.ink));s.push(txt(60,710,8,'TOTAL REMAINING','F2','#BFE2D5'));s.push(txt(60,670,29,model.summary.remaining,'F2',P.white));s.push(txt(60,646,8,`${v.repaymentPct.toFixed(1)}% repaid | ${v.statusCounts.open} open creditors`,'F1','#D8E7E2'));
  s.push(donut(472,671,42,v.repaymentPct,'REPAYMENT','repaid'));
  // KPI cards: original + net adjustments - reductions = remaining
  const netAdjustments=Number(v.raw.liability||0)-Number(v.raw.original||0);
  s.push(card(42,525,118,60,'Original debt',model.summary.original,{accent:P.blue,soft:P.blueSoft,valueSize:11}));
  s.push(card(174,525,118,60,'Net adjustments',signedMoney(netAdjustments),{accent:P.amber,soft:P.amberSoft,valueSize:11}));
  s.push(card(306,525,118,60,'Paid',model.summary.paid,{accent:P.mint,soft:P.mintSoft,valueSize:11}));
  s.push(card(438,525,115,60,'Open creditors',String(v.statusCounts.open),{accent:P.red,soft:P.redSoft,valueSize:13}));
  s.push(txt(42,507,7,`Reconciliation: ${reconciliationText(v)}`,'F2',P.ink));
  s.push(sectionTitle(486,'Repayment progress','Paid and other reductions against current liability'));
  s.push(progressBar(42,450,511,13,v.repaymentPct,P.mint,'#E4ECE9'));s.push(txt(42,432,7,`${v.repaymentPct.toFixed(1)}% repaid`,'F2',P.green));s.push(txt(492,432,7,`${(100-v.repaymentPct).toFixed(1)}% remaining`,'F2',P.red));
  // Top outstanding
  s.push(sectionTitle(405,'Top outstanding balances','Largest current balances'));
  const top=v.creditors.filter(c=>c.remaining>0).slice(0,5),max=Math.max(1,...top.map(c=>c.remaining));let y=370;
  top.forEach((c,i)=>{s.push(hBar(42,y,511,c.name,c.remaining,max,CAT[i%CAT.length],c.remainingLabel));y-=40;});
  // Status
  s.push(sectionTitle(155,'Creditor status'));
  s.push(statusPill(42,90,'Outstanding',v.statusCounts.outstanding,P.red,P.redSoft));
  s.push(statusPill(222,90,'Partially paid',v.statusCounts.partial,P.amber,P.amberSoft));
  s.push(statusPill(402,90,'Fully paid',v.statusCounts.paid,P.mint,P.mintSoft));
  return s.join('');
}

function pageTwo(model){
  const v=model.visual,s=[];s.push(header(model,'Debt Map','Outstanding exposure by creditor and category'));
  s.push(sectionTitle(732,'Remaining balance by creditor','Sorted from largest to smallest'));
  const rows=v.creditors.filter(c=>c.remaining>0).slice(0,10),max=Math.max(1,...rows.map(c=>c.remaining));let y=695;
  rows.forEach((c,i)=>{s.push(hBar(42,y,511,c.name,c.remaining,max,CAT[i%CAT.length],c.remainingLabel));y-=36;});
  s.push(line(42,330,553,330,.5,P.line));
  s.push(sectionTitle(307,'Debt composition by category','Current outstanding balance after allocated reductions'));
  const cats=v.categories.slice(0,6),catMax=Math.max(1,...cats.map(c=>c.remaining));y=270;
  cats.forEach((c,i)=>{s.push(hBar(42,y,330,c.category,c.remaining,catMax,CAT[(i+1)%CAT.length],c.remainingLabel));const pct=v.raw.remaining>0?c.remaining/v.raw.remaining*100:0;s.push(txt(395,y+8,7,`${pct.toFixed(1)}%`,'F2',P.muted));y-=36;});
  // category legend summary on right/bottom
  s.push(card(410,222,143,67,'Categories',String(v.categories.length),{accent:P.violet,soft:'#EEEAF5'}));
  s.push(card(410,143,143,67,'Largest category',v.categories[0]?.category||'N/A',{accent:P.green,soft:P.mintSoft,valueSize:10}));
  s.push(card(410,64,143,67,'Largest share',v.categories[0]?`${(v.categories[0].remaining/Math.max(1,v.raw.remaining)*100).toFixed(1)}%`:'0%',{accent:P.amber,soft:P.amberSoft}));
  return s.join('');
}

function columnChart(x,y,w,h,items){
  if(!items.length)return txt(x,y+h/2,9,'No payment activity in the selected scope.','F1',P.muted);
  const max=Math.max(1,...items.map(i=>i.amount)),gap=8,bw=(w-gap*(items.length-1))/items.length;let s=line(x,y,x+w,y,.6,P.line);
  items.forEach((it,i)=>{const bh=Math.max(3,h*it.amount/max),bx=x+i*(bw+gap);s+=rect(bx,y,bw,bh,CAT[(i+1)%CAT.length]);s+=txt(bx,y-13,6.2,fit(it.label,8),'F1',P.muted);s+=txt(bx,y+bh+6,6.2,shortMoney(it.amount),'F2',P.ink);});return s;
}
function activityRow(y,tx){
  const labels=splitLabel(tx.creditor,24);let s=rect(42,y-10,511,46,P.panel);
  s+=txt(54,y+18,7.2,`${tx.date} | ${labels[0]}`,'F2',P.ink);
  if(labels[1])s+=txt(116,y+8,7.0,labels[1],'F2',P.ink);
  s+=txt(54,y-3,6.8,`${tx.type} | ${tx.amount}`,'F1',P.muted);return s;
}
function pageThree(model){
  const v=model.visual,s=[];s.push(header(model,'Payments & Activity','Cash movement and recent ledger changes'));
  s.push(card(42,661,160,65,'Total paid',model.summary.paid,{accent:P.mint,soft:P.mintSoft}));
  s.push(card(216,661,160,65,'Payment events',String(v.paymentEvents),{accent:P.blue,soft:P.blueSoft}));
  s.push(card(390,661,163,65,'Transactions',String(model.counts.transactions),{accent:P.violet,soft:'#EEEAF5'}));
  if(v.paymentMonths.length>=3){
    s.push(sectionTitle(628,'Payments by month','Only active, non-reversed payment records'));
    const months=v.paymentMonths.slice(-8);s.push(columnChart(42,430,511,150,months));
  }else{
    s.push(sectionTitle(628,'Payment activity','A timeline is more useful until more monthly payment history exists'));
    let y=570;const items=v.payments.slice(0,4);if(!items.length)s.push(txt(42,555,9,'No payment records in this scope.','F1',P.muted));
    items.forEach((p,i)=>{s.push(rect(42,y-9,511,58,i%2?P.panel:P.mintSoft));s.push(txt(56,y+26,8,p.date,'F2',P.green));s.push(txt(148,y+26,8,fit(p.creditor,28),'F2',P.ink));s.push(txt(430,y+26,9,p.amountLabel,'F2',P.green));s.push(txt(148,y+8,6.8,p.method||'Recorded payment','F1',P.muted));y-=68;});
  }
  s.push(sectionTitle(362,'Recent activity','Latest transactions in the selected scope'));
  let ry=316;v.latest.slice(0,5).forEach(tx=>{s.push(activityRow(ry,tx));ry-=55;});
  return s.join('');
}

function insightCard(x,y,w,h,title,value,sub,color,soft){let s=rect(x,y,w,h,soft);s+=rect(x,y,5,h,color);s+=txt(x+16,y+h-21,7,title.toUpperCase(),'F2',P.muted);s+=txt(x+16,y+h-46,15,fit(value,22),'F2',P.ink);if(sub)s+=txt(x+16,y+15,6.7,fit(sub,40),'F1',P.muted);return s;}
function pageFour(model){
  const v=model.visual,s=[];s.push(header(model,'Insights & Integrity','Decision-ready highlights with audit validation'));
  s.push(insightCard(42,632,245,92,'Largest outstanding',v.insights.largest?.remainingLabel||'N/A',v.insights.largest?.name||'',P.red,P.redSoft));
  s.push(insightCard(308,632,245,92,'Most paid creditor',v.insights.mostPaid?.paidLabel||'N/A',v.insights.mostPaid?.name||'',P.mint,P.mintSoft));
  s.push(insightCard(42,520,245,92,'Repayment rate',`${v.repaymentPct.toFixed(1)}%`,`${model.summary.paid} paid`,P.blue,P.blueSoft));
  s.push(insightCard(308,520,245,92,'Estimated records',String(model.quality.estimated),model.quality.disputed?`${model.quality.disputed} disputed`:'No disputed records',P.amber,P.amberSoft));
  s.push(sectionTitle(486,'Creditor repayment progress','Progress toward clearing each current balance'));
  let y=450;v.creditors.slice(0,8).forEach((c,i)=>{s.push(txt(42,y+6,6.7,fit(c.name,32),'F1',P.ink));s.push(progressBar(205,y,250,8,c.progress,CAT[i%CAT.length],'#E7EEEB'));s.push(txt(471,y+4,7,`${c.progress.toFixed(0)}%`,'F2',P.muted));y-=31;});
  s.push(sectionTitle(186,'Integrity & data quality'));
  s.push(rect(42,78,511,88,P.panel,P.line,.4));
  s.push(txt(56,142,7.5,`Reconciliation: ${model.health.reconciliation}`,'F2',P.green));
  s.push(txt(56,126,7.5,`Audit chain: ${fit(model.health.audit,58)}`,'F2',P.green));
  s.push(txt(56,110,7.5,`Diagnostics: ${model.health.diagnostics}`,'F2',P.green));
  s.push(txt(330,142,7,`Estimated: ${model.quality.estimated}`,'F1',P.muted));
  s.push(txt(330,126,7,`Disputed: ${model.quality.disputed}`,'F1',P.muted));
  s.push(txt(330,110,7,`Legacy without attachments: ${model.quality.legacyNoEvidence}`,'F1',P.muted));
  s.push(txt(330,94,7,`Missing evidence: ${model.quality.missingEvidence}`,'F1',P.muted));
  return s.join('');
}

function pdfDate(iso){const d=new Date(iso||Date.now()),p=n=>String(n).padStart(2,'0');return `D:${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;}
function pdfBytes(contents,model){
  const objects=[],add=s=>{objects.push(s);return objects.length;};const catalog=add(''),pagesObj=add('');const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const info=add(`<< /Title (Ledgerly Visual Financial Snapshot) /Author (Ledgerly) /Creator (Ledgerly Visual Report v1) /Subject (${escPdf(model.scopeText)}) /Keywords (Ledgerly visual debt dashboard infographic charts ${escPdf(model.reportId)}) /CreationDate (${pdfDate(model.generatedIso)}) >>`);
  const pageIds=[];for(let i=0;i<contents.length;i++){const content=watermark()+contents[i]+footer(model,i,contents.length);const stream=add(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${stream} 0 R >>`));}
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;objects[pagesObj-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let out='%PDF-1.4\n%Ledgerly Visual Report v1\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets[i+1]=enc.encode(out).length;out+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=enc.encode(out).length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';out+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;return enc.encode(out);
}

export function buildVisualReportPdf(model){
  return pdfBytes([pageOne(model),pageTwo(model),pageThree(model),pageFour(model)],model);
}
