'use client';
import {useState} from 'react';
import MembershipModal from './membership-modal';
export default function MemberIdSettings({policy,onSaved}:{policy:string;onSaved:()=>void}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(policy),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{
  const response=await fetch('/api/studio/memberships',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'saveIdPolicy',policy:value})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to save ID settings.');
  onSaved();setOpen(false);
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <><button className="outline" type="button" onClick={()=>{setValue(policy);setError('');setOpen(true);}}>Membership ID settings</button>{open&&<MembershipModal title="Membership ID settings" busy={busy} onClose={()=>setOpen(false)}>
 <p>Choose how new clients receive their permanent six-character ID. Applies to client creation, booking registration, and membership registration.</p>
 <label>ID format<select value={value} onChange={e=>setValue(e.target.value)}>
 <option value="initials_birthdate">First initial + last initial + birth month/day</option>
 <option value="initials_sequence">First initial + last initial + sequential number</option>
 <option value="random">Random two letters + four digits</option>
 </select></label>
 <p>{value==='initials_birthdate'?'Example: Caleb Alves, August 14 → CA0814. If already assigned, the next available numbered ID is used, such as CA0001.':value==='initials_sequence'?'Example: CA0001, CA0002. Each client receives the next available number for their initials.':'Example: QZ4826. The system checks availability before issuing the ID.'}</p>
 <p>Duplicate prevention is always enabled. IDs are unique within your business; another business may use the same ID. Existing clients keep their IDs when you change this setting. Reserved IDs are not reassigned to another client after deletion.</p>
 {error&&<p role="alert" className="sf-membership-error">{error}</p>}
 <button type="button" className="primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save ID settings'}</button>
 </MembershipModal>}</>;
}
