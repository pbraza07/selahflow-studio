'use client';
import {useEffect,useState} from 'react';
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
 const [direct,setDirect]=useState(false),[availability,setAvailability]=useState('checking'),[revision,setRevision]=useState(0);
 useEffect(()=>{let stopped=false;setAvailability('checking');setError('');void fetch('/api/public/payments/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview',slug,bookingId:id,token})}).then(async r=>{const d=await r.json();if(stopped)return;if(!r.ok)throw Error(d.error||'Payment unavailable.');setDirect(d.status==='ready');setAvailability(d.status);if(d.status==='paid')setPaid(true);}).catch(e=>{if(!stopped){setAvailability('unavailable');setError(e.message);}});return()=>{stopped=true;};},[slug,id,token,pending,revision]);
 return <section aria-label="Booking payment" style={{margin:'16px 0'}}>
  {availability==='full'&&<p role="status"><strong>Session is now full.</strong> Please choose another session. Booking and payment are unavailable for this request.</p>}
  {paid?<p role="status">Payment verified. Thank you!</p>:availability!=='full'&&<button type="button" className="primary" disabled={busy||availability!=='ready'} onClick={async()=>{setBusy(true);setError('');try{const d=await makeBookingPayment(slug,id,token);if(d.paid)setPaid(true);}catch(e){const message=(e as Error).message;setError(message);if(message.includes('Session is now full'))setAvailability('full');}finally{setBusy(false);}}}>{availability==='checking'?'Checking availability…':busy?'Opening secure checkout…':'Make Payment'}</button>}
  {!paid&&availability!=='full'&&<small style={{display:'block',marginTop:8}}>{pending&&!direct?'Payment becomes available after the business accepts this booking. You can check again here.':pending?'Approval is not required. Make Payment reserves your available time and opens secure Stripe checkout.':'Secure checkout with Stripe. Your booking is saved even if you cancel checkout.'}</small>}
  {!paid&&availability!=='checking'&&<button type="button" className="outline" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh payment availability</button>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
