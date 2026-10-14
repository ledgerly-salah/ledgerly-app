// Session cancellation and optional dialog ownership share one operation contract.
export function createSessionScope(target){
  let controller=new AbortController();
  target.addEventListener('ledgerly-locked',()=>{controller.abort();controller=new AbortController();});
  return {capture(owner=null){
    const base=controller.signal,local=owner?new AbortController():null,signal=local?.signal||base;
    const cancel=()=>local?.abort();
    const closing=e=>{if(e.detail===owner||e.detail?.contains?.(owner))cancel();};
    const release=()=>{base.removeEventListener('abort',cancel);target.removeEventListener('ledgerly-dialog-closing',closing);};
    if(owner){base.addEventListener('abort',cancel,{once:true});target.addEventListener('ledgerly-dialog-closing',closing);signal.addEventListener('abort',release,{once:true});if(base.aborted)cancel();}
    return {signal,release,assert(){if(signal.aborted||owner&&!owner.isConnected){const error=new Error('Operation cancelled. Reopen the form to continue.');error.name='AbortError';throw error;}},get active(){return !signal.aborted&&(!owner||owner.isConnected);}};
  }};
}
let scope;
export function captureSession(owner=null){scope ||= createSessionScope(window);return scope.capture(owner);}
