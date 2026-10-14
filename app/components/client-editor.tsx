'use client';
import {useEffect,useState} from 'react';
import {Check,UserRoundPlus,X} from 'lucide-react';
import RegistrationFields from './registration-fields';

export type ClientDetails={name:string;email:string;phone:string;notes:string;memberNumber:string;dateOfBirth:string;firstName:string;lastName:string;customAnswers:Record<string,string|boolean>};
type ExistingClient=Partial<ClientDetails>&{registrationAnswers?:Record<string,string|boolean>};
export default function ClientEditor({client,config,onClose,onSave,busy,error}:{
 client:ExistingClient|null;
 config:any;
 onClose:()=>void;
 onSave:(details:ClientDetails)=>Promise<void>;
 busy:boolean;
 error:string;
}){
 const [values,setValues]=useState<ClientDetails>({name:'',email:'',phone:'',notes:'',memberNumber:'',dateOfBirth:'',firstName:'',lastName:'',customAnswers:{}});
 useEffect(()=>{const parts=(client?.name||'').trim().split(/\s+/);setValues({name:client?.name||'',email:client?.email||'',phone:client?.phone||'',notes:client?.notes||'',memberNumber:client?.memberNumber||'',dateOfBirth:client?.dateOfBirth||'',firstName:client?.firstName||parts[0]||'',lastName:client?.lastName||parts.slice(1).join(' '),customAnswers:client?.customAnswers||client?.registrationAnswers||{}});},[client]);
 const set=(key:keyof ClientDetails)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setValues(v=>({...v,[key]:e.target.value}));
 const setField=(id:string,value:string)=>setValues(v=>({...v,[id]:value,name:id==='firstName'||id==='lastName'?((id==='firstName'?value:v.firstName).trim()+' '+(id==='lastName'?value:v.lastName).trim()).trim():v.name}));
 return <div className="sf-client-editor-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
  <section role="dialog" aria-modal="true" aria-labelledby="sf-client-editor-title" className="sf-client-editor">
   <header><div className="sf-client-editor-heading"><UserRoundPlus size={20} aria-hidden="true"/><div>
    <small>{client?'EDIT CLIENT':'CLIENT DIRECTORY'}</small><h2 id="sf-client-editor-title">{client?'Edit client profile':'Add new client'}</h2></div></div>
    <button className="outline sf-client-editor-close" type="button" onClick={onClose} disabled={busy} aria-label="Close client editor"><X size={18}/></button>
   </header>
   <p className="sf-client-editor-note">Use the same registration fields your customers see when booking. Session-specific questions are collected with their matching session.</p>
   <form id="sf-client-edit-form" onSubmit={async e=>{e.preventDefault();await onSave({...values,name:(values.firstName.trim()+' '+values.lastName.trim()).trim()});}}>
    <RegistrationFields config={config} form="booking" sessionId={null} values={{memberNumber:values.memberNumber,dateOfBirth:values.dateOfBirth,firstName:values.firstName,lastName:values.lastName,email:values.email,phone:values.phone}} answers={values.customAnswers} onValue={setField} onAnswer={(id,value)=>setValues(v=>({...v,customAnswers:{...v.customAnswers,[id]:value}}))}/>
    <label>Internal notes (optional)<textarea maxLength={1000} rows={3} value={values.notes} onChange={set('notes')} placeholder="Notes for the business owner only"/></label>
    <p className="sf-client-editor-notice">Clients with different names are kept separate, even when they share an email address or phone number.</p>
    {error&&<p className="sf-client-editor-error" role="alert">{error}</p>}
   </form>
   <footer><button type="button" className="outline" onClick={onClose} disabled={busy}>Cancel</button>
    <button type="submit" className="primary" form="sf-client-edit-form" disabled={busy||!values.firstName.trim()||!values.lastName.trim()}><Check size={17}/>{busy?'Saving…':client?'Save changes':'Add client'}</button></footer>
  </section>
 </div>;
}
