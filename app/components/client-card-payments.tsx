'use client';
import {useRef,useState} from 'react';
import WhatsAppShare from './whatsapp-share';
import OwnerEmailPaymentLink from './owner-email-payment-link';
type Due={kind:'membership'|'offlineMembership'|'booking'|'invoice'|'product';id:string;label:string;email:string;date?:string;price?:number};
export type CardPayments={due:Due[];methods:string[]};
export default function ClientCardPayments({payments,name,phone,onChange}:{phone:string;payments:CardPayments;name:string;onChange:()=>void}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const keys=useRef(new Map<string,string>());
 async function send(item:Due){
  if(!window.confirm('Send a payment request for '+item.label+' to '+item.email+'?'))return;
  setBusy(true);setNotice('');
  try{
   const key=keys.current.get(item.id)||crypto.randomUUID();keys.current.set(item.id,key);
   const membership=item.kind==='membership';
   const r=await fetch('/api/studio/'+(membership?'memberships':'card-payment-request'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(membership?{action:'sendPayment',id:item.id,requestId:key}:{kind:item.kind,id:item.id,key,email:item.email})});
   const result=await r.json();if(!r.ok)throw Error(result.error||'Request failed.');
   keys.current.delete(item.id);setNotice(membership?'Payment email queued.':'Payment email submitted.');onChange();
  }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="sf-card-payment" aria-label="Payment status">
  <strong className={payments.due.length?'sf-card-payment-pending':payments.methods.length?'sf-card-payment-active':''}>{payments.due.length?'Pending payment':payments.methods.length?'Active · Paid':'No payment recorded'}</strong>
  {!!payments.methods.length&&<div>Payment method: {payments.methods.join(', ')}</div>}
  {payments.due.map(item=><div key={item.kind+item.id}><span>{item.label}</span>{item.kind==='booking'?<OwnerEmailPaymentLink appointment={{...item,name}} label="Send for payment"/>:<button className="outline small" type="button" disabled={busy||!item.email} onClick={()=>void send(item)}>Send for payment</button>}<WhatsAppShare key={item.id+phone+item.label} name={name} phone={phone} payment={item}/>{!item.email&&<small>Add a payment email first.</small>}</div>)}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
