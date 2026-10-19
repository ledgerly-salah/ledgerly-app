// Deterministic two-page synthetic evidence; contains no personal records.
import fs from 'node:fs';
const objects=[
'<< /Type /Catalog /Pages 2 0 R >>',
'<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>',
'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
...[1,2].map(n=>{const text=`BT /F1 18 Tf 60 700 Td (Synthetic Ledgerly evidence page ${n}) Tj ET`;return `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;}),
'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
const start=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
const file=new URL('../validation/r16/fixtures/detailed.pdf',import.meta.url);fs.mkdirSync(new URL('./',file),{recursive:true});fs.writeFileSync(file,pdf);
