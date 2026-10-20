import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('all Node acceptance suites target the current release manifest',()=>{
 const build=JSON.parse(fs.readFileSync(new URL('../LEDGERLY_RELEASE.json',import.meta.url),'utf8')).buildId;
 const dir=new URL('./',import.meta.url);
 for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.test.mjs'))){
  const source=fs.readFileSync(new URL(name,dir),'utf8');
  for(const match of source.matchAll(/releases\/([^/'"`]+)\//g))
   assert.equal(match[1],build,`${name} targets a stale release: ${match[1]}`);
 }
});
