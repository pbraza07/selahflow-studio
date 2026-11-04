'use client';
import {useState} from 'react';
export default function OwnerReviewInvite({enabled,reviewer,team}:{enabled:boolean;reviewer:string;team:{id:string;name:string}[]}){
 const [url,setUrl]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const member=team.find(t=>t.id===reviewer);
 async function invoke(action:string){setBusy(true);setMessage('');setUrl('');try{const r=await fetch('/api/studio/approvals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,staffId:reviewer})}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to update access.');if(d.url)setUrl(d.url);setMessage(action==='createStaffLink'?'New private review link created (expires in 30 days). Share it only with the selected team member.':'Previous review link revoked.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 if(!enabled||!member)return <p className="muted">Enable booking approvals, choose a team member reviewer, and save Settings to create a staff access link.</p>;
 return <div className="sf-staff-invite"><p>Designated reviewer: <strong translate="no">{member.name}</strong>. Generate a private review link so they can receive in-app booking requests and accept or decline them without using the owner password.</p>
 <div className="sf-approval-buttons"><button className="outline" type="button" disabled={busy} onClick={()=>invoke('createStaffLink')}>Generate / replace staff review link</button><button className="outline" type="button" disabled={busy} onClick={()=>invoke('revokeStaffLink')}>Revoke staff link</button></div>
 {url&&<div className="sf-staff-link"><input aria-label="Private team review URL" readOnly value={url}/><button type="button" className="primary" onClick={()=>navigator.clipboard?.writeText(url).then(()=>setMessage('Link copied.')).catch(()=>setMessage('Select and copy the link above.'))}>Copy link</button></div>}
 {message&&<p role="status" className="notice">{message}</p>}<p className="muted"><small>This is an access credential. Share privately; anyone with an unexpired link can see that staff member's booking requests. Generating a replacement invalidates the previous link. Selected email/SMS notifications are sent separately when their provider credentials are configured; this reusable staff inbox link is optional.</small></p>
 </div>;
}
