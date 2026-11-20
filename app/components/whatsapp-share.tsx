'use client';
import {useState} from 'react';

type Payment = {kind:string;id:string;email:string};
export default function WhatsAppShare({phone, name, confirmation, payment}:{phone:string;name:string;confirmation?:string;payment?:Payment}){
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [recipient,setRecipient]=useState(phone||'');
 const digits=recipient.trim().replace(/[\s().-]/g,'');
 const number=digits.startsWith('+')?digits.slice(1):/^\d{10}$/.test(digits)?'1'+digits:/^1\d{10}$/.test(digits)?digits:'';
 async function prepare(){
  setError('');
  if(confirmation){setDraft(confirmation);return;}
  setBusy(true);
  try{
   const response=await fetch('/api/studio/card-payment-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payment,key:crypto.randomUUID(),channel:'whatsapp'})});
   const result=await response.json();
   if(!response.ok||!result.message)throw Error(result.error||'Payment details are unavailable.');
   setDraft(result.message);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div><button className="outline small" type="button" disabled={busy} onClick={()=>void prepare()}>{busy?'Checking payment…':confirmation?'Share booking confirmation via WhatsApp':'Share payment details via WhatsApp'}</button>
 {error&&<p role="alert">{error}</p>}
 {draft&&<section aria-label="Review WhatsApp message"><label>WhatsApp number for {name} (include country code)<input type="tel" value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>
 <p style={{whiteSpace:'pre-line',overflowWrap:'anywhere'}}>{draft}</p>
 {/^[1-9]\d{7,14}$/.test(number)?<a className="primary" target="_blank" rel="noopener noreferrer" href={'https://wa.me/'+number+'?text='+encodeURIComponent(draft)}>Open WhatsApp to review and send</a>:<p>Enter the full number, including + and the country code.</p>}
 <button className="outline" type="button" onClick={()=>setDraft('')}>Close</button></section>}</div>;
}
