'use client';
import {useState} from 'react';
export async function makeBookingPayment(slug:string,bookingId:string,token:string){
 try{sessionStorage.setItem('selahflow:payment:'+slug,JSON.stringify({bookingId,token}));}catch{}
 const response=await fetch('/api/public/payments/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,bookingId,token})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to start payment.');
 if(result.checkoutUrl&&/^https:\/\/checkout\.stripe\.com\//.test(result.checkoutUrl))window.location.assign(result.checkoutUrl);
 else if(!result.paid)throw Error('No secure checkout link was returned.');
 return result;
}
export default function BookingPayment({slug,id,token,pending=false}:{slug:string;id:string;token:string;pending?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[paid,setPaid]=useState(false);
 return <section aria-label="Booking payment" style={{margin:'16px 0'}}>
  {paid?<p role="status">Payment verified. Thank you!</p>:<button type="button" className="primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const d=await makeBookingPayment(slug,id,token);if(d.paid)setPaid(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?'Opening secure checkout…':'Make Payment'}</button>}
  {!paid&&<small style={{display:'block',marginTop:8}}>{pending?'Payment becomes available after the business accepts this booking. You can check again here.':'Secure checkout with Stripe. Your booking is saved even if you cancel checkout.'}</small>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
