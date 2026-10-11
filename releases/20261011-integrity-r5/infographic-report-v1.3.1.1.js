import {pdfText,addUnicodeFonts,textWidth} from './pdf-unicode.3.1.1.js';
// Ledgerly Infographic Report v2 — one-page executive infographic PDF.
// Fully offline; built with native vector PDF primitives and the validated Ledgerly snapshot.
const enc=new TextEncoder();

const P={
  ink:'#12362F',muted:'#6A7A75',green:'#0F5B4B',mint:'#2EA67D',mintSoft:'#DDF3EA',
  red:'#C95A5A',refRed:'#FF6B6B',redSoft:'#F8E5E3',amber:'#C58B2A',amberSoft:'#FAF0D9',blue:'#4D78A8',
  blueSoft:'#E6EEF8',violet:'#735F9E',teal:'#3F8F91',line:'#DDE5E2',rowLine:'#E9EFED',panel:'#F7F9F8',white:'#FFFFFF',black:'#1E2926'
};
const CAT=[P.green,P.mint,P.blue,P.amber,P.violet,P.teal,P.red,'#6E8B74','#9B785A','#6D7785'];
const MIN_BODY_FONT=7.2;

function ascii(value){
  return String(value??'').replace(/[\u2010-\u2015\u2212]/g,'-').replace(/[\u00B7\u2022]/g,'|')
    .replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u00A0/g,' ')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\r\n\t]/g,' ');
}
function escPdf(value){return ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function fit(value,max=36){const s=ascii(value);return s.length<=max?s:s.slice(0,Math.max(1,max-3))+'...';}
function rgb(hex){const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255].map(x=>x.toFixed(3)).join(' ');}
function fill(hex){return `${rgb(hex)} rg\n`;}
function stroke(hex){return `${rgb(hex)} RG\n`;}
function txt(x,y,size,value,font='F1',color=P.ink){const p=pdfText(ascii(value),font);return `${fill(color)}BT /${p.font} ${size} Tf ${x} ${y} Td ${p.token} Tj ET\n`;}
function widthApprox(value,size){
  let em=0;for(const ch of ascii(value)){if(/[0-9]/.test(ch))em+=.556;else if(/[.,:;]/.test(ch))em+=.278;else if(ch===' ')em+=.278;else if(/[A-Z]/.test(ch))em+=.64;else if(/[ilI1]/.test(ch))em+=.28;else if(/[mwMW]/.test(ch))em+=.82;else em+=.5;}return em*size;
}
function txtRight(xRight,y,size,value,font='F1',color=P.ink){return txt(xRight-widthApprox(value,size),y,size,value,font,color);}
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
function numMoney(v){return moneyNum(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fullMoney(v){return `SAR ${numMoney(v)}`;}
function signedNum(v){const n=Number(v||0);return `${n>0?'+':n<0?'-':''}${numMoney(Math.abs(n))}`;}
function signedMoney(v){const n=Number(v||0);return `${n>0?'+':n<0?'-':''}${fullMoney(Math.abs(n))}`;}
function section(y,title,sub=''){let s=txt(42,y,12.7,title,'F2',P.ink);if(sub)s+=txt(42,y-14,7.7,sub,'F1',P.muted);return s;}
function card(x,y,w,h,label,value,accent,soft,valueSize=12){let s=rect(x,y,w,h,soft,P.line,.35);s+=rect(x,y,w,4,accent);s+=txt(x+10,y+h-17,7.1,label.toUpperCase(),'F2',P.muted);s+=txt(x+10,y+14,valueSize+1,fit(value,22),'F2',P.ink);return s;}
function hBar(x,y,w,rank,label,value,max,color,valueLabel=''){const ratio=max>0?Math.max(0,Math.min(1,value/max)):0;let s=txt(x,y+11,8.3,`${rank}. ${fit(label,24)}`,'F1',P.black);s+=txtRight(x+w,y+11,8.3,valueLabel||fullMoney(value),'F2',P.ink);s+=rect(x,y,w,8,'#E8EFEC');if(ratio>0)s+=rect(x,y,w*ratio,8,color);return s;}
function issueMeta(model){
  const d=new Date(model.generatedIso||Date.now());
  const date=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d);
  const time=new Intl.DateTimeFormat('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}).format(d).replace(/^0/,'').toUpperCase();
  const ref=String(model.issueRef||'?-0000');
  return {ref,date,time};
}
function watermark(){return `0.975 g BT /F2 30 Tf 0.707 0.707 -0.707 0.707 145 300 Tm (STRICTLY CONFIDENTIAL) Tj ET 0 g\n`;}
function header(model){
  const meta=issueMeta(model);
  const scopePart=String(model.scopeLabel||'All creditors');
  let balancePart=String(model.asOfLabel||'Current snapshot').replace(/^Balances:\s*/i,'').replace(/^Balances as of\s*/i,'As of ');
  balancePart=balancePart?balancePart[0].toUpperCase()+balancePart.slice(1):'Current snapshot';
  const zonePart=String(model.timezone||'').replace(/^Time Zone:\s*/i,'');
  const scope=fit(`${scopePart} | ${balancePart} | ${zonePart}`,64);
  let s=rect(0,768,595,74,P.green);s+=txt(42,813,9.4,'LEDGERLY','F2',P.white);s+=txt(42,786,20,'Infographic Report','F2',P.white);s+=txt(42,773,7.2,scope,'F1','#D7E9E3');
  s+=txt(410,812,8.2,`Ref: ${meta.ref}`,'F2',P.refRed);s+=txt(410,799,7.7,`Issue Date: ${meta.date}`,'F1','#D7E9E3');s+=txt(410,786,7.7,`Issue Time: ${meta.time}`,'F1','#D7E9E3');return s;
}
function progressRing(cx,cy,r,pct){const p=Math.max(0,Math.min(100,Number(pct||0)));let s=strokeArc(cx,cy,r,0,360,12,'#DFE8E4');if(p>0)s+=strokeArc(cx,cy,r,-90,-90+360*p/100,12,P.mint);s+=txt(cx-22,cy+2,16,`${p.toFixed(1)}%`,'F2',P.green);s+=txt(cx-20,cy-14,7.4,'cleared','F1',P.muted);return s;}
function categoryDonut(cx,cy,r,categories,total){let s=strokeArc(cx,cy,r,0,360,13,'#E5ECE9'),angle=-90;const cats=(categories||[]).filter(c=>Number(c.remaining)>0).slice(0,5);cats.forEach((c,i)=>{const pct=total>0?Number(c.remaining)/total:0,end=angle+360*pct;if(pct>0)s+=strokeArc(cx,cy,r,angle,end,13,CAT[i%CAT.length]);angle=end;});s+=txt(cx-17,cy+2,12.5,String(cats.length),'F2',P.ink);s+=txt(cx-25,cy-13,7.2,'categories','F1',P.muted);return s;}
function insight(x,y,w,title,value,sub,color,soft){let s=rect(x,y,w,53,soft);s+=rect(x,y,4,53,color);s+=txt(x+11,y+36,6.7,title.toUpperCase(),'F2',P.muted);s+=txt(x+11,y+19,11.3,fit(value,24),'F2',P.ink);if(sub)s+=txt(x+11,y+6,6.5,fit(sub,32),'F1',P.muted);return s;}
function rowAdjustment(c){return Number(c.adjustments||0)-Number(c.waivers||0);}
function ledgerRows(creditors){
  const rows=[...(creditors||[])];
  if(rows.length<=10)return {rows,others:0};
  const head=rows.slice(0,9),rest=rows.slice(9);
  head.push({name:`Others (${rest.length} creditors)`,original:rest.reduce((n,c)=>n+Number(c.original||0),0),paid:rest.reduce((n,c)=>n+Number(c.paid||0),0),remaining:rest.reduce((n,c)=>n+Number(c.remaining||0),0),adjustments:rest.reduce((n,c)=>n+Number(c.adjustments||0),0),waivers:rest.reduce((n,c)=>n+Number(c.waivers||0),0)});
  return {rows:head,others:rest.length};
}
function qualityInsight(model){
  const e=Number(model.quality?.estimated||0),d=Number(model.quality?.disputed||0);
  if(d)return {value:`${d} disputed record${d===1?'':'s'}`,sub:'See Detailed Ledger'};
  if(e)return {value:`${e} estimated record${e===1?'':'s'}`,sub:'See Detailed Ledger'};
  return {value:'Confirmed records',sub:'No disputed records'};
}
function healthBadge(x,y,w,label){let s=rect(x,y,w,20,'#EEF5F2',P.line,.3);s+=circle(x+10,y+10,3,P.mint);s+=txt(x+18,y+6,6.8,`${label} PASS`,'F2',P.green);return s;}
function validateLayout(){
  if(MIN_BODY_FONT<7)throw new Error('Infographic layout guard: minimum body font is too small.');
  const areas=[['header',768,842],['hero',642,746],['cards',578,626],['top',337,535],['insights',260,321],['ledger',82,246],['health',51,73],['footer',0,47]];
  for(let i=1;i<areas.length;i++){if(areas[i-1][1]<areas[i][2])throw new Error(`Infographic layout guard: ${areas[i-1][0]} overlaps ${areas[i][0]}.`);}
}

function page(model){
  validateLayout();
  const v=model.visual,s=[];s.push(header(model));
  s.push(rect(42,642,511,104,P.ink));s.push(txt(57,718,8.2,'TOTAL REMAINING','F2','#BDE0D4'));s.push(txt(57,682,27,model.summary.remaining,'F2',P.white));s.push(txt(57,658,8,`${v.statusCounts.open} open creditors | ${model.counts.transactions} transactions`,'F1','#D7E7E2'));s.push(progressRing(484,693,36,v.repaymentPct));
  const adj=Number(v.raw.liability||0)-Number(v.raw.original||0);const otherReductions=Number(v.raw.reductions||0)-Number(v.raw.paid||0);const netChange=adj-otherReductions;
  s.push(card(42,578,119,48,'Original',model.summary.original,P.blue,P.blueSoft,10));s.push(card(173,578,119,48,'Adjustments',signedMoney(adj),P.amber,P.amberSoft,10));s.push(card(304,578,119,48,'Paid',model.summary.paid,P.mint,P.mintSoft,10));s.push(card(435,578,118,48,'Open creditors',String(v.statusCounts.open),P.red,P.redSoft,10));
  s.push(txt(42,560,8.0,`Reconciliation: ${fullMoney(v.raw.original)} ${adj>=0?'+':'-'} ${fullMoney(Math.abs(adj))} - ${fullMoney(v.raw.reductions)} = ${fullMoney(v.raw.remaining)}`,'F2',P.ink));

  s.push(section(535,'Top 3 outstanding creditors','Largest current balances'));
  const top=(v.creditors||[]).filter(c=>c.remaining>0).slice(0,3),max=Math.max(1,...top.map(c=>c.remaining));let y=495;top.forEach((c,i)=>{s.push(hBar(42,y,300,i+1,c.name,c.remaining,max,CAT[i%CAT.length],c.remainingLabel));y-=39;});
  s.push(txt(377,535,12.7,'Debt composition','F2',P.ink));s.push(txt(377,521,7.7,'Outstanding by category','F1',P.muted));s.push(categoryDonut(463,458,44,v.categories,v.raw.remaining));let ly=397;(v.categories||[]).filter(c=>c.remaining>0).slice(0,5).forEach((c,i)=>{s.push(circle(382,ly+2,3.5,CAT[i%CAT.length]));s.push(txt(392,ly,7.0,fit(c.category,18),'F1',P.ink));const pct=v.raw.remaining>0?c.remaining/v.raw.remaining*100:0;s.push(txtRight(538,ly,7.0,`${pct.toFixed(1)}%`,'F2',P.muted));ly-=13.5;});

  s.push(line(42,337,553,337,.45,P.line));s.push(section(321,'Key insights'));
  const q=qualityInsight(model);s.push(insight(42,260,157,'Largest balance',v.insights.largest?.remainingLabel||'N/A',v.insights.largest?.name||'',P.red,P.redSoft));s.push(insight(219,260,157,'Highest amount paid',v.insights.mostPaid?.paidLabel||'N/A',v.insights.mostPaid?.name||'',P.mint,P.mintSoft));s.push(insight(396,260,157,'Data quality',q.value,q.sub,P.amber,P.amberSoft));

  const led=ledgerRows(v.creditors||[]),rows=led.rows;
  s.push(section(246,'Mini ledger snapshot'));
  s.push(rect(42,82,511,150,P.panel,P.line,.35));
  s.push(txt(52,217,8.2,'CREDITOR','F2',P.muted));s.push(txtRight(330,217,8.0,'ORIGINAL (SAR)','F2',P.muted));s.push(txtRight(401,217,8.0,'NET CHANGE','F2',P.muted));s.push(txtRight(459,217,8.0,'PAID (SAR)','F2',P.muted));s.push(txtRight(543,217,8.0,'REMAINING (SAR)','F2',P.muted));
  let ty=201;rows.forEach((c,i)=>{const ra=rowAdjustment(c);s.push(txt(52,ty,8.4,fit(c.name,38),'F1',P.ink));s.push(txtRight(330,ty,8.1,numMoney(c.original),'F1',P.ink));s.push(txtRight(401,ty,8.1,signedNum(ra),'F1',ra?P.amber:P.muted));s.push(txtRight(463,ty,8.1,numMoney(c.paid),'F1',P.green));s.push(txtRight(543,ty,8.2,numMoney(c.remaining),'F2',P.ink));if(i<rows.length-1)s.push(line(52,ty-4,543,ty-4,.25,P.rowLine));ty-=11.5;});
  s.push(line(52,87,543,87,.65,P.line));s.push(txt(52,84,8.3,'TOTAL','F2',P.ink));s.push(txtRight(330,84,8.3,numMoney(v.raw.original),'F2',P.ink));s.push(txtRight(401,84,8.3,signedNum(netChange),'F2',netChange?P.amber:P.muted));s.push(txtRight(463,84,8.3,numMoney(v.raw.paid),'F2',P.green));s.push(txtRight(543,84,8.3,numMoney(v.raw.remaining),'F2',P.red));

  s.push(healthBadge(42,52,155,'Reconciliation'));s.push(healthBadge(204,52,172,'Audit integrity'));s.push(healthBadge(383,52,170,'Diagnostics'));
  s.push(txt(42,38,7.2,'Net change = adjustments minus waivers. Cleared includes cash and other reductions.','F1',P.muted));
  if(led.others)s.push(txtRight(553,38,6.2,`${led.others} creditors grouped as Others`,'F1',P.muted));

  const meta=issueMeta(model);s.push(line(42,27,553,27,.45,P.line));s.push(txt(42,16,8.0,'STRICTLY CONFIDENTIAL','F2',P.ink));s.push(txt(178,16,8.0,`Ref ${meta.ref}`,'F2',P.red));s.push(txtRight(553,16,8.0,'Page 1 of 1','F2',P.ink));
  s.push(txt(42,6,7.8,`Ledger Rev. ${model.revision} | Template ${model.templateRevision||'Infographic v2'} | Build ${model.build}`,'F1',P.muted));
  return s.join('');
}
function pdfDate(iso){const d=new Date(iso||Date.now()),p=n=>String(n).padStart(2,'0');return `D:${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;}
function pdfBytes(content,model){
  const objects=[],add=s=>{objects.push(s);return objects.length;},catalog=add(''),pages=add(''),f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const auditMeta=`Audit ${model.health?.audit||''}`;
  const unicodeFonts=addUnicodeFonts(add);const info=add(`<< /Title (Ledgerly Infographic Report) /Author (Ledgerly) /Creator (Ledgerly Infographic Report v2) /Subject (${escPdf(model.scopeText)}) /Keywords (Ledgerly infographic debt summary Ref ${escPdf(model.issueRef||'')} ${escPdf(model.reportId)} ${escPdf(auditMeta)}) /CreationDate (${pdfDate(model.generatedIso)}) >>`);
  const stream=add(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`),page=add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${unicodeFonts[0]} 0 R /F4 ${unicodeFonts[1]} 0 R >> >> /Contents ${stream} 0 R >>`);objects[catalog-1]=`<< /Type /Catalog /Pages ${pages} 0 R >>`;objects[pages-1]=`<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`;
  let out='%PDF-1.4\n%Ledgerly Infographic Report v2\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets[i+1]=enc.encode(out).length;out+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=enc.encode(out).length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';out+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;return enc.encode(out);
}
export function buildInfographicReportPdf(model){return pdfBytes(watermark()+page(model),model);}
