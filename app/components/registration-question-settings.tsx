'use client';
import {useState} from 'react';
import {registrationQuestions,questionNotificationEnabled} from '../../server/registration-questions.mjs';

type FormType='booking'|'membership';
const REVIEW_FIELDS=[['services','Service / activity'],['team','Team member'],['customerEmail','Customer email'],['customerPhone','Customer phone'],['quotedPrice','Quoted price'],['receivedAt','Request received date and time']];
const APPOINTMENT_FIELDS=[['services','Services'],['date','Date'],['time','Time'],['duration','Duration'],['quotedPrice','Quoted price']];
type Props={config:any;setConfig:(updater:any)=>void;limit:number};
export default function RegistrationQuestionSettings({config,setConfig,limit}:Props){
 const [form,setForm]=useState<FormType>('booking');
 const [target,setTarget]=useState('all');
 const serviceId=form==='booking'&&target.startsWith('service:')?target.slice(8):undefined;
 const sessionId=form==='booking'&&target.startsWith('session:')?target.slice(8):undefined;
 const editorForm:FormType=sessionId||serviceId?'booking':form;
 const service=serviceId?(config.services||[]).find((s:any)=>s.id===serviceId):null;
 const relatedSession=sessionId?(config.bookableSessions||[]).find((s:any)=>s.id===sessionId):null;
 const serviceIds=serviceId?[serviceId]:relatedSession?.service?[relatedSession.service]:undefined;
 const questions=registrationQuestions(config,editorForm,sessionId||(serviceId?null:undefined),serviceIds);
 const fields=config.bookingCustomFields||[];
 const update=(id:string,patch:any)=>setConfig((c:any)=>({...c,bookingCustomFields:(c.bookingCustomFields||[]).map((f:any)=>f.id===id?{...f,...patch}:f)}));
 const standard=(id:string,patch:any)=>setConfig((c:any)=>({...c,[editorForm+'StandardFields']:{...c[editorForm+'StandardFields'],[id]:{...c[editorForm+'StandardFields']?.[id],...patch}}}));
 const move=(id:string,offset:number)=>setConfig((c:any)=>{const order=registrationQuestions(c,editorForm).map((f:any)=>f.id);const i=order.indexOf(id),j=i+offset;if(i<0||j<0||j>=order.length)return c;[order[i],order[j]]=[order[j],order[i]];return {...c,[editorForm+'QuestionOrder']:order};});
 const remove=(id:string)=>setConfig((c:any)=>({
  ...c,bookingCustomFields:(c.bookingCustomFields||[]).filter((f:any)=>f.id!==id),
  services:(c.services||[]).map((s:any)=>({...s,...(s.questionRequired?{questionRequired:Object.fromEntries(Object.entries(s.questionRequired).filter(([key])=>key!==id))}:{})})),
  bookableSessions:(c.bookableSessions||[]).map((s:any)=>({...s,...(s.questionRequired?{questionRequired:Object.fromEntries(Object.entries(s.questionRequired).filter(([key])=>key!==id))}:{})})),
  bookingQuestionOrder:(c.bookingQuestionOrder||[]).filter((key:string)=>key!==id),
  membershipQuestionOrder:(c.membershipQuestionOrder||[]).filter((key:string)=>key!==id),
  bookingPushFields:(c.bookingPushFields||[]).filter((key:string)=>key!==id),
  bookingQuestionNotifications:Object.fromEntries(Object.entries(c.bookingQuestionNotifications||{}).filter(([key])=>key!==id)),
  membershipQuestionNotifications:Object.fromEntries(Object.entries(c.membershipQuestionNotifications||{}).filter(([key])=>key!==id)),
  ...(Array.isArray(c.bookingApprovalVisibleFields)?{bookingApprovalVisibleFields:c.bookingApprovalVisibleFields.filter((key:string)=>key!==id)}:{})
 }));
 const scope=(id:string,forms:string[])=>setConfig((c:any)=>({...c,
  bookingCustomFields:(c.bookingCustomFields||[]).map((f:any)=>f.id===id?{...f,forms,...(!forms.includes('booking')?{serviceIds:[],sessionIds:[]}:{})}:f),
  ...Object.fromEntries(['booking','membership'].filter(x=>!forms.includes(x)).flatMap(x=>[
   [x+'QuestionOrder',(c[x+'QuestionOrder']||[]).filter((key:string)=>key!==id)],
   [x+'QuestionNotifications',Object.fromEntries(Object.entries(c[x+'QuestionNotifications']||{}).filter(([key])=>key!==id))]
  ])),
  ...(!forms.includes('booking')?{
   services:(c.services||[]).map((s:any)=>({...s,questionRequired:Object.fromEntries(Object.entries(s.questionRequired||{}).filter(([key])=>key!==id))})),
   bookableSessions:(c.bookableSessions||[]).map((s:any)=>({...s,questionRequired:Object.fromEntries(Object.entries(s.questionRequired||{}).filter(([key])=>key!==id))}))
  }:{})
 }));
 const required=(f:any,value:boolean)=>{
  if(serviceId)setConfig((c:any)=>({...c,services:(c.services||[]).map((s:any)=>s.id===serviceId?{...s,questionRequired:{...s.questionRequired,[f.id]:value}}:s)}));
  else if(sessionId)setConfig((c:any)=>({...c,bookableSessions:(c.bookableSessions||[]).map((s:any)=>s.id===sessionId?{...s,questionRequired:{...s.questionRequired,[f.id]:value}}:s)}));
  else if(f.standard)standard(f.id,{required:value});
  else update(f.id,{required:value});
 };
 const removeFromService=(f:any)=>{
  if(!serviceId||!f.serviceIds?.includes(serviceId))return;
  const remaining=f.serviceIds.filter((id:string)=>id!==serviceId);
  if(remaining.length){update(f.id,{serviceIds:remaining});return;}
  if(f.forms?.includes('membership')){
   setConfig((c:any)=>({...c,bookingCustomFields:(c.bookingCustomFields||[]).map((q:any)=>q.id===f.id?{...q,forms:['membership'],serviceIds:[],sessionIds:[]}:q),
    services:(c.services||[]).map((s:any)=>({...s,...(s.questionRequired?{questionRequired:Object.fromEntries(Object.entries(s.questionRequired).filter(([id])=>id!==f.id))}:{})}))}));
  }else remove(f.id);
 };
 const add=()=>setConfig((c:any)=>({...c,bookingCustomFields:[...(c.bookingCustomFields||[]),{
  id:'field_'+crypto.randomUUID().replace(/-/g,'').slice(0,12),label:'New question',type:'text',
  required:false,showInNotification:false,options:[],forms:[editorForm],
  ...(sessionId?{sessionIds:[sessionId]}:{}),...(serviceId?{serviceIds:[serviceId]}:{})
 }]}));
 const visibleReviewFields=config.bookingApprovalVisibleFields??[...REVIEW_FIELDS.map(([id])=>id),...fields.map((f:any)=>f.id)];
 const setReviewField=(id:string,enabled:boolean)=>setConfig((c:any)=>{const current=c.bookingApprovalVisibleFields??[...REVIEW_FIELDS.map(([key])=>key),...(c.bookingCustomFields||[]).map((f:any)=>f.id)];return {...c,bookingApprovalVisibleFields:enabled?[...new Set([...current,id])]:current.filter((key:string)=>key!==id)};});
 return <div className="sf-question-center" aria-label="Question manager">
 <h2>Questions</h2>
 <p className="muted">This is the only place to create, edit, order and target standard or custom registration questions. Required and Show in notifications are independent. Save business settings to publish all changes.</p>
 <p><strong>{fields.length}/{limit} custom questions used</strong> · Standard questions and edits do not consume extra allowance.</p>
 <div className="form-row"><label>Registration form<select value={form} onChange={e=>{setForm(e.target.value as FormType);setTarget('all');}}><option value="booking">Booking registration</option><option value="membership">Membership registration</option></select></label>
 {form==='booking'&&<label>Question scope<select value={target} onChange={e=>setTarget(e.target.value)}><option value="all">All booking questions</option><optgroup label="Services">{(config.services||[]).map((s:any)=><option key={s.id} value={'service:'+s.id}>{s.name}</option>)}</optgroup><optgroup label="Sessions">{(config.bookableSessions||[]).map((s:any)=><option key={s.id} value={'session:'+s.id}>{s.name||config.services?.find((v:any)=>v.id===s.service)?.name||'Session'} · {s.date}</option>)}</optgroup></select></label>}</div>
 {(serviceId||sessionId)&&<p className="muted">Viewing questions for {service?.name||relatedSession?.name||'this session'}. Labels and notification choices belong to the registration form. Required overrides below apply to this {serviceId?'service':'session'}; an explicit unchecked override makes this question optional for the selected scope.</p>}
 <button type="button" className="outline" disabled={fields.length>=limit} onClick={add}>+ Add {serviceId?'service':sessionId?'session':form} question</button>
 {questions.map((f:any,i:number)=><section className="sf-settings-custom-field" key={f.id}>
  <div className="button-row"><strong>{i+1}. {f.standard?'Standard field':f.serviceIds?.length?'Service question':f.sessionIds?.length?'Session question':'Shared question'}</strong>
   <button type="button" className="outline" disabled={i===0} onClick={()=>move(f.id,-1)} aria-label={'Move '+f.label+' up'}>Move up</button>
   <button type="button" className="outline" disabled={i===questions.length-1} onClick={()=>move(f.id,1)} aria-label={'Move '+f.label+' down'}>Move down</button>
  </div>
  <label>Question label<input maxLength={80} value={f.label} onChange={e=>f.standard?standard(f.id,{label:e.target.value}):update(f.id,{label:e.target.value})}/></label>
  {f.standard?<><label>Help text<input maxLength={300} value={f.help||''} onChange={e=>standard(f.id,{help:e.target.value})}/></label>
   <label>Placeholder<input maxLength={100} value={f.placeholder||''} onChange={e=>standard(f.id,{placeholder:e.target.value})}/></label></>:
   <>
   {!sessionId&&!serviceId&&<label>Show on<select value={!f.forms||f.forms.length===2?'both':f.forms[0]} onChange={e=>scope(f.id,e.target.value==='both'?['booking','membership']:[e.target.value])}><option value="booking">Booking only</option><option value="membership">Membership only</option><option value="both">Booking and membership</option></select></label>}
   {!sessionId&&!serviceId&&(!f.forms||f.forms.includes('booking'))&&<fieldset><legend>Apply to booking services</legend>
    <label><input type="checkbox" checked={!f.serviceIds?.length} onChange={e=>update(f.id,{serviceIds:e.target.checked?[]:(config.services||[]).map((s:any)=>s.id)})}/> All services</label>
    <p className="muted">Or select the new and existing services that require this question. Multiple selected services share one answer field.</p>
    {(config.services||[]).map((s:any)=><label key={s.id}><input type="checkbox" checked={(f.serviceIds||[]).includes(s.id)} onChange={e=>update(f.id,{serviceIds:e.target.checked?[...(f.serviceIds||[]),s.id]:(f.serviceIds||[]).filter((id:string)=>id!==s.id)})}/>{s.name}</label>)}
   </fieldset>}
   {!sessionId&&!serviceId&&(!f.forms||f.forms.includes('booking'))&&<fieldset><legend>Apply to booking sessions</legend>
    <label><input type="checkbox" checked={!f.sessionIds?.length} onChange={e=>update(f.id,{sessionIds:e.target.checked?[]:(config.bookableSessions||[]).map((s:any)=>s.id)})}/> All sessions and regular appointments</label>
    <p className="muted">When both a service and session are selected, both must match. A session ID also applies to recurring occurrences.</p>
    {(config.bookableSessions||[]).map((s:any)=><label key={s.id}><input type="checkbox" checked={(f.sessionIds||[]).includes(s.id)} onChange={e=>update(f.id,{sessionIds:e.target.checked?[...(f.sessionIds||[]),s.id]:(f.sessionIds||[]).filter((id:string)=>id!==s.id)})}/>{s.name||config.services?.find((x:any)=>x.id===s.service)?.name||'Session'} · {s.date}</label>)}
   </fieldset>}
   <label>Question type<select value={f.type} onChange={e=>update(f.id,{type:e.target.value,options:e.target.value==='select'?(f.options?.length?f.options:['Option 1']):[]})}>{['text','number','date','select','checkbox'].map(t=><option key={t} value={t}>{t}</option>)}</select></label>
   {f.type==='select'&&<label>Choices (one per line)<textarea value={(f.options||[]).join('\n')} onChange={e=>update(f.id,{options:e.target.value.split('\n')})}/></label>}
   </>}
  <label><input type="checkbox" checked={f.required} aria-label={'Required: '+f.label} onChange={e=>required(f,e.target.checked)}/> {serviceId?'Required for this service':sessionId?'Required for this session':'Required'}</label>
  <label><input type="checkbox" aria-label={'Show in notifications: '+f.label} checked={questionNotificationEnabled(config,editorForm,f)} onChange={e=>setConfig((c:any)=>({...c,[editorForm+'QuestionNotifications']:{...c[editorForm+'QuestionNotifications'],[f.id]:e.target.checked}}))}/> Show in push notifications and business alert emails</label>
  {f.standard&&['firstName','lastName','dateOfBirth'].includes(f.id)&&<small>A complete name and birth date are needed to issue a Unique ID and sign an identity-linked waiver. Optional incomplete bookings do not receive a new ID.</small>}
  {!f.standard&&<>
   {serviceId?(f.serviceIds?.includes(serviceId)?<button type="button" className="outline" onClick={()=>removeFromService(f)}>Remove question from this service</button>:<small>Shared question. Edit its visibility in Settings → Questions.</small>):<button type="button" className="outline" onClick={()=>remove(f.id)}>Remove question</button>}
  </>}
 </section>)}
 <details className="sf-question-delivery-details"><summary>Appointment details in push notifications</summary><p className="muted">These are appointment facts, not registration questions. Question answers use the Show in notifications checkbox above.</p>{APPOINTMENT_FIELDS.map(([id,label])=><label key={id}><input type="checkbox" checked={(config.bookingPushFields||['customerName','services','date']).includes(id)} onChange={e=>setConfig((c:any)=>{const current=c.bookingPushFields||['customerName','services','date'];return {...c,bookingPushFields:e.target.checked?[...new Set([...current,id])]:current.filter((key:string)=>key!==id)};})}/> {label}</label>)}</details>
 <details className="sf-question-delivery-details"><summary>Details displayed on approval review cards</summary><p className="muted">These controls affect the private review card, independently of push and email alerts. Activity date, time, duration and seat counts always appear.</p>{[...REVIEW_FIELDS,...fields.map((f:any)=>[f.id,f.label])].map(([id,label])=><label key={id}><input type="checkbox" checked={visibleReviewFields.includes(id)} onChange={e=>setReviewField(id,e.target.checked)}/> {label}</label>)}</details>
 <button type="submit" className="primary">Save questions</button>
 <p className="muted">New client ID creation still needs first name, last name and birth date; a valid email is needed for approval and payment emails. Required toggles control form questions. Save business settings to publish. Historical booking answers keep their original question labels and IDs.</p>
 </div>;
}
