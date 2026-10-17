'use client';
import PoweredBySelahFlow from '../../components/powered-by-selahflow';

import {useEffect,useState} from 'react';
import BookingPayment from '../../components/booking-payment';
import BusinessNavigation from '../../components/business-navigation';
import {themeStyles} from '../../../server/themes.mjs';
import type {CSSProperties} from 'react';
export default function PaymentReturn(){
 const [slug,setSlug]=useState(''),[status,setStatus]=useState('checking'),[amount,setAmount]=useState<number|null>(null),[retry,setRetry]=useState(0);
 const [access,setAccess]=useState<{bookingId:string;token:string}|null>(null);
 const [description,setDescription]=useState(''),[linkError,setLinkError]=useState('');
 const [business,setBusiness]=useState<any>(null);
 useEffect(()=>{const slug=window.location.pathname.split('/')[2]||'';let stopped=false;void fetch('/api/booking?slug='+encodeURIComponent(slug)).then(r=>r.json()).then(d=>{if(!stopped&&d.config)setBusiness(d.config);}).catch(()=>{});return()=>{stopped=true;};},[]);
 useEffect(()=>{
  const slug=window.location.pathname.split('/')[2]||'';setSlug(slug);
  try{setAccess(JSON.parse(sessionStorage.getItem('selahflow:payment:'+slug)||'null'));}catch{}
  const query=new URLSearchParams(window.location.search),session=query.get('session_id');
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  if(!session&&fragment.has('token')){
   const access={bookingId:fragment.get('booking_id')||'',token:fragment.get('token')||''};
   setAccess(access);let stopped=false;
   void fetch('/api/public/payments/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview',slug,...access})}).then(async r=>{const d=await r.json();if(stopped)return;if(!r.ok)throw Error(d.error);setStatus(d.status);setAmount(d.amountCents);setDescription(d.business+' · '+d.date+' · '+String(Math.floor(d.start/60)).padStart(2,'0')+':'+String(d.start%60).padStart(2,'0')+' Eastern');}).catch(e=>{if(!stopped){setStatus('invalid_link');setLinkError(e.message||'Payment link unavailable.');}});
   return()=>{stopped=true;};
  }
  if(!session){setStatus(query.get('cancelled')?'cancelled':'unavailable');return;}
  let cancelled=false,attempts=0;
  const check=async()=>{try{
   const r=await fetch('/api/public/payments/booking?slug='+encodeURIComponent(slug)+'&session_id='+encodeURIComponent(session),{cache:'no-store'}),d=await r.json();
   if(cancelled)return;if(!r.ok)throw Error();setStatus(d.status);setAmount(d.amountCents);
   if(d.status==='paid'||d.status==='expired'||++attempts>=10)clearInterval(timer);
  }catch{if(!cancelled)setStatus('unavailable');clearInterval(timer);}};
  const timer=setInterval(check,3000);void check();return()=>{cancelled=true;clearInterval(timer);};
 },[retry]);
 return <div data-selah-theme="true" style={business?themeStyles(business.theme,business.brand_primary,business.brand_background) as CSSProperties:undefined}><BusinessNavigation slug={slug} name={business?.name||'Booking payment'}/><main className="public-loading" style={{maxWidth:640,margin:'40px auto',padding:24}}><h1>{status==='paid'?'Payment received':status==='cancelled'?'Checkout cancelled':'Booking payment'}</h1>
  <p role="status">{status==='ready'?'Your booking is approved. Select Make Payment to pay securely with Stripe.':status==='invalid_link'?linkError:status==='paid'?'Your Stripe payment has been verified and recorded.':status==='cancelled'?(access?'Checkout was cancelled. Your booking remains saved and unpaid; you can retry below.':'Checkout was cancelled. Your booking remains saved. Check your registration to retry payment.'):status==='unavailable'?'We could not verify the payment yet. Do not pay again if your bank shows a payment; retry verification or contact the business.':status==='expired'?'This checkout link has expired. Check your registration to retry payment.':'Checking your payment with Stripe. Please wait before trying another payment.'}</p>
  {description&&<p>{description}</p>}
  {['paid','ready'].includes(status)&&amount!==null&&<p>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount/100)}</p>}
  {['unavailable','pending','checking'].includes(status)&&<button className="outline" onClick={()=>{setStatus('checking');setRetry(v=>v+1);}}>Check payment status</button>}
  {['ready','cancelled','expired'].includes(status)&&access&&<BookingPayment slug={slug} id={access.bookingId} token={access.token}/>}
  <p><a href={'/book/'+slug+'#registration-status'}>Check registration &amp; membership</a></p><small>No card details are stored in SelahFlow.</small>
 </main><PoweredBySelahFlow/></div>;
}
