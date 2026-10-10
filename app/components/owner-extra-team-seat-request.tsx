'use client';
import {useCallback,useEffect,useState} from 'react';
import {AlertCircle,CheckCircle2,Clock3,Plus,RefreshCcw,Send,ShieldCheck,XCircle} from 'lucide-react';
type RequestRow={
 id:string;team_member_name:string;reason:string;
 status:'pending'|'approved'|'declined'|'withdrawn'|'revoked';
 review_note:string;created_at:string;reviewed_at:string|null;
};
type RequestResult={requests:RequestRow[];pending:boolean;extraSeats:number};
const when=(d:string)=>new Date(d).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
export default function OwnerExtraTeamSeatRequest({plan,teamLimit,onRefreshLimit}:{
 plan:string;teamLimit:number;onRefreshLimit:()=>Promise<void>;
}){
 const [data,setData]=useState<RequestResult|null>(null),[name,setName]=useState(''),[reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const r=await fetch('/api/studio/team-seat-request',{cache:'no-store'});
   const result=await r.json();
   if(!r.ok)throw Error(result.error||'Unable to load extra team member requests.');
   setData(result);
   await onRefreshLimit();
  }catch(e){setError((e as Error).message);}
  finally{setLoading(false);}
 },[onRefreshLimit]);
 useEffect(()=>{void refresh();},[refresh]);
 async function send(action:'submit'|'withdraw',id?:string){
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/studio/team-seat-request',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(action==='submit'?{action,teamMemberName:name,reason}:{action,id})
   });
   const result=await r.json();
   if(!r.ok)throw Error(result.error||'Unable to update request.');
   setMessage(result.message||'Request updated.');
   if(action==='submit'){setName('');setReason('');}
   await refresh();
  }catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 const pending=data?.requests.find(r=>r.status==='pending');
 return <section className="sf-extra-seat-owner" aria-label="One-time extra team member requests">
  <div className="sf-extra-seat-heading">
   <div><span className="sf-extra-seat-eyebrow"><ShieldCheck size={14}/> NO SUBSCRIPTION UPGRADE</span>
    <h3>Request an additional team member</h3>
    <p>Need one more team member occasionally? Request a one-time exception directly from the SelahFlow platform administrator. No payment or subscription change occurs. An approval adds <b>one extra team slot</b> for this business, until revoked.</p>
   </div>
   <button type="button" className="outline" onClick={()=>void refresh()} disabled={loading||busy} aria-label="Refresh team request status"><RefreshCcw size={15}/> Refresh status</button>
  </div>
  <div className="sf-extra-seat-summary">
   <span>Subscription <b>{plan.toUpperCase()}</b></span>
   <span>Current team allowance <b>{teamLimit}</b></span>
   <span>Admin-approved extra seats <b>{data?.extraSeats??0}</b></span>
  </div>
  {error&&<p role="alert" className="sf-extra-seat-error">{error}</p>}
  {message&&<p role="status" className="sf-extra-seat-notice">{message}</p>}
  {loading&&!data?<p className="muted">Loading team allowance requests…</p>:
   pending?<article className="sf-extra-seat-pending">
    <div><Clock3 size={18}/><strong>Awaiting platform administrator approval</strong></div>
    <p><b>Requested team member:</b> {pending.team_member_name}</p>
    <p><b>Reason:</b> {pending.reason}</p>
    <small>Submitted {when(pending.created_at)}</small>
    <button type="button" className="outline" disabled={busy} onClick={()=>void send('withdraw',pending.id)}>Withdraw request</button>
   </article>:<form className="sf-extra-seat-form" onSubmit={e=>{e.preventDefault();void send('submit');}}>
    <label>Additional team member's name
     <input required minLength={2} maxLength={100} value={name}
      onChange={e=>setName(e.target.value)} placeholder="Name of the team member you wish to add"/>
    </label>
    <label>Why is this exception needed?
     <textarea required minLength={5} maxLength={1000} rows={3} value={reason}
      onChange={e=>setReason(e.target.value)} placeholder="Example: Temporary holiday support without changing our monthly subscription"/>
    </label>
    <button type="submit" className="primary" disabled={busy||name.trim().length<2||reason.trim().length<5}>
     <Send size={16}/>{busy?'Submitting request…':'Send request to platform administrator'}
    </button>
    <small>Submitting does not add the member automatically. Once approved, refresh this section and select <b>Add team member</b> above, then save business settings.</small>
   </form>}
  {!!data?.requests.length&&<div className="sf-extra-seat-history">
   <h4>Request history</h4>
   {data.requests.slice(0,8).map(r=><article key={r.id} className="sf-extra-seat-history-row">
    <div><strong>{r.team_member_name}</strong><small>{when(r.created_at)}</small></div>
    <span className={'sf-extra-seat-status '+r.status}>
     {r.status==='approved'?<CheckCircle2 size={14}/>:r.status==='pending'?<Clock3 size={14}/>:<XCircle size={14}/>}
     {r.status==='approved'?'Approved — extra slot granted':r.status==='pending'?'Awaiting approval':r.status==='declined'?'Declined':r.status==='revoked'?'Grant revoked':'Withdrawn'}
    </span>
    {r.review_note&&<p><b>Administrator note:</b> {r.review_note}</p>}
   </article>)}
  </div>}
 </section>;
}
