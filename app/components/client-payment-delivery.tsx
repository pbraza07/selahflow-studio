'use client';
import {useState} from 'react';
export type ClientMessage={id:string;booking_id:string;event_type:string;channel:string;destination_masked:string;status:string;detail:string;date:string;payment_status:string|null};
export default function ClientPaymentDelivery({messages,providers,onRefresh}:{messages:ClientMessage[];providers:{emailConfigured:boolean;smsConfigured:boolean;emailProvider?:string};onRefresh:()=>Promise<void>}){
 const [busy,setBusy]=useState(''),[notice,setNotice]=useState('');
 const bookings=Array.from(new Set(messages.map(m=>m.booking_id)));
 async function retry(id:string){setBusy(id);setNotice('');try{const r=await fetch('/api/studio/approvals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'retryClientMessages',id})}),d=await r.json();if(!r.ok)throw Error(d.error);setNotice(d.queued?'Unsent client messages queued.':'No messages eligible yet. Wait one minute after the last attempt.');await onRefresh();}catch(e){setNotice((e as Error).message);}finally{setBusy('');}}
 return <section aria-label="Client payment messages" style={{marginTop:24}}><h3>Client payment links and confirmations</h3>
 <p className="muted">Approval automatically requests payment by email and text using the client’s saved registration details. Stripe-verified payment queues both confirmations. Membership-covered and free bookings require no payment.</p>
 <p>Email ({providers.emailProvider||'Email service'}): {providers.emailConfigured?'Configured':'Not configured / staging disabled'} · SMS: {providers.smsConfigured?'Configured':'Not configured / staging disabled'}</p>
 <p className="muted"><small>SMS needs a phone number with its country code, for example +14155552671. Staging delivery also requires an approved test recipient. “Submitted” means accepted by the provider. An unknown outcome needs a provider check before resending.</small></p>
 {notice&&<p role="status">{notice}</p>}
 {!bookings.length&&<p className="muted">Approved bookings with an amount due will appear here.</p>}
 {bookings.map(id=>{const rows=messages.filter(m=>m.booking_id===id);return <div key={id} style={{borderTop:'1px solid var(--line)',padding:'16px 0'}}><strong>{rows[0].date} · {rows[0].payment_status==='paid'?'Payment received':'Payment due'}</strong><small style={{display:'block'}}>Booking {id.slice(0,8)}</small>
 {rows.map(m=><p key={m.id} style={{margin:'8px 0'}}>{m.event_type==='payment_link'?'Payment link':'Payment confirmation'} · {m.channel==='sms'?'SMS':'Email'} {m.destination_masked||'(not supplied)'}: <strong>{m.status.replaceAll('_',' ')}</strong>{!['submitted','queued'].includes(m.status)&&<small style={{display:'block'}}>{m.detail}</small>}</p>)}
 {rows.some(m=>['failed','not_configured'].includes(m.status))&&<button className="outline" disabled={!!busy} onClick={()=>retry(id)}>{busy===id?'Queuing…':'Retry unsent client messages'}</button>}</div>;})}
 </section>;
}
