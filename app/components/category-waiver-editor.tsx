'use client';
import {useState} from 'react';
import {WAIVER_CATEGORIES,categoryWaiverContent,suggestedWaiverCategory,waiverContentPayload} from '../../server/waiver-category-templates.mjs';
import {waiverDocument} from '../../server/waiver-content.mjs';
import {WaiverDocument} from './participation-waiver';
export default function CategoryWaiverEditor({config,setConfig}:{config:any;setConfig:(next:any)=>void}){
 const [reference,setReference]=useState(''),[date,setDate]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const options=config.categoryWaiver||{enabled:false,category:suggestedWaiverCategory(config.industry),serviceTerms:{},additionalTerms:''};
 const draft={...config,categoryWaiver:{...options,enabled:true}};
 const preview=waiverDocument(draft);
 const update=(patch:any)=>setConfig((c:any)=>({...c,categoryWaiver:{...options,...patch,review:null}}));
 async function recordReview(){
  setError('');if(!reference.trim()||!date){setError('Enter the completed legal-review reference and date.');return;}
  setBusy(true);
  try{
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(waiverContentPayload(categoryWaiverContent(draft))));
   const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
   setConfig((c:any)=>({...c,categoryWaiver:{...options,enabled:true,review:{hash,reference:reference.trim(),reviewedAt:date}}}));
  }catch{setError('Unable to record review. Please retry.');}finally{setBusy(false);}
 }
 return <fieldset disabled={busy}><legend>Industry-specific waiver</legend>
  <p>Choose a category and review the complete document with your legal adviser. It lists every waiver-required service in this business. Clients sign again when its wording or service scope changes. Category templates are drafting aids; these controls record a completed review.</p>
  <label>Waiver category<select value={options.category} onChange={e=>update({category:e.target.value})}>{Object.entries(WAIVER_CATEGORIES).map(([id,item])=><option key={id} value={id}>{item.label}</option>)}</select></label>
  <label>Business-specific terms<textarea rows={4} maxLength={4000} value={options.additionalTerms||''} onChange={e=>update({additionalTerms:e.target.value})}/></label>
  {(config.services||[]).filter((s:any)=>s.requiresWaiver).map((service:any)=><label key={service.id}>Additional terms for {service.name}<textarea rows={3} maxLength={4000} value={options.serviceTerms?.[service.id]||''} onChange={e=>update({serviceTerms:{...options.serviceTerms,[service.id]:e.target.value}})}/></label>)}
  <details><summary>Preview complete category waiver</summary><WaiverDocument document={preview}/><p>{preview.mediaRelease}</p><p>Media permission is optional and starts unchecked.</p></details>
  <label>Completed review reference<input maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label>
  <label>Completed review date<input type="date" max={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)}/></label>
  <button type="button" onClick={()=>void recordReview()}>Record review and select category waiver</button>
  {error&&<p role="alert">{error}</p>}
  <p role="status">{options.enabled?(options.review?'Category waiver selected. Save settings to activate. Changes to business name, service scope or terms require a new review.':'Category waiver changed. Record its completed review before saving.'):'Existing waiver remains selected until you record review and save settings.'}</p>
  {options.review&&<p>Recorded review: {options.review.reference} · {options.review.reviewedAt}</p>}
 </fieldset>;
}
