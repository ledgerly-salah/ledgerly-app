// One cancellation scope shared by every module on this page.
export function createSessionScope(target){
  let controller=new AbortController();
  target.addEventListener('ledgerly-locked',()=>{controller.abort();controller=new AbortController();});
  return {capture(){const signal=controller.signal;return {signal,assert(){if(signal.aborted){const error=new Error('Session ended. Unlock the ledger and retry.');error.name='AbortError';throw error;}},get active(){return !signal.aborted;}};}};
}
let scope;
export function captureSession(){scope ||= createSessionScope(window);return scope.capture();}
