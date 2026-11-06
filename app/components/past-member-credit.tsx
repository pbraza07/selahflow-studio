'use client';
import {useEffect,useRef,useState} from 'react';
import MembershipModal from './membership-modal';
type Visit={id:string;date:string;start:number;status:string;services:string[]};
export default function PastMemberCredit({member,onClose,onSaved}:{member:{id:string;customer_name:string;member_number:string|null};onClose:()=>void;onSaved:()=>void}){
 const [visits,setVisits]=useState<Visit[]>([]),[selected,setSelected]=useState(''),[reason,setReason]=useState(''),[attendance,setAttendance]=useState('Checked in'),[confirmed,setConfirmed]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false);
 async function post(action:string,body:Record<string,unknown>={}){const response=await fetch('/api/studio/memberships',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:member.id,...body})});const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to update this visit.');return data;}
 useEffect(()=>{let active=true;post('pastMemberVisits').then(data=>{if(active)setVisits(data.visits||[]);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[member.id]);
 async function save(e:React.FormEvent){e.preventDefault();if(saving.current||!selected||!confirmed||reason.trim().length<5)return;saving.current=true;setBusy(true);setError('');try{await post('applyPastMemberCredit',{appointmentId:selected,reason:reason.trim(),attendance});window.dispatchEvent(new Event('selahflow:memberships-updated'));onSaved();}catch(e){setError((e as Error).message);}finally{saving.current=false;setBusy(false);}}
 const visit=visits.find(v=>v.id===selected);
 return <MembershipModal title="Apply membership to a past visit" busy={busy} onClose={()=>{if(!saving.current)onClose();}}><form onSubmit={save}>
  <p><strong translate="no">{member.customer_name}</strong> · <span translate="no">{member.member_number}</span></p>
  <p>This owner override uses 1 session from the current available balance, even when the visit was before membership activation or outside its weekly schedule. It does not change the membership start date or issue a refund.</p>
  {loading?<p role="status">Loading past visits…</p>:<label>Past visit<select value={selected} disabled={busy} required onChange={e=>{setSelected(e.target.value);setConfirmed(false);}}><option value="">Choose a visit</option>{visits.map(v=><option key={v.id} value={v.id}>{v.date} · {String(Math.floor(v.start/60)).padStart(2,'0')}:{String(v.start%60).padStart(2,'0')} · {v.services.join(', ')} · {v.status}</option>)}</select></label>}
  {!loading&&!visits.length&&!error&&<p>No unrecorded past visits found. Add the client to the past session from the owner calendar first.</p>}
  {visit&&['Confirmed','Scheduled'].includes(visit.status)&&<label>Attendance<select value={attendance} disabled={busy} onChange={e=>setAttendance(e.target.value)}><option>Checked in</option><option>No-show</option></select></label>}
  <label>Override reason<textarea required minLength={5} maxLength={500} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
  <label className="sf-toggle-row"><input type="checkbox" required checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> Use 1 current session for this past visit. Existing attendance is retained; an unrecorded visit uses the attendance selected above.</label>
  {error&&<p role="alert" className="sf-membership-error">{error}</p>}
  <div className="button-row"><button type="button" className="outline" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={busy||loading||!selected||!confirmed||reason.trim().length<5}>{busy?'Applying…':'Apply 1 session'}</button></div>
 </form></MembershipModal>;
}
