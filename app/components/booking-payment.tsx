'use client';
import {useEffect,useState} from 'react';
export async function makeBookingPayment(slug:string,bookingId:string,token:string){
 try{sessionStorage.setItem('selahflow:payment:'+slug,JSON.stringify({bookingId,token}));}catch{}
 const response=await fetch('/api/public/payments/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,bookingId,token})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to start payment.');
 if(result.checkoutUrl&&/^https:\/\/checkout\.stripe\.com\//.test(result.checkoutUrl))window.location.assign(result.checkoutUrl);
 else if(!result.paid)throw Error('No secure checkout link was returned.');return result;
}
export default function BookingPayment({slug,id,token,pending=false,onsiteAllowed=false,onlineAllowed=true,preferOnsite=false}:{slug:string;id:string;token:string;pending?:boolean;onsiteAllowed?:boolean;onlineAllowed?:boolean;preferOnsite?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[paid,setPaid]=useState(false),[onsiteInfo,setOnsiteInfo]=useState(false);
 const [direct,setDirect]=useState(false),[availability,setAvailability]=useState('checking'),[revision,setRevision]=useState(0),[options,setOptions]=useState({online:onlineAllowed,onsite:onsiteAllowed});
 useEffect(()=>{let stopped=false;setAvailability('checking');setError('');void fetch('/api/public/payments/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview',slug,bookingId:id,token})}).then(async r=>{const d=await r.json();if(stopped)return;if(!r.ok)throw Error(d.error||'Payment unavailable.');setDirect(d.status==='ready');setAvailability(d.status);if(d.paymentOptions)setOptions(d.paymentOptions);if(d.paymentChoice==='onsite')setOnsiteInfo(true);if(d.status==='paid')setPaid(true);}).catch(e=>{if(!stopped){setAvailability('unavailable');setError(e.message);}});return()=>{stopped=true;};},[slug,id,token,pending,revision]);
 const onsite=async()=>{setBusy(true);setError('');try{const r=await fetch('/api/public/payments/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'onsite',slug,bookingId:id,token})}),d=await r.json();if(!r.ok)throw Error(d.error);if(d.paid)setPaid(true);else setOnsiteInfo(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 if(availability==='covered')return <p>No payment due. This booking is free or covered by membership.</p>;
 return <section aria-label="Booking payment" style={{margin:'16px 0'}}>
  {availability==='full'&&<p role="status"><strong>Session is now full.</strong> Please choose another session. Booking and payment are unavailable for this request.</p>}
  {paid?<p role="status">Payment verified. Thank you!</p>:availability!=='full'&&<>
   {options.online&&<button type="button" className={preferOnsite?"outline":"primary"} disabled={busy||availability!=='ready'} onClick={async()=>{setBusy(true);setError('');try{const d=await makeBookingPayment(slug,id,token);if(d.paid)setPaid(true);}catch(e){const message=(e as Error).message;setError(message);if(message.includes('Session is now full'))setAvailability('full');}finally{setBusy(false);}}}>{availability==='checking'?'Checking availability…':busy?'Opening secure checkout…':'Make Payment'}</button>}
   {options.onsite&&<button type="button" className={preferOnsite?"primary":"outline"} disabled={busy||availability==='checking'||availability==='unavailable'} onClick={()=>void onsite()}>Pay on Site</button>}
   {onsiteInfo&&<p role="status">Pay on Site selected. Pay the business when you arrive{pending||availability==='awaiting_approval'?' after your booking is approved':''}. This booking is still unpaid.</p>}
   <small style={{display:'block',marginTop:8}}>{availability==='awaiting_approval'||pending&&!direct?'Payment becomes available after the business accepts this booking. You can save your Pay on Site preference now.':availability==='onsite'?'Payment is due at the business. No online charge is made.':pending?'Approval is not required. Make Payment reserves your available time and opens secure Stripe checkout.':'Secure checkout with Stripe. Your booking is saved even if you cancel checkout.'}</small>
  </>}
  {!paid&&availability!=='checking'&&<button type="button" className="outline" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh payment availability</button>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
