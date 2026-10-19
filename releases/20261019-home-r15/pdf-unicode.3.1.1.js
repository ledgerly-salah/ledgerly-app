import {PDF_FONTS} from './pdf-font-data.3.1.1.js';
import {ARABIC_FORMS} from './pdf-arabic-forms.3.1.1.js';
import bidiFactory from './pdf-bidi.3.1.1.js';
const bidi=bidiFactory();
const hex=(v,n=4)=>v.toString(16).padStart(n,'0');
function shaped(text){
 const chars=[...text];const previous=i=>{for(let j=i-1;j>=0;j--)if(!/[\u064b-\u065f\u0670]/.test(chars[j]))return chars[j].codePointAt(0);return 0;};const following=i=>{for(let j=i+1;j<chars.length;j++)if(!/[\u064b-\u065f\u0670]/.test(chars[j]))return chars[j].codePointAt(0);return 0;};
 const joined=chars.map((ch,i)=>{const f=ARABIC_FORMS[ch.codePointAt(0)];if(!f)return ch;const p=ARABIC_FORMS[previous(i)],n=ARABIC_FORMS[following(i)];const before=!!(p?.[2]&&f[1]),after=!!(f[2]&&n?.[1]);return String.fromCodePoint(f[before&&after?3:after?2:before?1:0]||ch.codePointAt(0));}).join('');
 const levels=bidi.getEmbeddingLevels(joined,'ltr');const visual=joined.split('');for(const [i,ch] of bidi.getMirroredCharactersMap(joined,levels))visual[i]=ch;for(const [a,b] of bidi.getReorderSegments(joined,levels))visual.splice(a,b-a+1,...visual.slice(a,b+1).reverse());return visual.join('');
}
export function pdfText(value,font='F1'){
 const text=String(value??'');if(/^[\x20-\x7e]*$/.test(text))return {font,token:`(${text.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')})`};
 const unicodeFont=font==='F2'?'F4':'F3',data=PDF_FONTS[unicodeFont==='F4'?1:0];let codes='';for(const ch of shaped(text)){const g=data.glyphs[ch.codePointAt(0)];if(!g)throw new Error(`PDF font does not support ${ch}. Remove that symbol or use an HTML report.`);codes+=hex(g[0]);}return {font:unicodeFont,token:`<${codes}>`};
}
export function textWidth(value,size=1,bold=false){const data=PDF_FONTS[bold?1:0];return [...shaped(String(value??''))].reduce((n,ch)=>n+(data.glyphs[ch.codePointAt(0)]?.[1]||600),0)/1000*size;}
export function addUnicodeFonts(add){return PDF_FONTS.map(f=>{
 const raw=atob(f.data);let fontHex='';for(let i=0;i<raw.length;i++)fontHex+=hex(raw.charCodeAt(i),2);fontHex+='>';const file=add(`<< /Length ${fontHex.length} /Length1 ${raw.length} /Filter /ASCIIHexDecode >>\nstream\n${fontHex}\nendstream`);
 const descriptor=add(`<< /Type /FontDescriptor /FontName /${f.name} /Flags 32 /FontBBox [${f.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${f.ascent} /Descent ${f.descent} /CapHeight ${f.ascent} /StemV 80 /FontFile2 ${file} 0 R >>`);
 const widths=new Map(),unicode=new Map();for(const [cp,[gid,width]] of Object.entries(f.glyphs)){widths.set(gid,width);let normalized=String.fromCodePoint(Number(cp)).normalize('NFKC');if([...normalized].length===1)unicode.set(gid,normalized.codePointAt(0));}
 const cid=add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${f.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap /Identity /DW 600 /W [${[...widths].map(([gid,width])=>`${gid} [${width}]`).join(' ')}] >>`);
 const mappings=[...unicode].map(([gid,cp])=>`<${hex(gid)}> <${hex(cp)}>`);let map='/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n';for(let i=0;i<mappings.length;i+=100){const part=mappings.slice(i,i+100);map+=`${part.length} beginbfchar\n${part.join('\n')}\nendbfchar\n`;}map+='endcmap CMapName currentdict /CMap defineresource pop end end';const toUnicode=add(`<< /Length ${map.length} >>\nstream\n${map}\nendstream`);
 return add(`<< /Type /Font /Subtype /Type0 /BaseFont /${f.name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUnicode} 0 R >>`);
 });}
