'use client';
import {useEffect,useState} from 'react';
import {Check,History,Pencil,X} from 'lucide-react';
import type {BookingRequest} from './booking-request-cards';
export type BookingField={id:string;label:string;type?:string;required?:boolean;options?:string[]};
export type EditedBooking={customerName:string;customerEmail:string;customerPhone:string;customAnswers:Record<string,string|boolean>};
export default function BookingApprovalEditor({item,fields,onClose,onSave,busy,error}:{
 item:BookingRequest;fields:BookingField[];onClose:()=>void;
 onSave:(details:EditedBooking)=>Promise<void>;busy:boolean;error:string;
}){
 const [data,setData]=useState<EditedBooking>({customerName:'',customerEmail:'',customerPhone:'',customAnswers:{}});
 useEffect(()=>setData({customerName:item.details.customerName||'',customerEmail:item.details.customerEmail||'',
  customerPhone:item.details.customerPhone||'',customAnswers:{...(item.details.customAnswers||{})}}),[item.id]);
 const set=(key:'customerName'|'customerEmail'|'customerPhone')=>(e:React.ChangeEvent<HTMLInputElement>)=>setData(v=>({...v,[key]:e.target.value}));
 const answer=(id:string,value:string|boolean)=>setData(v=>({...v,customAnswers:{...v.customAnswers,[id]:value}}));
 const original=item.details.originalSubmission;
 return <div className="sf-booking-editor-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
  <section className="sf-booking-editor" role="dialog" aria-modal="true" aria-labelledby={'edit-booking-'+item.id}>
   <header><div><span className="sf-booking-editor-eyebrow"><Pencil size={14}/> BOOKING APPROVAL</span>
    <h2 id={'edit-booking-'+item.id}>Edit customer details</h2><p>Corrections will appear in the approval card and client history. Original answers are retained for review.</p></div>
    <button type="button" className="outline" onClick={onClose} disabled={busy} aria-label="Close booking editor"><X size={17}/></button></header>
   <div className="sf-booking-editor-lock">Service, team, activity date, time and group-session capacity are locked. Ask the customer to rebook if the schedule must change.</div>
   <form id={'booking-edit-form-'+item.id} onSubmit={async e=>{e.preventDefault();await onSave(data);}}>
    <label>Customer full name<input required minLength={2} maxLength={100} value={data.customerName} onChange={set('customerName')}/></label>
    <div className="sf-booking-editor-row"><label>Email address<input required type="email" maxLength={254} value={data.customerEmail} onChange={set('customerEmail')}/></label>
     <label>Phone<input type="tel" maxLength={40} value={data.customerPhone} onChange={set('customerPhone')}/></label></div>
    {fields.length>0&&<><h3>Custom booking answers</h3>{fields.map(field=><label key={field.id}>{field.label}{field.required?' *':''}
     {field.type==='checkbox'?<span className="sf-booking-editor-checkbox"><input type="checkbox" checked={data.customAnswers[field.id]===true} onChange={e=>answer(field.id,e.target.checked)}/> Yes</span>:
      field.type==='select'?<select required={field.required} value={String(data.customAnswers[field.id]||'')} onChange={e=>answer(field.id,e.target.value)}>
       <option value="">Select one</option>{(field.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:
      <input type={field.type==='number'?'number':field.type==='date'?'date':'text'} required={field.required} maxLength={field.type==='text'?500:undefined}
       value={String(data.customAnswers[field.id]||'')} onChange={e=>answer(field.id,e.target.value)}/>}</label>)}</>}
    {original&&<details className="sf-booking-editor-original"><summary><History size={15}/> View original customer submission</summary>
     <div><p><b>Name:</b> <span translate="no">{original.customerName}</span></p><p><b>Email:</b> <span translate="no">{original.customerEmail}</span></p><p><b>Phone:</b> <span translate="no">{original.customerPhone||'Not provided'}</span></p>
     {fields.map(f=>original.customAnswers?.[f.id]!==undefined?<p key={f.id}><b>{f.label}:</b> {String(original.customAnswers[f.id])}</p>:null)}</div>
    </details>}
    {error&&<p className="sf-membership-error" role="alert">{error}</p>}
   </form>
   <footer><button type="button" className="outline" onClick={onClose} disabled={busy}>Cancel</button>
    <button type="submit" form={'booking-edit-form-'+item.id} className="primary" disabled={busy}><Check size={17}/>{busy?'Saving changes…':'Save details for approval'}</button></footer>
  </section>
 </div>;
}
