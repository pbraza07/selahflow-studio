'use client';
import type {ReactNode} from 'react';
import {registrationQuestions} from '../../server/registration-questions.mjs';
type Props={config:any;form:'booking'|'membership';values:Record<string,string|boolean>;answers:Record<string,string|boolean>;onValue:(id:string,value:string)=>void;onAnswer:(id:string,value:string|boolean)=>void;identityHelp?:ReactNode;hideId?:boolean;sessionId?:string|null;customOnly?:boolean;serviceIds?:string[]};
export default function RegistrationFields({config,form,values,answers,onValue,onAnswer,identityHelp,hideId=false,sessionId,customOnly=false,serviceIds}:Props){
 return <div className="sf-registration-fields">{registrationQuestions(config,form,sessionId,serviceIds).filter((f:any)=>!customOnly||!f.standard).filter((f:any)=>!hideId||f.id!=='memberNumber').map((f:any)=>{
 const value=f.standard?values[f.id]:answers[f.id];
 const change=(v:string|boolean)=>f.standard?onValue(f.id,String(v)):onAnswer(f.id,v);
 return <div key={f.id} className={f.id==='memberNumber'?'sf-member-number-booking sf-registration-field':'sf-registration-field'}>
 <label><span className="sf-registration-label">{f.label}<span className="sf-field-optional">{f.required?' (required)':' (optional)'}</span></span>
 {f.type==='checkbox'?<input type="checkbox" required={f.required} checked={value===true} onChange={e=>change(e.target.checked)}/>:
 f.type==='select'?<select required={f.required} value={String(value||'')} onChange={e=>change(e.target.value)}><option value="">Choose an option</option>{(f.options||[]).map((o:string)=><option key={o} value={o}>{o}</option>)}</select>:
 <input name={f.id} type={f.type==='number'?'number':f.type} required={f.required} value={String(value||'')} placeholder={f.placeholder||''} maxLength={f.id==='memberNumber'?6:f.id==='firstName'||f.id==='lastName'?50:f.id==='email'?200:f.id==='phone'?40:500} max={f.id==='dateOfBirth'?new Date().toISOString().slice(0,10):undefined} pattern={f.id==='memberNumber'?'[A-Za-z]{2}[0-9]{4}':undefined} autoCapitalize={f.id==='memberNumber'?'characters':undefined} autoComplete={f.id==='firstName'?'given-name':f.id==='lastName'?'family-name':f.id==='email'?'email':f.id==='phone'?'tel':f.id==='dateOfBirth'?'bday':'off'} inputMode={f.id==='email'?'email':f.id==='phone'?'tel':undefined} onChange={e=>change(e.target.value)}/>}
 </label>{f.help&&<small>{f.help}</small>}{f.id==='phone'&&<small>For booking payment links and confirmations by text, include your country code (for example +14155552671).</small>}{f.id==='memberNumber'&&identityHelp}
 </div>;
 })}</div>;
}
