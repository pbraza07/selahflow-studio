'use client';
import {useEffect,useState} from 'react';
import {businessDeviceName} from '../../server/business-device-name.mjs';
import {ensurePushSubscription} from '../../lib/browser-push.mjs';
export default function DevicePushControls({teamToken,teamWorkspace=false}:{teamToken?:string;teamWorkspace?:boolean}){
 const [supported,setSupported]=useState(false),[installed,setInstalled]=useState(false),[permission,setPermission]=useState('default'),[ready,setReady]=useState(false),[configured,setConfigured]=useState(false),[devices,setDevices]=useState(0),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[businessName,setBusinessName]=useState(''),[businessSlug,setBusinessSlug]=useState('');
 const api=teamWorkspace?'/api/team/push':'/api/push';
 const headers:Record<string,string>=teamToken?{Authorization:'Bearer '+teamToken}:{};
 const ios=typeof navigator!=='undefined'&&/iPad|iPhone|iPod/.test(navigator.userAgent);
 async function refresh(){
  const capable=typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  setSupported(capable);
  setInstalled(window.matchMedia('(display-mode: standalone)').matches||('standalone' in navigator&&(navigator as any).standalone===true));
  if(!capable){setReady(true);return;}
  setPermission(Notification.permission);
  setInstalled(window.matchMedia('(display-mode: standalone)').matches||('standalone' in navigator&&(navigator as any).standalone===true));
  try{
   const r=await fetch(api,{headers,cache:'no-store'}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to check push service.');
   setConfigured(d.configured===true);setDevices(d.subscribedDevices||0);setBusinessName(typeof d.businessName==='string'?d.businessName:'');setBusinessSlug(typeof d.businessSlug==='string'?d.businessSlug:'');
   if(!d.configured){setEnabled(false);setReady(true);setStatus(d.reason==='staging_disabled'?'Push is disabled in this staging environment.':d.reason==='invalid_keys'?'The server push credentials need repair. Contact the platform administrator.':'Push keys have not been configured on the SelahFlow server.');return;}
   const reg=await navigator.serviceWorker.getRegistration('/');
   const subscription=await reg?.pushManager.getSubscription();
   setEnabled(Boolean(subscription)&&Notification.permission==='granted'&&Array.isArray(d.subscribedEndpoints)&&d.subscribedEndpoints.includes(subscription?.endpoint));
   setReady(true);
  }catch(e){setReady(true);setStatus((e as Error).message);}
 }
 useEffect(()=>{
  void refresh();
  const resume=()=>{if(document.visibilityState==='visible')void refresh();};
  window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return ()=>{window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[teamToken,teamWorkspace]);
 async function enable(){
  setStatus('');setBusy(true);
  try{
   if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('This browser does not support Web Push. Try Safari on an installed iPhone Home Screen app or a current Android/desktop browser.');
   if(ios&&!window.matchMedia('(display-mode: standalone)').matches&&!(navigator as any).standalone)throw Error('On iPhone, open SelahFlow in Safari, tap Share → Add to Home Screen, then launch it from the Home Screen to enable notifications.');
   // iOS requires the permission prompt to originate directly from this user tap.
   const decision=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
   setPermission(decision);
   if(decision!=='granted')throw Error('Notification permission was not granted. Change it in your device/browser notification settings.');
   const response=await fetch(api,{headers,cache:'no-store'}),configuration=await response.json();
   if(!response.ok||!configuration.configured||!configuration.publicKey)throw Error(configuration.error||'The push provider needs to be configured by SelahFlow.');
   const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
   await navigator.serviceWorker.ready;
   const subscription=await ensurePushSubscription(registration,configuration.publicKey);
   const save=await fetch(api,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'subscribe',subscription:subscription.toJSON()})});
   const result=await save.json();
   if(!save.ok)throw Error(result.error||'Device registration failed.');
   setEnabled(true);setConfigured(true);
   setStatus('Notifications enabled for '+businessDeviceName(configuration.businessName||businessName)+(teamWorkspace?'. Scheduled appointments will notify this device. Time-off blocks do not send notifications.':'. New booking requests will identify this business.'));
   await refresh();
  }catch(e){setStatus((e as Error).message);}finally{setBusy(false);}
 }
 async function testDevice(){
  setBusy(true);setStatus('');
  try{
   const reg=await navigator.serviceWorker.getRegistration('/');
   const subscription=await reg?.pushManager.getSubscription();
   if(!subscription)throw Error('Enable notifications on this device first.');
   const response=await fetch(api,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'test',endpoint:subscription.endpoint})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Test notification could not be sent.');
   setStatus('Test accepted by the push provider. Check this device’s notifications. If it is silent, check Focus and notification settings.');
  }catch(e){setStatus((e as Error).message);await refresh();}finally{setBusy(false);}
 }
 async function disable(){
  setBusy(true);setStatus('');
  try{
   const reg=await navigator.serviceWorker.getRegistration('/');
   const subscription=await reg?.pushManager.getSubscription();
   if(subscription){
    const r=await fetch(api,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'unsubscribe',endpoint:subscription.endpoint})});
    if(!r.ok)throw Error((await r.json()).error||'Unable to remove device.');
    // Browser push subscription stays active for any other opted-in businesses.
   }
   setEnabled(false);setStatus('Notifications disabled for this business on this device. Other businesses are unaffected.');await refresh();
  }catch(e){setStatus((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="sf-push-settings" aria-label="Device push notifications">
 <div className="sf-push-settings-head"><div><strong>{teamWorkspace?'My booking notifications':'Device push notifications'}</strong><p>Get booking alerts on this phone or computer even when SelahFlow is closed. Each device must opt in separately.</p>{businessName&&<p className="sf-device-app-label"><b>Business notification name:</b> {businessDeviceName(businessName)}</p>}</div><span className={enabled?'sf-push-on':'sf-push-off'}>{!ready?'Checking…':enabled?'Enabled':'Not enabled'}</span></div>
 <p className="muted"><small>Device permission: {permission} · {teamWorkspace?'My registered devices:':'Registered reviewer devices:'} {devices} · {configured?'Push server configured':'Push server setup required'}</small></p>
 {ios&&!installed&&<p className="sf-push-instructions">iPhone: While viewing this business's SelahFlow page in Safari, tap <b>Share → Add to Home Screen</b>. The suggested app name is <b>{businessDeviceName(businessName)}</b>. Then launch this business's icon and select Enable notifications.</p>}
 {!supported&&<p className="sf-push-instructions">Web Push is not available in this browser. Use a supported current browser; iOS requires an installed Home Screen web app (iOS 16.4+).</p>}
 <div className="sf-push-buttons"><button type="button" className="primary" onClick={enable} disabled={busy||!supported||!configured||(ios&&!installed)}>{busy?'Working…':enabled?'Re-enable notifications':teamWorkspace?'Enable booking notifications':'Enable notifications on this device'}</button>{enabled&&<button type="button" className="outline" disabled={busy} onClick={testDevice}>Send test notification</button>}{enabled&&<button type="button" className="outline" disabled={busy} onClick={disable}>Disable on this device</button>}</div>
 {status&&<p role="status" className="sf-push-status">{status}</p>}
 <small>Each business has its own notification identity. For an existing Home Screen icon, remove and reinstall the shortcut to update its name. Browser or iOS permission prompts may still display the website address or original app name; the operating system controls that text. Email/SMS remain independent.</small>
 </section>;
}
