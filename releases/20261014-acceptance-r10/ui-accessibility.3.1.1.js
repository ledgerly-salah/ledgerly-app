// Shared dialog semantics for the base UI and supplemental authorization panels.
let activeDialog=null,lastFocus=null;
function dialogs(){return [...document.querySelectorAll('.modal-backdrop')].filter(el=>!el.hidden&&!el.closest('[hidden]')).sort((a,b)=>Number(getComputedStyle(a).zIndex||0)-Number(getComputedStyle(b).zIndex||0));}
function controls(el){return [...el.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&!x.hidden);}
function enhance(){
 for(const wrap of dialogs()){
  const modal=wrap.querySelector('.modal');if(!modal)continue;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.tabIndex=-1;
  const heading=modal.querySelector('h2');if(heading){heading.id=heading.id||'dialog-'+wrap.id;modal.setAttribute('aria-labelledby',heading.id);}
  for(const row of modal.querySelectorAll('.settings-row,.field')){const label=row.querySelector('label,span');const input=row.querySelector('input,select,textarea');if(label&&input&&!input.labels?.length&&!input.hasAttribute('aria-label')){label.id=label.id||'label-'+Math.random().toString(36).slice(2);input.setAttribute('aria-labelledby',label.id);}}
 }
 const top=dialogs().at(-1);if(top!==activeDialog){if(top){lastFocus=document.activeElement;controls(top)[0]?.focus();}else if(lastFocus?.isConnected)lastFocus.focus();activeDialog=top||null;}
}
document.addEventListener('keydown',e=>{
 const top=dialogs().at(-1);if(!top)return;
 if(e.key==='Escape'){const close=top.querySelector('#fgClose,#reportClose,#rkCancel,.modal-close');if(close){e.preventDefault();e.stopImmediatePropagation();close.click();}return;}
 if(e.key!=='Tab')return;const items=controls(top);if(!items.length){e.preventDefault();top.querySelector('.modal')?.focus();return;}const i=items.indexOf(document.activeElement);if(e.shiftKey&&(i<=0)){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&(i<0||i===items.length-1)){e.preventDefault();items[0].focus();}
},true);
new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
enhance();
