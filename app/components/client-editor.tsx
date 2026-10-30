'use client';
import {useEffect,useState} from 'react';
import {Check,UserRoundPlus,X} from 'lucide-react';
import {editableClientProfileFields,clientProfileAnswers} from '../../server/client-profile-fields.mjs';
import {birthdateMemberId} from '../../server/member-id-policy.mjs';
import RegistrationFields from './registration-fields';

export type ClientDetails={name:string;email:string;phone:string;notes:string;memberNumber:string;dateOfBirth:string;firstName:string;lastName:string;customAnswers:Record<string,string|boolean>;importColumns?:Record<string,string|boolean>;editToken?:string;previousMemberNumbers?:string[]};
type ExistingClient=Partial<ClientDetails>&{idUsesSequence?:boolean;registrationAnswers?:Record<string,string|boolean>;registrationFieldLabels?:Record<string,string>;membershipAnswers?:any[];history?:any[]};
export default function ClientEditor({client,config,onClose,onSave,busy,error}:{
 client:ExistingClient|null;
 config:any;
 onClose:()=>void;
 onSave:(details:ClientDetails)=>Promise<void>;
 busy:boolean;
 error:string;
}){
 const [values,setValues]=useState<ClientDetails>({name:'',email:'',phone:'',notes:'',memberNumber:'',dateOfBirth:'',firstName:'',lastName:'',customAnswers:{}});
 useEffect(()=>{const parts=(client?.name||'').trim().split(/\s+/);setValues({name:client?.name||'',email:client?.email||'',phone:client?.phone||'',notes:client?.notes||'',memberNumber:client?.memberNumber||'',dateOfBirth:client?.dateOfBirth||'',firstName:client?.firstName||parts[0]||'',lastName:client?.lastName||parts.slice(1).join(' '),customAnswers:client?clientProfileAnswers(client):{},importColumns:client?.importColumns||{},editToken:client?.editToken});},[client]);
 const set=(key:keyof ClientDetails)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setValues(v=>({...v,[key]:e.target.value}));
 const setField=(id:string,value:string)=>setValues(v=>{
  const next={...v,[id]:value};next.name=(next.firstName.trim()+' '+next.lastName.trim()).trim();
  if(!client?.idUsesSequence&&['firstName','lastName','dateOfBirth'].includes(id)&&next.firstName&&next.lastName&&next.dateOfBirth)try{next.memberNumber=birthdateMemberId(next.name,next.dateOfBirth,next.firstName,next.lastName);}catch{}
  if(!next.dateOfBirth)next.memberNumber=client?.memberNumber||'';
  return next;
 });
 const profileFields=client?editableClientProfileFields(config,client):[];
 const editorConfig=client?{...config,bookingCustomFields:profileFields,bookingStandardFields:Object.fromEntries(['firstName','lastName','dateOfBirth','email','phone','memberNumber'].map(id=>[id,{...config?.bookingStandardFields?.[id],required:['firstName','lastName'].includes(id)}]))}:config;
 return <div className="sf-client-editor-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
  <section role="dialog" aria-modal="true" aria-labelledby="sf-client-editor-title" className="sf-client-editor">
   <header><div className="sf-client-editor-heading"><UserRoundPlus size={20} aria-hidden="true"/><div>
    <small>{client?'EDIT CLIENT':'CLIENT DIRECTORY'}</small><h2 id="sf-client-editor-title">{client?'Edit client profile':'Add new client'}</h2></div></div>
    <button className="outline sf-client-editor-close" type="button" onClick={onClose} disabled={busy} aria-label="Close client editor"><X size={18}/></button>
   </header>
   <p className="sf-client-editor-note">Edit current contact, identity and profile answers here. Service, session, membership, previously saved and imported fields are available. Original submissions, signed documents and payment records remain in history.</p>
   <form id="sf-client-edit-form" onSubmit={async e=>{e.preventDefault();await onSave({...values,name:(values.firstName.trim()+' '+values.lastName.trim()).trim()});}}>
    <RegistrationFields config={editorConfig} form="booking" sessionId={null} values={{memberNumber:values.memberNumber,dateOfBirth:values.dateOfBirth,firstName:values.firstName,lastName:values.lastName,email:values.email,phone:values.phone}} answers={values.customAnswers} onValue={setField} onAnswer={(id,value)=>setValues(v=>({...v,customAnswers:{...v.customAnswers,[id]:value}}))}/>
    <p className="sf-client-editor-notice">With a birth date, Unique IDs use first/last initials + MMDDYY. Without one, the server assigns initials + this business’s next number starting at 1001 when you save. Existing sequence IDs stay unchanged when a name or birth date is edited. Correcting a birth-date-based identity can update its suggested ID; collisions are checked before saving. Identity or ID changes require a fresh waiver signature, while earlier signed documents stay retained.</p>
    {client&&Object.keys(values.importColumns||{}).length>0&&<fieldset><legend>Imported profile fields</legend>{Object.entries(values.importColumns||{}).map(([id,value])=><label key={id}>{id}{typeof value==='boolean'?<input type="checkbox" checked={value} onChange={e=>setValues(v=>({...v,importColumns:{...v.importColumns,[id]:e.target.checked}}))}/>:<input maxLength={500} value={String(value??'')} onChange={e=>setValues(v=>({...v,importColumns:{...v.importColumns,[id]:e.target.value}}))}/>}</label>)}</fieldset>}
    <label>Internal notes (optional)<textarea maxLength={1000} rows={3} value={values.notes} onChange={set('notes')} placeholder="Notes for the business owner only"/></label>
    <p className="sf-client-editor-notice">Clients with different names are kept separate, even when they share an email address or phone number.</p>
    {error&&<p className="sf-client-editor-error" role="alert">{error}</p>}
   </form>
   <footer><button type="button" className="outline" onClick={onClose} disabled={busy}>Cancel</button>
    <button type="submit" className="primary" form="sf-client-edit-form" disabled={busy||!values.firstName.trim()||!values.lastName.trim()}><Check size={17}/>{busy?'Saving…':client?'Save changes':'Add client'}</button></footer>
  </section>
 </div>;
}
