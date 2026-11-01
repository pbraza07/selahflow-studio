'use client';
import {useEffect,useState} from 'react';
import BookingRequestCards,{type BookingRequest} from './booking-request-cards';
import BookingApprovalEditor,{type BookingField,type EditedBooking} from './booking-approval-editor';
import DevicePushControls from './device-push-controls';
import TeamPushBell from './team-push-bell';
export default function TeamBookingReview({token,embedded=false,onCount,onChanged}:{token?:string;embedded?:boolean;onCount?:(count:number)=>void;onChanged?:()=>Promise<void>}){
 const [canReview,setCanReview]=useState(true);const authHeaders:Record<string,string>=token?{Authorization:'Bearer '+token}:{};
 const [customFields,setCustomFields]=useState<BookingField[]>([]),[approvalFields,setApprovalFields]=useState<string[]|undefined>(undefined),[team,setTeam]=useState<{id:string;name:string}[]>([]);const [editing,setEditing]=useState<BookingRequest|null>(null),[editError,setEditError]=useState('');const [items,setItems]=useState<BookingRequest[]>([]),[business,setBusiness]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[loaded,setLoaded]=useState(false);
 async function load(){try{const r=await fetch('/api/team/review',{headers:authHeaders,cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(embedded?'Booking requests are unavailable. Refresh or sign in again.':d.error||'Review link is unavailable.');setCanReview(d.canReview!==false);onCount?.((d.pending||[]).length);setBusiness(d.businessName);setName(d.teamMember);setItems(d.pending||[]);setCustomFields(d.customFields||[]);setApprovalFields(d.approvalFields);setTeam(d.team||[]);setError('');}catch(e){setItems([]);onCount?.(0);setError((e as Error).message);}finally{setLoaded(true);}}
 useEffect(()=>{load();const interval=setInterval(load,20000);return()=>clearInterval(interval);},[token]);
 async function review(id:string,accept:boolean){setBusy(id);setNotice('');setError('');try{const r=await fetch('/api/team/review',{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({action:'review',id,accept})}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to review booking.');setNotice(accept?'Accepted and automatically added to the appointment calendar.':'Declined; no calendar appointment created.');await load();await onChanged?.();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function saveEdit(details:EditedBooking){
  if(!editing)return;
  setBusy(editing.id);setEditError('');setError('');
  try{
   const r=await fetch('/api/team/review',{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},
    body:JSON.stringify({action:'editBooking',id:editing.id,details})}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Unable to save booking details.');
   setEditing(null);setNotice('Booking details updated. Verify the corrected answers before approval.');await load();
  }catch(e){setEditError((e as Error).message);}finally{setBusy('');}
 }
 const content=<>{embedded?<h2>Requests awaiting your review</h2>:<h1>{business||'Booking review inbox'}</h1>}<p>{embedded?'Approve or decline bookings assigned to you. The business owner can also review these requests; the first decision updates the booking for both of you.':(name?'Hello, '+name+'. ':'')+'Review new appointment requests assigned to you. This private link expires and can be revoked by the business owner.'}</p>
 {!canReview&&loaded&&!error&&<p className="notice">No booking requests are available for your workspace. Your confirmed appointments appear below.</p>} {!loaded&&<p role="status">Loading booking requests…</p>}{notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="alert">{error}</p>}
 {loaded&&canReview&&!error&&!items.length?<p className="sf-empty-notifications">No booking requests awaiting review.</p>:null}
 {!embedded&&<DevicePushControls teamToken={token}/>}<div id="team-review-inbox"><BookingRequestCards approvalLabel={embedded?'Approve and add to calendar':undefined} items={items} busy={busy} onReview={review} onEdit={item=>{setEditing(item);setEditError('');}} team={team} customFields={customFields} approvalFields={approvalFields}/></div>
 {editing&&<BookingApprovalEditor item={editing} fields={customFields} onClose={()=>{if(!busy)setEditing(null);}} onSave={saveEdit} busy={!!busy} error={editError}/>}
 <p><small>Requests refresh automatically while this page is open. Pending requests do not reserve a calendar slot. Acceptance can fail if a time was booked meanwhile.</small></p></>;
 return embedded?<section className="sf-team-review-embedded">{content}</section>:<main className="sf-team-review-page"><header><a href="/"><img src="/brand/logo.svg?v=1.3.99" alt="SelahFlow" width="220" height="55"/></a><span>Private team booking reviews</span>{token&&<TeamPushBell token={token}/>}</header><section className="sf-team-review-body">{content}</section></main>;
}
