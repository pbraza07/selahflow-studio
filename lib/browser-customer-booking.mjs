/** Private booking access stays on the receiving device, never in push URLs. */
export const isSharedTablet=()=>typeof document!=='undefined'&&/(?:^|;\s*)sf_kiosk_slug=/.test(document.cookie);
const store='selahflow:customer-bookings';
export function checkCustomerBookingStorage(){
 try{const key='selahflow:booking-storage-check';localStorage.setItem(key,'1');localStorage.removeItem(key);return true;}catch{return false;}
}
export function rememberCustomerBooking(token,id){
 if(isSharedTablet())return false;
 try{
  const saved=JSON.parse(localStorage.getItem(store)||'{}');
  const map=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
  map[id]=token;localStorage.setItem(store,JSON.stringify(map));localStorage.setItem('selahflow:latest-booking',id);return true;
 }catch{return false;}
}
/** Finish explicit opt-in before checkout can navigate away from the booking page. */
export async function saveCustomerBookingNotifications({token,id,subscription}){
 if(isSharedTablet())return false;
 if(!token||!id)return false;
 const stored=rememberCustomerBooking(token,id);
 if(!subscription)return false;
 if(!stored)throw Error('Your booking is saved. Allow browser storage, then enable notifications below.');
 if(typeof Notification==='undefined'||Notification.permission!=='granted')throw Error('Your booking is saved. Allow notifications in device settings, then enable them below.');
 const response=await fetch('/api/customer-booking',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({action:'subscribe',subscription}),signal:AbortSignal.timeout(10000)
 });
 const result=await response.json();
 if(!response.ok||result.subscribed!==true)throw Error('Your booking is saved, but device alerts could not be enabled. Use Enable booking notifications below to try again.');
 return true;
}
