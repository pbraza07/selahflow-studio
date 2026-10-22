/** Keep the browser subscription across app releases. Repair only an obsolete key. */
export function decodePushKey(raw){
 const padded=raw.padEnd(Math.ceil(raw.length/4)*4,'=').replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
}
export async function ensurePushSubscription(registration,publicKey){
 const key=decodePushKey(publicKey);
 let subscription=await registration.pushManager.getSubscription();
 const previous=subscription?.options?.applicationServerKey;
 if(subscription&&previous){
  const bytes=new Uint8Array(previous);
  if(bytes.length!==key.length||bytes.some((v,i)=>v!==key[i])){
   if(!await subscription.unsubscribe())throw Error('Unable to replace the old device subscription. Try again.');
   subscription=null;
  }
 }
 return subscription||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
}
