'use client';
import {useEffect,useState} from 'react';
import {Check,Clock3,RefreshCcw,ShieldCheck,Users,UserPlus,XCircle} from 'lucide-react';
type SeatRequest={
 id:string;businessId:string;businessName:string;slug:string;businessStatus:string;
 ownerEmail:string;teamMemberName:string;reason:string;
 status:'pending'|'approved'|'declined'|'withdrawn'|'revoked';
 reviewNote:string;createdAt:string;reviewedAt:string|null;
 planCode:string;currentTeam:number;extraSeats:number;teamLimit:number;
};
type Result={requests:SeatRequest[];pendingCount:number};
const when=(s:string)=>new Date(s).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
export default function PlatformTeamSeatRequests({onChanged}:{onChanged:()=>Promise<void>}){
 const [data,setData]=useState<Result|null>(null),[loading,setLoading]=useState(true);
 const [working,setWorking]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [showHistory,setShowHistory]=useState(false);
 async function load(){
  setLoading(true);
  try{
   const r=await fetch('/api/platform/team-seat-requests',{cache:'no-store'});
   const result=await r.json();
   if(!r.ok)throw Error(result.error||'Unable to load team member requests.');
   setData(result);
  }catch(e){setError((e as Error).message);}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function review(r:SeatRequest,action:'approve'|'decline'|'revoke'){
  const question=action==='approve'?'Approve one additional team member slot for '+r.businessName+' with no subscription change?':
   action==='revoke'?'Revoke this previously approved seat? Existing team members and reservations will remain unchanged.':
   'Decline the team member request for '+r.businessName+'?';
  if(!window.confirm(question))return;
  setWorking(r.id);setError('');setMessage('');
  try{
   const response=await fetch('/api/platform/team-seat-requests',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id,action,note:notes[r.id]||''})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Unable to review request.');
   setMessage(result.message||'Request reviewed.');await load();await onChanged();
  }catch(e){setError((e as Error).message);}
  finally{setWorking('');}
 }
 const pending=data?.requests.filter(r=>r.status==='pending')||[];
 const history=data?.requests.filter(r=>r.status!=='pending')||[];
 return <section className="sf-platform-team-seats" id="team-seat-requests" aria-label="Ad hoc team member request approvals">
  <header className="sf-platform-seats-heading">
   <div><span className="sf-platform-seats-eyebrow"><ShieldCheck size={15}/> ONE-TIME MANUAL EXCEPTIONS</span>
    <h2>Extra team member requests <span className="sf-platform-pending-count">{pending.length} pending</span></h2>
    <p>Business owners can request one extra team slot without upgrading. Approving adds one seat only for that business; no subscription charge, plan change, or automatic staff creation occurs.</p>
   </div>
   <button type="button" className="outline" disabled={loading||!!working} onClick={()=>void load()}><RefreshCcw size={15}/> Refresh requests</button>
  </header>
  {error&&<p className="sf-extra-seat-error" role="alert">{error}</p>}
  {message&&<p className="sf-extra-seat-notice" role="status">{message}</p>}
  {loading&&!data?<p>Loading extra team member requests…</p>:!pending.length?<p className="sf-platform-no-team-requests">No extra team member requests are awaiting approval.</p>:
   <div className="sf-platform-seat-list">{pending.map(r=><article key={r.id} className="sf-platform-seat-request">
    <div className="sf-platform-seat-request-heading"><div><strong>{r.businessName}</strong><small>/{r.slug} · {r.ownerEmail}</small></div>
     <span className="sf-platform-seat-waiting"><Clock3 size={14}/> Awaiting review</span></div>
    <div className="sf-platform-seat-request-details">
     <div><small>Proposed member</small><b><UserPlus size={15}/> {r.teamMemberName}</b></div>
     <div><small>Current allowance</small><b><Users size={15}/> {r.currentTeam}/{r.teamLimit} members · {r.planCode} plan</b></div>
     <div><small>Already approved exceptions</small><b>{r.extraSeats} extra seat{r.extraSeats===1?'':'s'}</b></div>
     <div><small>Submitted</small><b>{when(r.createdAt)}</b></div>
    </div>
    <p><b>Owner's explanation:</b> {r.reason}</p>
    <label>Optional review note<textarea rows={2} maxLength={1000} value={notes[r.id]||''} onChange={e=>setNotes(n=>({...n,[r.id]:e.target.value}))} placeholder="Reason for approval or decline"/></label>
    <div className="sf-platform-seat-actions">
     <button type="button" className="primary" disabled={!!working} onClick={()=>void review(r,'approve')}><Check size={16}/> Approve +1 seat</button>
     <button type="button" className="outline" disabled={!!working} onClick={()=>void review(r,'decline')}><XCircle size={16}/> Decline request</button>
    </div>
   </article>)}</div>}
  {history.length>0&&<div className="sf-platform-seat-history">
   <button type="button" className="outline" onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Hide':'Show'} reviewed requests ({history.length})</button>
   {showHistory&&<div className="sf-platform-seat-list">{history.map(r=><article key={r.id} className="sf-platform-seat-request">
    <div className="sf-platform-seat-request-heading"><div><strong>{r.businessName} — {r.teamMemberName}</strong><small>{r.ownerEmail} · {when(r.createdAt)}</small></div>
     <span className={'sf-extra-seat-status '+r.status}>{r.status==='approved'?'Approved +1 seat':r.status}</span></div>
    <p>{r.reason}</p>
    {r.reviewNote&&<p><b>Review note:</b> {r.reviewNote}</p>}
    {r.status==='approved'&&<><label>Revocation note (optional)<textarea rows={2} maxLength={1000} value={notes[r.id]||''} onChange={e=>setNotes(n=>({...n,[r.id]:e.target.value}))}/></label>
     <button type="button" className="outline" disabled={!!working} onClick={()=>void review(r,'revoke')}>Revoke extra seat</button></>}
   </article>)}</div>}
  </div>}
 </section>;
}
