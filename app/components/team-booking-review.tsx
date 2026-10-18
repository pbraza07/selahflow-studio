'use client';
import {useEffect,useState} from 'react';
import BookingRequestCards,{type BookingRequest} from './booking-request-cards';
import BookingApprovalEditor,{type BookingField,type EditedBooking} from './booking-approval-editor';
import DevicePushControls from './device-push-controls';
import TeamPushBell from './team-push-bell';
export default function TeamBookingReview({token}:{token:string}){
 const [customFields,setCustomFields]=useState<BookingField[]>([]),[approvalFields,setApprovalFields]=useState<string[]|undefined>(undefined),[team,setTeam]=useState<{id:string;name:string}[]>([]);const [editing,setEditing]=useState<BookingRequest|null>(null),[editError,setEditError]=useState('');const [items,setItems]=useState<BookingRequest[]>([]),[business,setBusiness]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[loaded,setLoaded]=useState(false);
 async function load(){try{const r=await fetch('/api/team/review',{headers:{Authorization:'Bearer '+token},cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Review link is unavailable.');setBusiness(d.businessName);setName(d.teamMember);setItems(d.pending||[]);setCustomFields(d.customFields||[]);setApprovalFields(d.approvalFields);setTeam(d.team||[]);setError('');}catch(e){setError((e as Error).message);}finally{setLoaded(true);}}
 useEffect(()=>{load();const interval=setInterval(load,20000);return()=>clearInterval(interval);},[token]);
 async function review(id:string,accept:boolean){setBusy(id);setNotice('');setError('');try{const r=await fetch('/api/team/review',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'review',id,accept})}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to review booking.');setNotice(accept?'Accepted and automatically added to the appointment calendar.':'Declined; no calendar appointment created.');await load();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function saveEdit(details:EditedBooking){
  if(!editing)return;
  setBusy(editing.id);setEditError('');setError('');
  try{
   const r=await fetch('/api/team/review',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({action:'editBooking',id:editing.id,details})}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to save booking details.');
   setEditing(null);setNotice('Booking details updated. Verify the corrected answers before approval.');await load();
  }catch(e){setEditError((e as Error).message);}finally{setBusy('');}
 }
 return <main className="sf-team-review-page"><header><a href="/"><img src="/brand/logo.svg?v=1.3.99" alt="SelahFlow" width="220" height="55"/></a><span>Private team booking reviews</span><TeamPushBell token={token}/></header><section className="sf-team-review-body"><h1>{business||'Booking review inbox'}</h1><p>{name?'Hello, '+name+'. ':''}Review new appointment requests assigned to you. This private link expires and can be revoked by the business owner.</p>
 {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="alert">{error}</p>}
 {loaded&&!error&&!items.length?<p className="sf-empty-notifications">No booking requests awaiting review.</p>:null}
 <DevicePushControls teamToken={token}/><div id="team-review-inbox"><BookingRequestCards items={items} busy={busy} onReview={review} onEdit={item=>{setEditing(item);setEditError('');}} team={team} customFields={customFields} approvalFields={approvalFields}/></div>
 {editing&&<BookingApprovalEditor item={editing} fields={customFields} onClose={()=>{if(!busy)setEditing(null);}} onSave={saveEdit} busy={!!busy} error={editError}/>}
 <p><small>Messages appear inside this page when open. Pending requests do not reserve a calendar slot. Acceptance can fail if a time was booked meanwhile.</small></p></section></main>;
}
