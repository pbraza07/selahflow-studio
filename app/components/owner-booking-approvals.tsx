'use client';
import {useEffect,useState} from 'react';
import BookingRequestCards,{type BookingRequest} from './booking-request-cards';
import BookingApprovalEditor,{type BookingField,type EditedBooking} from './booking-approval-editor';
import ClientPaymentDelivery,{type ClientMessage} from './client-payment-delivery';
type Staff={id:string;name:string};
export default function OwnerBookingApprovals({staff,showHistory=true}:{staff:Staff[];showHistory?:boolean}){
 const [clientMessages,setClientMessages]=useState<ClientMessage[]>([]),[providers,setProviders]=useState({emailConfigured:false,smsConfigured:false});
 const [customFields,setCustomFields]=useState<BookingField[]>([]),[approvalFields,setApprovalFields]=useState<string[]|undefined>(undefined);const [editing,setEditing]=useState<BookingRequest|null>(null),[editError,setEditError]=useState('');const [items,setItems]=useState<BookingRequest[]>([]),[delivery,setDelivery]=useState<Record<string,Record<string,{status:string;destination:string}>>>({}),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function refresh(){try{const r=await fetch('/api/studio/approvals',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Review inbox unavailable.');setItems(d.pending||[]);setClientMessages(d.clientMessages||[]);setProviders(d.providerStatus||{emailConfigured:false,smsConfigured:false});setCustomFields(d.customFields||[]);setApprovalFields(d.approvalFields);setEnabled(d.enabled);setDelivery(d.deliveryStatus||{});setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{refresh();const id=setInterval(refresh,20000);return()=>clearInterval(id);},[]);
 async function review(id:string,accept:boolean){setBusy(id);setNotice('');setError('');try{const r=await fetch('/api/studio/approvals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',id,accept})}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to review booking.');setNotice(accept?'Accepted. The appointment is confirmed on your calendar.':'Declined. No calendar appointment was created.');await refresh();window.dispatchEvent(new Event('selahflow:booking-reviewed'));}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function saveEdit(details:EditedBooking){
  if(!editing)return;
  setBusy(editing.id);setEditError('');setError('');
  try{
   const r=await fetch('/api/studio/approvals',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'editBooking',id:editing.id,details})}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Could not save booking details.');
   setEditing(null);setNotice('Booking details updated. Review the updated answers before approving.');await refresh();
  }catch(e){setEditError((e as Error).message);}finally{setBusy('');}
 }
 async function retry(id:string){setBusy(id);setError('');setNotice('');try{const r=await fetch('/api/studio/approvals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resendNotification',id})}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not retry notification.');setNotice('Delivery provider result — email: '+(d.delivery?.email||'not selected')+'; SMS: '+(d.delivery?.sms||'not selected')+'.');await refresh();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 if(!enabled&&items.length===0&&(!showHistory||clientMessages.length===0))return null;
 return <section id="booking-notifications" className="panel padded section-gap sf-approval-inbox" aria-label="Booking approval notifications">
 <div className="sf-approval-heading"><div><h2>Booking approval notifications {items.length>0?<span className="sf-request-badge">{items.length} waiting</span>:null}</h2><p className="muted">New requests appear here automatically while your dashboard is open. Accept to confirm and add the booking to the calendar. Decline to leave the calendar unchanged.</p></div><button type="button" className="outline" onClick={refresh}>Refresh requests</button></div>
 {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="alert">{error}</p>}
 {items.length?<><BookingRequestCards items={items} busy={busy} onReview={review} onEdit={item=>{setEditing(item);setEditError('');}} team={staff} customFields={customFields} approvalFields={approvalFields}/><div className="sf-approval-delivery">{items.map(item=><div key={item.id}><strong>{item.details.customerName}:</strong> <span>Email: {delivery[item.id]?.email?.status||'Not sent'}{delivery[item.id]?.email?.destination?' ('+delivery[item.id].email.destination+')':''} · SMS: {delivery[item.id]?.sms?.status||'Not sent'}{delivery[item.id]?.sms?.destination?' ('+delivery[item.id].sms.destination+')':''}</span> <button type="button" className="outline" disabled={!!busy} onClick={()=>retry(item.id)}>Retry unsent notifications</button></div>)}</div></>:<p className="muted">No appointments are awaiting approval.</p>}
 {editing&&<BookingApprovalEditor item={editing} fields={customFields} onClose={()=>{if(!busy)setEditing(null);}} onSave={saveEdit} busy={!!busy} error={editError}/>}
 {showHistory&&<ClientPaymentDelivery messages={clientMessages} providers={providers} onRefresh={refresh}/>}
 <p className="muted"><small>Email and SMS are sent through configured providers when enabled. “Submitted” means the provider accepted the message, not guaranteed delivery. Failed or unconfigured channels stay visible. Pending times are not reserved until accepted.</small></p>
 </section>;
}
