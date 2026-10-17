'use client';
import {useState} from 'react';
import styles from './registration-payment.module.css';
export type RegistrationPaymentState={state:string;amountCents?:number;slug?:string;bookingId?:string};
export default function RegistrationPayment({payment,memberNumber}:{payment:RegistrationPaymentState|null;memberNumber:string}){
 const [verify,setVerify]=useState(false),[dob,setDob]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[paid,setPaid]=useState(false);
 if(!payment)return null;
 const amount=typeof payment.amountCents==='number'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(payment.amountCents/100):'';
 return <section className={styles.panel} aria-label="Registration payment">
 {paid||payment.state==='paid'?<p role="status"><strong>Payment received.</strong> Your Stripe payment has been verified.</p>:payment.state==='covered'?<p><strong>No payment due.</strong> This booking is free or covered by membership.</p>:payment.state==='awaiting_approval'?<p>Payment becomes available here after the owner approves your booking.</p>:payment.state==='contact_business'?<p><strong>Payment due: {amount}.</strong> Contact the business to arrange payment. Online checkout is not available yet.</p>:payment.state==='due'?<><p><strong>Booking approved · Payment due: {amount}</strong></p>{!verify?<button type="button" className="primary" onClick={()=>setVerify(true)}>Make Payment</button>:<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{
 const r=await fetch('/api/public/payments/booking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'registration',slug:payment.slug,bookingId:payment.bookingId,memberNumber,dateOfBirth:dob})});const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to open secure payment.');
 if(d.paid)setPaid(true);else if(d.checkoutUrl&&/^https:\/\/checkout\.stripe\.com\//.test(d.checkoutUrl)){try{sessionStorage.removeItem('selahflow:payment:'+payment.slug);}catch{}window.location.assign(d.checkoutUrl);}else throw Error('Secure checkout is unavailable. Please try again.');
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><p>Confirm the date of birth used at registration to open your secure checkout.</p><label>Registration date of birth<input type="date" required value={dob} onChange={e=>setDob(e.target.value)} disabled={busy}/></label><div className="button-row"><button className="primary" type="submit" disabled={busy}>{busy?'Opening secure checkout…':'Continue to Stripe'}</button><button className="outline" type="button" disabled={busy} onClick={()=>{setVerify(false);setDob('');setError('');}}>Cancel</button></div></form>}<small>Secure payment with Stripe. Your saved booking and membership details are preserved.</small></>:null}
 {error&&<p role="alert">{error}</p>}
 </section>;
}
