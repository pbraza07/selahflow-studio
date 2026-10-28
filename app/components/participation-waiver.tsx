'use client';
import {accessibleText} from '../../server/themes.mjs';
import {waiverMinor,waiverToday} from '../../server/waiver-content.mjs';
export type WaiverSignature={mediaConsent?:boolean;signature:string;role:string;date:string;accepted:boolean;version:string;documentHash:string};
export function WaiverDocument({document,children}:{document:any;children?:React.ReactNode}){
 const colors=document.colors||{};
 return <article className="sf-waiver-document" style={{background:'#fff',color:'#171717',border:'1px solid '+(colors.border||'#bbb'),borderRadius:12,overflow:'hidden'}}>
  <header style={{background:colors.header||'#111',color:accessibleText(colors.header||'#111'),padding:'18px 22px',borderBottom:'6px solid '+(colors.hero||colors.button||'#555')}}><strong style={{fontSize:23,color:'inherit'}}>{document.businessName}</strong><div style={{fontSize:14,marginTop:4}}>{document.title}</div></header>
  <div className="sf-waiver-body" style={{padding:'18px 22px'}}>{document.sections.map(([title,body]:string[],index:number)=><section key={title} style={{margin:'0 0 12px'}}><strong style={{color:'#171717',fontSize:13}}>{index+1}. {title}</strong><p style={{color:'#171717',fontSize:13,lineHeight:1.45,margin:'3px 0 0'}}>{body}</p></section>)}{children}</div>
 </article>;
}
export default function ParticipationWaiver({document,dob,participantName,value,onChange,signed,checking,error,onRetry}:{document:any;dob:string;participantName:string;value:WaiverSignature;onChange:(next:WaiverSignature)=>void;signed:boolean;checking:boolean;error:string;onRetry:()=>void}){
 let minor=false;try{minor=waiverMinor(dob);}catch{}
 const patch=(changes:Partial<WaiverSignature>)=>onChange({...value,version:document.version,documentHash:document.hash,...changes});
 return <section className="sf-booking-waiver" aria-label="Participation waiver" style={{margin:'20px 0'}}>
  <h3>Participation waiver</h3>
  {checking?<p role="status">Checking for a signed waiver…</p>:error?<p role="alert">{error} <button type="button" className="outline" onClick={onRetry}>Retry waiver check</button></p>:signed?<p role="status">A signed waiver is already on file for your unique ID at {document.businessName}. You do not need to sign again.</p>:<>
  <p>Required for the current document for your unique ID at {document.businessName}. Please read before signing. A parent or guardian must sign for participants under 18.</p>
  <WaiverDocument document={document}/>
  <p><strong>Participant:</strong> {participantName||'Enter participant details above'}</p>
  <div className="form-grid"><label>Signing as<select required value={value.role} onChange={e=>patch({role:e.target.value,signature:'',accepted:false})}><option value="">Choose signer</option>{!minor&&<option value="self">Participant (18 or older)</option>}<option value="parent">Parent</option><option value="guardian">Legal guardian</option></select></label>
  <label>Date signed<input type="date" required value={value.date} min={waiverToday()} max={waiverToday()} onChange={e=>patch({date:e.target.value})}/></label></div>
  <label>Electronic signature - full name<input required autoComplete="off" maxLength={100} value={value.signature} onChange={e=>patch({signature:e.target.value})} placeholder={minor?'Parent or guardian full name':'Signer full name'}/></label>
  <label className="consent"><input type="checkbox" required checked={value.accepted} onChange={e=>patch({accepted:e.target.checked})}/><span>I have read and agree to this waiver. Typing my full name is my electronic signature. {value.role==='parent'||value.role==='guardian'?'I confirm I am the participant’s parent or legal guardian and am at least 18.':''}</span></label>
  {document.mediaRelease&&!document.mediaReleaseIncluded&&<div><p>{document.mediaRelease}</p><label className="consent"><input type="checkbox" checked={value.mediaConsent===true} onChange={e=>patch({mediaConsent:e.target.checked})}/><span>I give the optional media permission above.</span></label></div>}
  </>}
 </section>;
}
