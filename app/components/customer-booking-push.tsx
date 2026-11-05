'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,BellOff} from 'lucide-react';
import {ensurePushSubscription} from '../../lib/browser-push.mjs';
import {rememberCustomerBooking,checkCustomerBookingStorage} from '../../lib/browser-customer-booking.mjs';
type Props={token?:string;id?:string;showStatusLink?:boolean;disabled?:boolean;onBusyChange?:(busy:boolean)=>void;onPreparedChange?:(subscription:PushSubscriptionJSON|null)=>void};
export default function CustomerBookingPush({token='',id='',showStatusLink=true,disabled=false,onPreparedChange,onBusyChange}:Props){
 const draft=!token||!id;
 const prepared=useRef<PushSubscriptionJSON|null>(null);
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[supported,setSupported]=useState(false),[installRequired,setInstallRequired]=useState(false),[permission,setPermission]=useState('default'),[configured,setConfigured]=useState(false);
 async function request(body:Record<string,unknown>){
  const res=await fetch('/api/customer-booking',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Could not update notifications.');return data;
 }
 async function refresh(){
  const capable='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  setInstallRequired(ios&&!window.matchMedia('(display-mode: standalone)').matches&&!(navigator as any).standalone);
  setSupported(capable);setPermission('Notification'in window?Notification.permission:'unavailable');
  try{
   const res=await fetch('/api/push/customer-key',{cache:'no-store'}),config=await res.json();
   setConfigured(res.ok&&Boolean(config.publicKey));
   if(capable){
    const reg=await navigator.serviceWorker.getRegistration('/'),sub=await reg?.pushManager.getSubscription();
    const active=Boolean(sub)&&Notification.permission==='granted';
    if(draft){
     const selected=active&&prepared.current?.endpoint===sub?.endpoint;
     setEnabled(Boolean(selected));
     if(!selected&&prepared.current){prepared.current=null;onPreparedChange?.(null);}
    }else setEnabled(active&&(await request({action:'status',endpoint:sub!.endpoint})).subscribed===true);
   }
  }catch{setStatus('Unable to check device notifications. Try again.');}finally{setReady(true);}
 }
 useEffect(()=>{
  if(token&&id)rememberCustomerBooking(token,id);
  void refresh();
  const resume=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[token,id]);
 async function enable(){
  setBusy(true);onBusyChange?.(true);setStatus('');
  try{
   if(!supported||installRequired)throw Error('On iPhone or iPad, add SelahFlow to your Home Screen, open it there, then enable notifications.');
   if(!(draft?checkCustomerBookingStorage():rememberCustomerBooking(token,id)))throw Error('Allow browser storage on this device so the notification can securely open your booking.');
   // Request permission directly from this tap, before any network request.
   const decision=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
   setPermission(decision);
   if(decision!=='granted')throw Error('Notifications were not enabled. Allow them in device settings.');
   const response=await fetch('/api/push/customer-key',{cache:'no-store'}),config=await response.json();
   if(!response.ok||!config.publicKey)throw Error('Push notifications are not configured by SelahFlow yet.');
   const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
   await navigator.serviceWorker.ready;
   const sub=await ensurePushSubscription(reg,config.publicKey);
   if(draft){prepared.current=sub.toJSON();onPreparedChange?.(prepared.current);}
   else await request({action:'subscribe',subscription:sub.toJSON()});
   setEnabled(true);setConfigured(true);setStatus(draft?'Ready. Complete your booking to receive session confirmation alerts and a link to pay when payment is due.':'Notifications enabled for this booking. An acceptance alert opens your booking and payment options.');
  }catch(e){setStatus((e as Error).message);}finally{setBusy(false);onBusyChange?.(false);}
 }
 async function disable(){
  setBusy(true);onBusyChange?.(true);setStatus('');
  try{
   if(draft){prepared.current=null;onPreparedChange?.(null);}
   else{const reg=await navigator.serviceWorker.getRegistration('/'),sub=await reg?.pushManager.getSubscription();
    if(sub)await request({action:'unsubscribe',endpoint:sub.endpoint});
   }
   // Retain the browser subscription for other bookings and businesses.
   setEnabled(false);setStatus(draft?'Session notifications are not selected for this booking.':'Notifications disabled for this booking on this device.');
  }catch(e){setStatus((e as Error).message);}finally{setBusy(false);onBusyChange?.(false);}
 }
 return <section className={'sf-push-settings'+(draft?' sf-booking-notification-opt-in':'')} aria-label="Booking device notifications">
  <div className="sf-push-settings-head"><div><strong>{draft?'Session confirmations & payment links':'Booking updates on this device'}</strong><p>Get notified when the owner accepts or declines your request. Tap the acceptance alert to view your booking and pay securely when payment is due.</p></div><span className={enabled?'sf-push-on':'sf-push-off'}>{!ready?'Checking…':enabled?(draft?'Ready after booking':'Enabled'):'Not enabled'}</span></div>
  {installRequired&&<p className="sf-push-instructions">iPhone or iPad: tap <b>Share → Add to Home Screen</b>, then open SelahFlow from its Home Screen icon to book and enable notifications. Requires iOS 16.4 or later.</p>}
  {ready&&!supported&&!installRequired&&<p className="sf-push-instructions">Web Push is unavailable in this browser. You can still use your booking confirmation and payment options.</p>}
  {ready&&!configured&&<p className="muted">Device notifications are unavailable at the moment. Your booking status and payment options remain available.</p>}
  {permission==='denied'&&<p className="sf-push-instructions">Notifications are blocked. Allow them in your browser or device settings, then return here.</p>}
  <div className="sf-push-buttons"><button type="button" className="outline" onClick={()=>void(enabled?disable():enable())} disabled={disabled||busy||!ready||(!enabled&&(!supported||!configured||installRequired||permission==='denied'))}>{enabled?<BellOff size={17}/>:<Bell size={17}/>} {busy?'Updating…':enabled?(draft?'Turn off for this booking':'Disable on this device'):(draft?'Enable session notifications':'Enable booking notifications')}</button>{!draft&&showStatusLink&&<a href={'/customer/booking?id='+encodeURIComponent(id)}>View booking &amp; payment</a>}</div>
  <small>Optional. Each device must opt in separately. Your browser and device settings control notification delivery.</small>
  {status&&<p role="status" className="sf-push-status">{status}</p>}
 </section>;
}
