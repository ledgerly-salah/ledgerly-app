import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
test('dialog close restores focus once; unrelated mutations do not steal it',async()=>{
 const dom=new JSDOM('<button id="opener">Open</button><button id="other">Other</button><div class="modal-backdrop" hidden><div class="modal"><h2>Dialog</h2><button class="modal-close">Close</button><input></div></div>',{runScripts:'outside-only'});
 const w=dom.window,d=w.document,tick=()=>new Promise(r=>w.setTimeout(r,0));
 try{
  w.eval(fs.readFileSync(new URL('../releases/20261019-scroll-r14/ui-accessibility.3.1.1.js',import.meta.url),'utf8'));
  const opener=d.querySelector('#opener'),other=d.querySelector('#other'),wrap=d.querySelector('.modal-backdrop'),close=d.querySelector('.modal-close');
  opener.focus();wrap.hidden=false;await tick();assert.equal(d.activeElement,close);
  close.addEventListener('click',()=>{wrap.hidden=true;});
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();assert.equal(d.activeElement,opener);
  other.focus();d.body.append(d.createElement('span'));await tick();assert.equal(d.activeElement,other);
  d.body.lastChild.textContent='updated';await tick();assert.equal(d.activeElement,other);
 }finally{w.close();}
});
