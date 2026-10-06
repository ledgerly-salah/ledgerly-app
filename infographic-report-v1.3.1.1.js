// Ledgerly Infographic Report v1 — one-page executive infographic PDF.
// Fully offline; built with native vector PDF primitives and the validated Ledgerly snapshot.
const enc=new TextEncoder();

const P={
  ink:'#12362F',muted:'#6A7A75',green:'#0F5B4B',mint:'#2EA67D',mintSoft:'#DDF3EA',
  red:'#C95A5A',redSoft:'#F8E5E3',amber:'#C58B2A',amberSoft:'#FAF0D9',blue:'#4D78A8',
  blueSoft:'#E6EEF8',violet:'#735F9E',teal:'#3F8F91',line:'#DDE5E2',panel:'#F5F8F7',white:'#FFFFFF',black:'#1E2926'
};
const CAT=[P.green,P.mint,P.blue,P.amber,P.violet,P.teal,P.red,'#6E8B74','#9B785A','#6D7785'];

function ascii(value){
  return String(value??'').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/[\u00B7\u2022]/g,'|')
    .replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u00A0/g,' ')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?');
}
function escPdf(value){return ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function fit(value,max=36){const s=ascii(value);return s.length<=max?s:s.slice(0,Math.max(1,max-3))+'...';}
function rgb(hex){const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255].map(x=>x.toFixed(3)).join(' ');}
function fill(hex){return `${rgb(hex)} rg\n`;}
function stroke(hex){return `${rgb(hex)} RG\n`;}
function txt(x,y,size,value,font='F1',color=P.ink){return `${fill(color)}BT /${font} ${size} Tf ${x} ${y} Td (${escPdf(value)}) Tj ET\n`;}
function line(x1,y1,x2,y2,w=.5,color=P.line){return `${stroke(color)}${w} w ${x1} ${y1} m ${x2} ${y2} l S\n`;}
function rect(x,y,w,h,color,strokeColor=null,sw=.5){let s=`${fill(color)}${x} ${y} ${w} ${h} re f\n`;if(strokeColor)s+=`${stroke(strokeColor)}${sw} w ${x} ${y} ${w} ${h} re S\n`;return s;}
function circlePath(cx,cy,r){const k=.5522847498*r;return `${cx+r} ${cy} m ${cx+r} ${cy+k} ${cx+k} ${cy+r} ${cx} ${cy+r} c ${cx-k} ${cy+r} ${cx-r} ${cy+k} ${cx-r} ${cy} c ${cx-r} ${cy-k} ${cx-k} ${cy-r} ${cx} ${cy-r} c ${cx+k} ${cy-r} ${cx+r} ${cy-k} ${cx+r} ${cy} c`;}
function circle(cx,cy,r,color){return `${fill(color)}${circlePath(cx,cy,r)} f\n`;}
function arcPath(cx,cy,r,startDeg,endDeg){
  const rad=d=>d*Math.PI/180;let start=rad(startDeg),end=rad(endDeg);const total=end-start;const segs=Math.max(1,Math.ceil(Math.abs(total)/(Math.PI/2)));const step=total/segs;
  let a=start,x0=cx+r*Math.cos(a),y0=cy+r*Math.sin(a),out=`${x0.toFixed(2)} ${y0.toFixed(2)} m `;
  for(let i=0;i<segs;i++){
    const b=a+step,k=4/3*Math.tan((b-a)/4),x1=cx+r*Math.cos(a),y1=cy+r*Math.sin(a),x4=cx+r*Math.cos(b),y4=cy+r*Math.sin(b);
    const c1x=x1-k*r*Math.sin(a),c1y=y1+k*r*Math.cos(a),c2x=x4+k*r*Math.sin(b),c2y=y4-k*r*Math.cos(b);
    out+=`${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${x4.toFixed(2)} ${y4.toFixed(2)} c `;a=b;
  }
  return out;
}
function strokeArc(cx,cy,r,start,end,width,color){return `${stroke(color)}${width} w 1 J ${arcPath(cx,cy,r,start,end)} S\n0 J `;}
function moneyNum(v){return Number(v||0)/100;}
function fullMoney(v){return `SAR ${moneyNum(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function signedMoney(v){const n=Number(v||0);return `${n>0?'+':n<0?'-':''}${fullMoney(Math.abs(n))}`;}
function shortMoney(v){const n=moneyNum(v);if(Math.abs(n)>=1000000)return `SAR ${(n/1000000).toFixed(1)}m`;if(Math.abs(n)>=1000)return `SAR ${(n/1000).toFixed(n>=10000?0:1)}k`;return `SAR ${n.toFixed(0)}`;}
function section(y,title,sub=''){let s=txt(42,y,11.5,title,'F2',P.ink);if(sub)s+=txt(42,y-13,6.8,sub,'F1',P.muted);return s;}
function card(x,y,w,h,label,value,accent,soft,valueSize=12){let s=rect(x,y,w,h,soft,P.line,.35);s+=rect(x,y,w,4,accent);s+=txt(x+10,y+h-17,6.2,label.toUpperCase(),'F2',P.muted);s+=txt(x+10,y+15,valueSize,fit(value,22),'F2',P.ink);return s;}
function hBar(x,y,w,label,value,max,color,valueLabel=''){const ratio=max>0?Math.max(0,Math.min(1,value/max)):0;let s=txt(x,y+8,6.6,fit(label,26),'F1',P.black);s+=txt(x+w-62,y+8,6.4,valueLabel||shortMoney(value),'F2',P.ink);s+=rect(x,y,w,6,'#E8EFEC');if(ratio>0)s+=rect(x,y,w*ratio,6,color);return s;}
function header(model){let s=rect(0,768,595,74,P.green);s+=txt(42,813,8.5,'LEDGERLY','F2',P.white);s+=txt(42,786,19,'Infographic Report','F2',P.white);s+=txt(42,773,6.8,`One-page visual summary | ${model.generated} | ${model.timezone}`,'F1','#D7E9E3');s+=txt(428,811,6.4,`Revision ${model.revision}`,'F1','#D7E9E3');s+=txt(428,799,6.4,model.build,'F1','#D7E9E3');s+=txt(428,787,6.4,model.reportId,'F1','#D7E9E3');return s;}
function progressRing(cx,cy,r,pct){const p=Math.max(0,Math.min(100,Number(pct||0)));let s=strokeArc(cx,cy,r,0,360,12,'#DFE8E4');if(p>0)s+=strokeArc(cx,cy,r,-90,-90+360*p/100,12,P.mint);s+=txt(cx-22,cy+2,16,`${p.toFixed(1)}%`,'F2',P.green);s+=txt(cx-18,cy-14,6.5,'cleared','F1',P.muted);return s;}
function categoryDonut(cx,cy,r,categories,total){let s=strokeArc(cx,cy,r,0,360,13,'#E5ECE9'),angle=-90;const cats=(categories||[]).filter(c=>Number(c.remaining)>0).slice(0,5);cats.forEach((c,i)=>{const pct=total>0?Number(c.remaining)/total:0,end=angle+360*pct;if(pct>0)s+=strokeArc(cx,cy,r,angle,end,13,CAT[i%CAT.length]);angle=end;});s+=txt(cx-17,cy+2,12,String(cats.length),'F2',P.ink);s+=txt(cx-23,cy-13,6.2,'categories','F1',P.muted);return s;}
function insight(x,y,w,title,value,sub,color,soft){let s=rect(x,y,w,53,soft);s+=rect(x,y,4,53,color);s+=txt(x+11,y+36,5.8,title.toUpperCase(),'F2',P.muted);s+=txt(x+11,y+20,10.5,fit(value,24),'F2',P.ink);if(sub)s+=txt(x+11,y+7,5.8,fit(sub,32),'F1',P.muted);return s;}
function rowAdjustment(c){if(Number.isFinite(Number(c.adjustments)))return Number(c.adjustments);return Number(c.remaining||0)+Number(c.paid||0)-Number(c.original||0);}
function ledgerRows(creditors){
  const rows=[...(creditors||[])];
  if(rows.length<=10)return rows;
  const head=rows.slice(0,9),rest=rows.slice(9);
  head.push({name:`Others (${rest.length})`,original:rest.reduce((n,c)=>n+Number(c.original||0),0),paid:rest.reduce((n,c)=>n+Number(c.paid||0),0),remaining:rest.reduce((n,c)=>n+Number(c.remaining||0),0),adjustments:rest.reduce((n,c)=>n+rowAdjustment(c),0)});
  return head;
}

function page(model){
  const v=model.visual,s=[];s.push(header(model));
  s.push(rect(42,642,511,104,P.ink));s.push(txt(57,718,7,'TOTAL REMAINING','F2','#BDE0D4'));s.push(txt(57,682,27,model.summary.remaining,'F2',P.white));s.push(txt(57,658,7,`${v.statusCounts.open} open creditors | ${model.counts.transactions} transactions`,'F1','#D7E7E2'));s.push(progressRing(484,693,36,v.repaymentPct));
  const adj=Number(v.raw.liability||0)-Number(v.raw.original||0);
  s.push(card(42,578,119,48,'Original',model.summary.original,P.blue,P.blueSoft,10));s.push(card(173,578,119,48,'Adjustments',signedMoney(adj),P.amber,P.amberSoft,10));s.push(card(304,578,119,48,'Paid',model.summary.paid,P.mint,P.mintSoft,10));s.push(card(435,578,118,48,'Open creditors',String(v.statusCounts.open),P.red,P.redSoft,11));s.push(txt(42,561,6.8,`Reconciliation: ${fullMoney(v.raw.original)} ${adj>=0?'+':'-'} ${fullMoney(Math.abs(adj))} - ${fullMoney(v.raw.reductions)} = ${fullMoney(v.raw.remaining)}`,'F2',P.ink));
  s.push(section(535,'Top 5 outstanding creditors','Largest current balances'));
  const top=(v.creditors||[]).filter(c=>c.remaining>0).slice(0,5),max=Math.max(1,...top.map(c=>c.remaining));let y=500;top.forEach((c,i)=>{s.push(hBar(42,y,300,c.name,c.remaining,max,CAT[i%CAT.length],c.remainingLabel));y-=34;});
  s.push(txt(377,535,11.5,'Debt composition','F2',P.ink));s.push(txt(377,522,6.8,'Outstanding by category','F1',P.muted));s.push(categoryDonut(463,455,48,v.categories,v.raw.remaining));let ly=390;(v.categories||[]).filter(c=>c.remaining>0).slice(0,4).forEach((c,i)=>{s.push(circle(382,ly+2,4,CAT[i%CAT.length]));s.push(txt(392,ly,6.4,fit(c.category,20),'F1',P.ink));const pct=v.raw.remaining>0?c.remaining/v.raw.remaining*100:0;s.push(txt(506,ly,6.4,`${pct.toFixed(1)}%`,'F2',P.muted));ly-=17;});
  s.push(line(42,320,553,320,.45,P.line));s.push(section(300,'Key insights','Decision-ready highlights'));s.push(insight(42,232,157,'Largest balance',v.insights.largest?.remainingLabel||'N/A',v.insights.largest?.name||'',P.red,P.redSoft));s.push(insight(219,232,157,'Most paid creditor',v.insights.mostPaid?.paidLabel||'N/A',v.insights.mostPaid?.name||'',P.mint,P.mintSoft));s.push(insight(396,232,157,'Estimated records',String(model.quality.estimated),model.quality.disputed?`${model.quality.disputed} disputed`:'No disputed records',P.amber,P.amberSoft));

  const rows=ledgerRows(v.creditors||[]);
  s.push(section(209,'Mini ledger snapshot',rows.length<(v.creditors||[]).length?'Top creditors plus Others and total':'All creditors plus total'));
  s.push(rect(42,82,511,110,P.panel,P.line,.35));
  s.push(txt(52,181,5.6,'CREDITOR','F2',P.muted));s.push(txt(275,181,5.6,'ORIGINAL','F2',P.muted));s.push(txt(344,181,5.6,'ADJ.','F2',P.muted));s.push(txt(410,181,5.6,'PAID','F2',P.muted));s.push(txt(477,181,5.6,'REMAINING','F2',P.muted));
  let ty=168;rows.forEach(c=>{const ra=rowAdjustment(c);s.push(txt(52,ty,5.35,fit(c.name,34),'F1',P.ink));s.push(txt(275,ty,5.0,fullMoney(c.original),'F1',P.ink));s.push(txt(344,ty,5.0,signedMoney(ra),'F1',ra?P.amber:P.muted));s.push(txt(410,ty,5.0,fullMoney(c.paid),'F1',P.green));s.push(txt(477,ty,5.0,fullMoney(c.remaining),'F2',P.ink));ty-=8.2;});
  s.push(line(52,84,543,84,.4,P.line));s.push(txt(52,73,5.5,'TOTAL','F2',P.ink));s.push(txt(275,73,5.4,model.summary.original,'F2',P.ink));s.push(txt(344,73,5.4,signedMoney(adj),'F2',adj?P.amber:P.muted));s.push(txt(410,73,5.4,model.summary.paid,'F2',P.green));s.push(txt(477,73,5.4,model.summary.remaining,'F2',P.red));

  s.push(rect(42,43,511,22,'#EEF5F2'));s.push(txt(52,51,5.7,`Reconciliation: ${model.health.reconciliation}`,'F2',P.green));s.push(txt(187,51,5.7,`Audit: ${fit(model.health.audit,32)}`,'F2',P.green));s.push(txt(405,51,5.7,`Diagnostics: ${model.health.diagnostics}`,'F2',P.green));
  s.push(txt(42,31,5.5,'Visual summary only. Cleared may include payments and other reductions. For transaction-level detail, refer to the Detailed Ledger report.','F1',P.muted));
  s.push(txt(42,17,5.4,'PRIVATE & CONFIDENTIAL | Generated from Ledgerly encrypted local ledger','F1',P.muted));s.push(txt(491,17,5.4,'Page 1 of 1','F1',P.muted));return s.join('');
}
function pdfDate(iso){const d=new Date(iso||Date.now()),p=n=>String(n).padStart(2,'0');return `D:${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;}
function pdfBytes(content,model){const objects=[],add=s=>{objects.push(s);return objects.length;},catalog=add(''),pages=add(''),f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');const info=add(`<< /Title (Ledgerly Infographic Report) /Author (Ledgerly) /Creator (Ledgerly Infographic Report v1) /Subject (${escPdf(model.scopeText)}) /Keywords (Ledgerly infographic debt summary ${escPdf(model.reportId)}) /CreationDate (${pdfDate(model.generatedIso)}) >>`);const stream=add(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`),page=add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${stream} 0 R >>`);objects[catalog-1]=`<< /Type /Catalog /Pages ${pages} 0 R >>`;objects[pages-1]=`<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;let out='%PDF-1.4\n%Ledgerly Infographic Report v1\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets[i+1]=enc.encode(out).length;out+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=enc.encode(out).length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';out+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;return enc.encode(out);}
export function buildInfographicReportPdf(model){return pdfBytes(page(model),model);}
