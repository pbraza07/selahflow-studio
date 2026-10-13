'use client';
import RegistrationFields from '../../components/registration-fields';
import {useEffect,useState,useRef} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,CheckCircle2,CreditCard,ShieldCheck} from 'lucide-react';
import type {CSSProperties} from 'react';
import {themeStyles} from '../../../server/themes.mjs';
import GoogleBusinessGallery from '../../components/google-business-gallery';
type Plan={id:string;name:string;description:string;interval:'week'|'month'|'year';priceCents:number};
type Summary={slug:string;name:string;plans:Plan[];canPay:boolean;theme:any;brandPrimary:string;brandBackground:string;registrationConfig:any};
const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export default function MembershipEnrollment(){
 const [data,setData]=useState<Summary|null>(null),[slug,setSlug]=useState(''),[planId,setPlanId]=useState(''),[step,setStep]=useState(1);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[accept,setAccept]=useState(false);
 const [details,setDetails]=useState<Record<string,string>>({firstName:'',lastName:'',dateOfBirth:'',phone:''}),[answers,setAnswers]=useState<Record<string,string|boolean>>({});
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [result,setResult]=useState<{status:string;plan?:string;paidThrough?:string}|null>(null);
 const [requested,setRequested]=useState(false);
 const requestId=useRef('');
 const [checkoutId,setCheckoutId]=useState('');
 useEffect(()=>{
  const path=window.location.pathname.split('/').filter(Boolean);
  const current=path.length===2&&path[0]==='membership'?path[1]:'';
  setSlug(current);
  fetch('/api/public/memberships?slug='+encodeURIComponent(current),{cache:'no-store'}).then(async r=>{
   const obj=await r.json();if(!r.ok)throw Error(obj.error||'Memberships unavailable.');return obj;
  }).then(setData).catch(e=>setError((e as Error).message));
  const query=new URLSearchParams(window.location.search);
  if(query.get('checkout')==='cancelled')setError('Payment was cancelled. No membership has been activated.');
  if(query.get('checkout')==='success'&&query.get('session_id'))setCheckoutId(query.get('session_id')||'');
 },[]);
 useEffect(()=>{
  if(!checkoutId||!slug)return;
  let cancelled=false,attempts=0;
  const poll=async()=>{
   try{
    const response=await fetch('/api/public/memberships/status?slug='+encodeURIComponent(slug)+'&session_id='+encodeURIComponent(checkoutId),{cache:'no-store'});
    const d=await response.json();
    if(!cancelled)setResult(d);
    if(!cancelled&&d.status==='active'){clearInterval(interval);}
   }catch{}
   if(++attempts>=15)clearInterval(interval);
  };
  const interval=setInterval(poll,3000);void poll();
  return ()=>{cancelled=true;clearInterval(interval);};
 },[checkoutId,slug]);
 const plan=data?.plans.find(p=>p.id===planId);
 async function pay(e:React.FormEvent){
  e.preventDefault();
  if(!plan||!data)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/public/memberships',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'requestMembership',requestId:requestId.current||(requestId.current=crypto.randomUUID()),slug,planId:plan.id,name,email,...details,customAnswers:answers,termsAccepted:accept})});
   const d=await response.json();
   if(!response.ok)throw Error(d.error||'Secure checkout is unavailable.');
   setRequested(true);setBusy(false);
  }catch(e){setError((e as Error).message);setBusy(false);}
 }
 const theme=data?themeStyles(data.theme,data.brandPrimary,data.brandBackground) as CSSProperties:undefined;
 return <div className="sf-membership-public" data-selah-theme="true" style={theme}>
  <header className="sf-membership-public-header"><a href={'/'+slug}><img src="/brand/logo.svg" alt="SelahFlow" width={170} height={48}/></a><a href={'/book/'+slug}><CalendarDays size={16}/> Book an appointment</a></header>
  <main className="sf-membership-public-main">
   <section className="sf-membership-public-intro">
    <span className="sf-membership-kicker">MEMBERSHIPS & RECURRING SERVICES</span>
    <h1>{data?.registrationConfig?.pageContent?.membershipTitle||(data?'Memberships at '+data.name:'Choose a membership')}</h1>
    <p>{data?.registrationConfig?.pageContent?.membershipIntro||'Choose a membership and submit your registration for the team to review.'}</p>
    {slug&&<GoogleBusinessGallery slug={slug} compact/>}
   </section>
   <section className="sf-membership-join-panel">
    {requested?<div role="status"><CheckCircle2 size={36}/><h2>Membership request submitted</h2><p>The {data?.name} team will process your request. Your membership will appear after approval. Payment and session credits are confirmed separately.</p><a className="primary" href={'/book/'+slug}>Return to booking</a></div>:checkoutId?<div className="sf-membership-finish">
     <ShieldCheck size={36}/><h2>{result?.status==='active'?'Your membership is active!':'Checking your payment'}</h2>
     {result?.status==='active'?<><p>Payment has been verified for <b>{result.plan}</b>.</p>{result.paidThrough&&<p>Current paid period ends {new Date(result.paidThrough).toLocaleDateString('en-US')}.</p>}</>:
      <p>{result?.status==='payment_failed'?'Your payment did not complete.': 'Stripe is processing your payment. A membership is not active until the payment is verified.'}</p>}
     <a className="primary" href={'/book/'+slug}>Return to appointment booking</a>
    </div>:<>
    <div className="sf-membership-steps">{['Choose plan','Your details','Submit request'].map((label,i)=><span key={label} className={step===i+1?'active':''}>{i+1}. {label}</span>)}</div>
    {error&&<p className="sf-membership-error" role="alert">{error}</p>}
    {!data?<p>Loading available plans…</p>:step===1?<><h2>Choose your membership</h2>
     {data.plans.length?<div className="sf-membership-plans">{data.plans.map(p=><button key={p.id} type="button" className={planId===p.id?'selected':''} onClick={()=>setPlanId(p.id)}>
      <span><b>{p.name}</b><small>{p.description||'Recurring business membership'}</small></span>
      <strong>{price(p.priceCents)} <small>/ {p.interval}</small></strong>
     </button>)}</div>:<p className="sf-membership-empty">No memberships are available yet. Contact the business for more information.</p>}
     {data.plans.length>0&&<p className="sf-membership-warning">{data.registrationConfig?.pageContent?.membershipRequestNote||('Choose your membership, fill out your information, and a '+data.name+' team member will process your request.')}</p>}
     <button type="button" className="primary sf-membership-next" disabled={!planId} onClick={()=>setStep(2)}>Continue <ArrowRight size={17}/></button>
    </>:<form onSubmit={pay}><button type="button" className="sf-membership-back" onClick={()=>setStep(1)}><ArrowLeft size={16}/> Choose another plan</button>
     <h2>{data.registrationConfig?.pageContent?.membershipDetailsTitle||"Review your membership"}</h2>{plan&&<div className="sf-membership-order"><b>{plan.name}</b><p>{plan.description}</p>
      <div><strong>{price(plan.priceCents)} per package</strong><span>{plan.interval} membership</span></div></div>}
     <RegistrationFields config={data.registrationConfig||{}} form="membership" values={{...details,email}} answers={answers} onValue={(id,value)=>{if(id==='email')setEmail(value);else setDetails(old=>{const next={...old,[id]:value};setName((next.firstName+' '+next.lastName).trim());return next;});}} onAnswer={(id,value)=>setAnswers(old=>({...old,[id]:value}))}/>
     <label className="sf-membership-agree"><input type="checkbox" required checked={accept} onChange={e=>setAccept(e.target.checked)}/>
      <span>I confirm my registration details and request this membership. The business will contact me to process my request and payment. No online payment is taken by this form. Membership does not reserve appointment times.</span></label>
     <button type="submit" className="primary sf-membership-next" disabled={busy||!accept||!name.trim()||!email.trim()}>
      <CreditCard size={17}/>{busy?'Submitting request…':data.registrationConfig?.pageContent?.membershipSubmit||'Submit membership request'}</button>
     <small>Your request is reviewed by the business before membership approval.</small>
    </form>}
    </>}
   </section>
  </main>
 </div>;
}
