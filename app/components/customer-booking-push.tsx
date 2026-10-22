'use client';
import {useEffect,useState} from 'react';
const store='selahflow:customer-bookings';
const fromStore=()=>{try{return JSON.parse(localStorage.getItem(store)||'{}') as Record<string,string>;}catch{return {};}};
import {ensurePushSubscription} from '../../lib/browser-push.mjs';
export default function CustomerBookingPush({token,id}:{token:string;id:string}){
 const [state,setState]=useState('');
 useEffect(()=>{if(token&&id){const map=fromStore();map[id]=token;localStorage.setItem(store,JSON.stringify(map));localStorage.setItem('selahflow:latest-booking',id);}},[token,id]);
 async function enable(){
  try{
   if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Push notifications are not supported on this browser. On iPhone, add SelahFlow to your Home Screen first.');
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw Error('Notifications were not enabled. Allow them in device settings.');
   const reg=await navigator.serviceWorker.register('/sw.js');
   await navigator.serviceWorker.ready;
   const config=await fetch('/api/push/customer-key').then(r=>r.json());
   if(!config.publicKey)throw Error('Push notifications are not configured by SelahFlow yet.');
   const sub=await ensurePushSubscription(reg,config.publicKey);
   const res=await fetch('/api/customer-booking',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'subscribe',subscription:sub.toJSON()})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Could not enable notifications.');
   setState('Notifications enabled for this booking.');
  }catch(e){setState((e as Error).message);}
 }
 return <section style={{margin:'16px 0'}}><button type="button" className="outline" onClick={()=>void enable()}>Enable booking status push notifications</button><p className="muted">Optional. Receive a device notification when the business confirms or declines this booking. You can view its status at any time.</p><a href="/customer/booking">View my booking status</a>{state&&<p role="status">{state}</p>}</section>;
}
