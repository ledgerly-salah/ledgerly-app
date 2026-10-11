import fs from 'node:fs';
import {createHash} from 'node:crypto';
const path=new URL('../LEDGERLY_RELEASE.json',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(path,'utf8'));
for(const entry of manifest.files){const bytes=fs.readFileSync(new URL('../'+entry.name,import.meta.url));entry.bytes=bytes.length;entry.sha256=createHash('sha256').update(bytes).digest('hex');}
fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
