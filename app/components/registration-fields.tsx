'use client';
import type {ReactNode} from 'react';
import {useEffect,useState} from 'react';
import {registrationQuestions} from '../../server/registration-questions.mjs';
type Props={config:any;form:'booking'|'membership';values:Record<string,string|boolean>;answers:Record<string,string|boolean>;onValue:(id:string,value:string)=>void;onAnswer:(id:string,value:string|boolean)=>void;identityHelp?:ReactNode;hideId?:boolean;sessionId?:string|null;customOnly?:boolean};
export default function RegistrationFields({config,form,values,answers,onValue,onAnswer,identityHelp,hideId=false,sessionId,customOnly=false}:Props){
 const [fontColor,setFontColor]=useState('#ffffff');
 const [fieldColor,setFieldColor]=useState('#171717');
 const [editorOpen,setEditorOpen]=useState(false);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('selahflow:booking-fonts:'+String(config?.slug||'default'))||'{}');if(/^#[0-9a-f]{6}$/i.test(saved.fontColor||''))setFontColor(saved.fontColor);if(/^#[0-9a-f]{6}$/i.test(saved.fieldColor||''))setFieldColor(saved.fieldColor);}catch{}},[config?.slug]);
 const save=(text:string,field:string)=>{setFontColor(text);setFieldColor(field);try{localStorage.setItem('selahflow:booking-fonts:'+String(config?.slug||'default'),JSON.stringify({fontColor:text,fieldColor:field}));}catch{}};
 return <div className="sf-registration-fields">{registrationQuestions(config,form,sessionId).filter((f:any)=>!customOnly||!f.standard).filter((f:any)=>!hideId||f.id!=='memberNumber').map((f:any)=>{
 const value=f.standard?values[f.id]:answers[f.id];
 const change=(v:string|boolean)=>f.standard?onValue(f.id,String(v)):onAnswer(f.id,v);
 return <div key={f.id} style={f.id==='memberNumber'?{'--sf-booking-question-color':fontColor,'--sf-booking-input-color':fieldColor} as React.CSSProperties:undefined} className={f.id==='memberNumber'?'sf-member-number-booking sf-registration-field':'sf-registration-field'}>
 <label>{f.label}{!f.required&&<span className="sf-field-optional"> (optional)</span>}
 {f.type==='checkbox'?<input type="checkbox" required={f.required} checked={value===true} onChange={e=>change(e.target.checked)}/>:
 f.type==='select'?<select required={f.required} value={String(value||'')} onChange={e=>change(e.target.value)}><option value="">Choose an option</option>{(f.options||[]).map((o:string)=><option key={o} value={o}>{o}</option>)}</select>:
 <input name={f.id} type={f.type==='number'?'number':f.type} required={f.required} value={String(value||'')} placeholder={f.placeholder||''} maxLength={f.id==='memberNumber'?6:f.id==='firstName'||f.id==='lastName'?50:f.id==='email'?200:f.id==='phone'?40:500} max={f.id==='dateOfBirth'?new Date().toISOString().slice(0,10):undefined} pattern={f.id==='memberNumber'?'[A-Za-z]{2}[0-9]{4}':undefined} autoCapitalize={f.id==='memberNumber'?'characters':undefined} autoComplete={f.id==='firstName'?'given-name':f.id==='lastName'?'family-name':'off'} onChange={e=>change(e.target.value)}/>}
 </label>{f.help&&<small>{f.help}</small>}{f.id==='memberNumber'&&<><div className="sf-booking-font-editor"><button type="button" className="sf-booking-font-toggle" onClick={()=>setEditorOpen(!editorOpen)} aria-expanded={editorOpen}>⚙ Text color settings</button>{editorOpen&&<div className="sf-booking-font-options"><label>Question and instruction text <input aria-label="Question text color" type="color" value={fontColor} onChange={e=>save(e.target.value,fieldColor)}/></label><label>Input text <input aria-label="Input text color" type="color" value={fieldColor} onChange={e=>save(fontColor,e.target.value)}/></label><button type="button" onClick={()=>save('#ffffff','#171717')}>Restore readable defaults</button><small>Colors are saved for this business on this device.</small></div>}</div>{identityHelp}</>}
 </div>;
 })}</div>;
}
