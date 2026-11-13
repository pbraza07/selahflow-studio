'use client';
import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';
export type OwnerBookingClient={memberNumber:string;name:string;email:string;phone:string;dateOfBirth:string;membership?:any};
export const emptyOwnerBookingClient:OwnerBookingClient={memberNumber:'',name:'',email:'',phone:'',dateOfBirth:''};
type Props={slug:string;client:OwnerBookingClient;setClient:Dispatch<SetStateAction<OwnerBookingClient>>;setAnswers:Dispatch<SetStateAction<Record<string,string|boolean>>>;setLookup:Dispatch<SetStateAction<string>>};
export default function OwnerBookingClientFields({slug,client,setClient,setAnswers,setLookup}:Props){
 const [message,setMessage]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const id=client.memberNumber.trim().toUpperCase();let active=true;const controller=new AbortController();
  if(!id){setLookup('');setMessage('Enter an existing ID to load saved details, or leave it blank for manual entry.');return;}
  if(!/^[A-Z]{2}([0-9]{4}|[0-9]{6})$/.test(id)){setLookup('invalid');setMessage('Enter a valid Membership / Client ID.');return;}
  setLookup('loading');setMessage('Loading saved client details…');
  const timer=setTimeout(async()=>{
   try{
    const response=await fetch('/api/public/member-lookup',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,body:JSON.stringify({slug,memberNumber:id})});
    const data=await response.json();if(!active)return;
    if(!response.ok)throw Error(data.error||'Client details could not be loaded. Try again.');
    if(data.memberNumber!==id)throw Error('Client ID changed. Check the ID and try again.');
    setClient(previous=>previous.memberNumber===id?{memberNumber:id,name:[data.firstName,data.lastName].filter(Boolean).join(' '),email:data.email||'',phone:data.phone||'',dateOfBirth:data.dateOfBirth||'',membership:data.membership||null}:previous);
    setAnswers(data.customAnswers||{});setLookup('loaded');setMessage('Saved client details and registration answers loaded. Review the form before confirming.');
   }catch(error){if(!active)return;setLookup('error');setMessage((error as Error).message||'Saved details are unavailable. Try again.');}
  },350);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[client.memberNumber,slug,revision,setClient,setAnswers,setLookup]);
 const change=(key:keyof OwnerBookingClient,value:string)=>setClient(previous=>({...previous,[key]:value}));
 return <>
  <label>Membership / Client ID (optional)<input name="memberNumber" value={client.memberNumber} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="owner-client-lookup-status" onChange={e=>{setClient({...emptyOwnerBookingClient,memberNumber:e.target.value.trim().toUpperCase()});setAnswers({});setLookup('');}}/></label>
  <p id="owner-client-lookup-status" role="status" aria-live="polite">{message}</p>
  {client.memberNumber&&<div className="button-row"><button type="button" className="outline" onClick={()=>setRevision(value=>value+1)}>Reload saved details</button><button type="button" className="outline" onClick={()=>{setClient({...emptyOwnerBookingClient});setAnswers({});setLookup('');}}>Clear ID</button></div>}
  <input type="hidden" name="dateOfBirth" value={client.dateOfBirth}/>
  <label>Full name<input name="name" autoComplete="name" required maxLength={100} placeholder="Client’s full name" readOnly={!!client.memberNumber} value={client.name} onChange={e=>change('name',e.target.value)}/></label>
  <div className="form-row"><label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" readOnly={!!client.memberNumber} value={client.email} onChange={e=>change('email',e.target.value)}/></label><label>Phone (optional)<input name="phone" type="tel" autoComplete="tel" placeholder="Phone number" value={client.phone} onChange={e=>change('phone',e.target.value)}/></label></div>
 </>;
}
