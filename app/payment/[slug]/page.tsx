'use client';
import {useEffect,useState} from 'react';
import BookingPayment from '../../components/booking-payment';
export default function PaymentReturn(){
 const [slug,setSlug]=useState(''),[status,setStatus]=useState('checking'),[amount,setAmount]=useState<number|null>(null),[retry,setRetry]=useState(0);
 const [access,setAccess]=useState<{bookingId:string;token:string}|null>(null);
 useEffect(()=>{
  const slug=window.location.pathname.split('/')[2]||'';setSlug(slug);
  try{setAccess(JSON.parse(sessionStorage.getItem('selahflow:payment:'+slug)||'null'));}catch{}
  const query=new URLSearchParams(window.location.search),session=query.get('session_id');
  if(!session){setStatus(query.get('cancelled')?'cancelled':'unavailable');return;}
  let cancelled=false,attempts=0;
  const check=async()=>{try{
   const r=await fetch('/api/public/payments/booking?slug='+encodeURIComponent(slug)+'&session_id='+encodeURIComponent(session),{cache:'no-store'}),d=await r.json();
   if(cancelled)return;if(!r.ok)throw Error();setStatus(d.status);setAmount(d.amountCents);
   if(d.status==='paid'||d.status==='expired'||++attempts>=10)clearInterval(timer);
  }catch{if(!cancelled)setStatus('unavailable');clearInterval(timer);}};
  const timer=setInterval(check,3000);void check();return()=>{cancelled=true;clearInterval(timer);};
 },[retry]);
 return <main className="public-loading" style={{maxWidth:640,margin:'40px auto',padding:24}}><h1>{status==='paid'?'Payment received':status==='cancelled'?'Checkout cancelled':'Booking payment'}</h1>
  <p role="status">{status==='paid'?'Your Stripe payment has been verified and recorded.':status==='cancelled'?'Checkout was cancelled. Your booking remains saved and unpaid; you can retry below.':status==='unavailable'?'We could not verify the payment yet. Do not pay again if your bank shows a payment; retry verification or contact the business.':status==='expired'?'This checkout link has expired. Start a new checkout below.':'Checking your payment with Stripe. Please wait before trying another payment.'}</p>
  {status==='paid'&&amount!==null&&<p>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount/100)}</p>}
  {['unavailable','pending','checking'].includes(status)&&<button className="outline" onClick={()=>{setStatus('checking');setRetry(v=>v+1);}}>Check payment status</button>}
  {['cancelled','expired'].includes(status)&&access&&<BookingPayment slug={slug} id={access.bookingId} token={access.token}/>}
  <p><a href={'/book/'+slug}>Return to booking</a></p><small>No card details are stored in SelahFlow.</small>
 </main>;
}
