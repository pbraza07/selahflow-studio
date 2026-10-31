'use client';
import {useState,useRef,useEffect} from 'react';
import {FileText,ShieldCheck,Check,ArrowUpRight,X} from 'lucide-react';
import {serviceAgreement,SERVICE_AGREEMENT_VERSION} from '../../server/business-service-terms.mjs';
import styles from './business-service-agreement.module.css';
export type AgreementAcceptance={version:string;planCode:string;signatureName:string;documentReviewed:boolean;accepted:boolean;revenueAccepted:boolean;electronicConsent:boolean};
export const blankAcceptance=(planCode:string):AgreementAcceptance=>({version:SERVICE_AGREEMENT_VERSION,planCode,signatureName:'',documentReviewed:false,accepted:false,revenueAccepted:false,electronicConsent:false});
export const acceptanceComplete=(a:AgreementAcceptance)=>a.documentReviewed&&a.accepted&&a.revenueAccepted&&a.electronicConsent&&a.signatureName.trim().length>=2;
export function AgreementDocument({planCode}:{planCode:string}){
 const a=serviceAgreement(planCode);return <article className={styles.document}><div className={styles.documentMeta}><span>SELAHFLOW LLC</span><span>Business partnership agreement</span></div><h1>{a.title}</h1><p className={styles.documentIntro}>Clear terms for your package, payments and responsibilities. Please review every section before signing.</p>{a.sections.map((section,i)=><section key={section.title}><span className={styles.sectionNumber}>{String(i+1).padStart(2,'0')}</span><div><h2>{section.title}</h2><p>{section.text}</p></div></section>)}<footer>Agreement version {a.version} · <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy <ArrowUpRight size={13}/></a></footer></article>;
}
export default function BusinessServiceAgreement({planCode,value,onChange}:{planCode:string;value:AgreementAcceptance;onChange:(a:AgreementAcceptance)=>void}){
 const [open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open)dialog.current?.showModal();else if(dialog.current?.open)dialog.current.close();},[open]);
 const reviewed=value.documentReviewed===true;
 return <section className={styles.agreement} aria-label="SelahFlow services and revenue agreement">
  <div className={styles.heading}><span className={styles.icon}><FileText size={23}/></span><div><span className={styles.eyebrow}>YOUR BUSINESS AGREEMENT</span><h2>Start with a clear understanding.</h2><p>Read the contract, confirm the terms and add your electronic signature.</p></div></div>
  <button ref={trigger} type="button" className={styles.reviewButton} onClick={()=>setOpen(true)} aria-haspopup="dialog"><FileText size={19}/><span><b>{reviewed?'Review your contract again':'Read the contract & fee disclaimer'}</b><small>Package benefits, fees, renewals, responsibilities and electronic consent</small></span>{reviewed?<Check size={20}/>:<ArrowUpRight size={20}/>}</button>
  <p className={styles.readStatus} role="status"><ShieldCheck size={15}/>{reviewed?'Contract review acknowledged. You can now sign below.':'Open the contract to review the full terms before signing.'}</p>
  <fieldset className={styles.signing} disabled={!reviewed}><legend>Your electronic signature</legend><label>Full legal name · authorized representative<input required maxLength={120} value={value.signatureName} onChange={e=>onChange({...value,signatureName:e.target.value})} autoComplete="name" placeholder="Enter your full name"/></label><p className={styles.signaturePreview}>{value.signatureName.trim()||'Your signature will appear here'}</p>
  {([['accepted','I have read and accept the SelahFlow business services agreement.'],['revenueAccepted','I understand the selected package price, eligible first-customer commissions and separate processor/provider fees.'],['electronicConsent','I am authorized to sign for this business and consent to this electronic signature and saved agreement.']] as const).map(([key,label])=><label key={key} className={styles.consent}><input type="checkbox" required checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/><span>{label}</span></label>)}</fieldset>
  <small className={styles.recordNote}>The exact contract, package, signature, consent and acceptance date/time are saved with your business account.</small>
  <dialog ref={dialog} aria-label="Read SelahFlow business services agreement" className={styles.dialog} onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus();}}>
   <header className={styles.readerHeader}><span><FileText size={17}/> Review your agreement</span><button type="button" aria-label="Close agreement" onClick={()=>setOpen(false)}><X size={20}/></button></header>
   <div className={styles.readerBody}><AgreementDocument planCode={planCode}/></div>
   <footer className={styles.readerActions}><button type="button" onClick={()=>window.open('/terms/business-services?plan='+encodeURIComponent(planCode),'_blank','noopener,noreferrer')}>Open printable copy</button><button type="button" className={styles.acknowledge} onClick={()=>{onChange({...value,documentReviewed:true});setOpen(false);}}>I have reviewed the contract <Check size={17}/></button></footer>
  </dialog>
 </section>;
}

export function PrintAgreementButton(){return <button type="button" className="outline" onClick={()=>window.print()}>Print / save agreement</button>;}
