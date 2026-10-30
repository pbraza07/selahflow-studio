'use client';
import {APP_VERSION} from '../../lib/app-version';
import {useEffect,useState} from 'react';
import BusinessServiceAgreement,{blankAcceptance,acceptanceComplete} from '../components/business-service-agreement';
import {PLAN_CATALOG} from '../../server/plan-entitlements.mjs';
import styles from '../platform-pages.module.css';
import {BUSINESS_INDUSTRIES,US_STATES} from '../../lib/business-options';

export default function Signup(){
 const [planCode,setPlanCode]=useState('free'),[agreement,setAgreement]=useState(blankAcceptance('free')),[agreed,setAgreed]=useState(false);
 useEffect(()=>{const plan=new URLSearchParams(window.location.search).get('plan');if(plan&&Object.hasOwn(PLAN_CATALOG,plan)){setPlanCode(plan);setAgreement(blankAcceptance(plan));}},[]);
 const industriesAlphabetized=[...BUSINESS_INDUSTRIES].sort((a,b)=>a[1].localeCompare(b[1],'en',{sensitivity:'base'}));
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[address,setAddress]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[slug,setSlug]=useState(''),[industry,setIndustry]=useState('other'),[city,setCity]=useState(''),[region,setRegion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const response=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planCode,agreement,businessName:name,description,address,email,password,slug,industry,city,region,website:''})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Registration failed.');
   if(planCode==='free'){window.location.assign('/registration-status');return;}
   const payment=await fetch('/api/studio/platform-billing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'checkout',planCode})});
   const checkout=await payment.json();
   if(!payment.ok){window.location.assign('/settings/package?onboarding=1&payment=retry');return;}
   if(!/^https:\/\/checkout\.stripe\.com\//.test(checkout.checkoutUrl||''))throw Error('Stripe did not return a safe payment page.');
   window.location.assign(checkout.checkoutUrl);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const paid=planCode!=='free';
 return <main className={styles.shell}>
  <header className={styles.top}><a className={styles.brand} href="/" style={{width:220,maxWidth:'100%',flexShrink:0}}><img className="selah-logo" src="/brand/logo.svg?v=1.3.99" alt="SelahFlow" width="380" height="68"/></a><nav className={styles.nav}><a href="/discover">Find services</a><a href="/pricing">Pricing</a><a href="/login">Owner login</a></nav></header>
  <section className={styles.hero}><h1>Sign up for SelahFlow.</h1><p>First read and sign the services agreement. Paid packages then continue to secure Stripe payment. Your business remains private until every required step is complete and the primary administrator approves it.</p></section>
  <div className={styles.card} style={{maxWidth:620}}>{!agreed?<>
   <label>Selected package<select value={planCode} onChange={e=>{setPlanCode(e.target.value);setAgreement(blankAcceptance(e.target.value));}}>{Object.entries(PLAN_CATALOG).map(([code,p])=><option value={code} key={code}>{p.name} · ${(p.monthlyCents/100).toFixed(2)}/month</option>)}</select></label>
   <BusinessServiceAgreement planCode={planCode} value={agreement} onChange={setAgreement}/>
   <button type="button" className={styles.button} disabled={!acceptanceComplete(agreement)} onClick={()=>setAgreed(true)}>Sign agreement and continue</button>
  </>:<>
   <h2>Create business account</h2><p>Selected package: {PLAN_CATALOG[planCode as keyof typeof PLAN_CATALOG].name}. <button className="outline" type="button" onClick={()=>setAgreed(false)}>Review agreement</button></p>
   {error&&<p role="alert" className={styles.alert}>{error}</p>}
   <form onSubmit={submit}>
    <label>Business name<input required maxLength={100} value={name} onChange={e=>{const v=e.target.value;setName(v);if(!slug)setSlug(v.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''));}}/></label>
    <label>Description of services (required)<textarea required maxLength={600} rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the services and specialties customers can book."/></label><small>Customers find your business by searching these services. You can update this description in Business details.</small>
    <label>Business street address<input maxLength={350} autoComplete="street-address" value={address} onChange={e=>setAddress(e.target.value)}/></label>
    <label>Industry<select value={industry} onChange={e=>setIndustry(e.target.value)}>{industriesAlphabetized.map(([v,n])=><option value={v} key={v}>{n}</option>)}</select></label>
    <label>City<input value={city} maxLength={80} autoComplete="address-level2" onChange={e=>setCity(e.target.value)}/></label>
    <label>State<select value={region} onChange={e=>setRegion(e.target.value)}><option value="">Select U.S. state (optional)</option>{US_STATES.map(([code,label])=><option key={code} value={label}>{label}</option>)}</select></label>
    <label>Booking URL name<input required minLength={3} maxLength={60} value={slug} pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" onChange={e=>setSlug(e.target.value.toLowerCase())}/></label><small>Customers will use /book/{slug||'your-business'}</small>
    <label>Owner email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Password (at least 6 characters)<input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <p><small>{paid?'This creates your private pending account and immediately opens Stripe Checkout. The public page and dashboard stay locked until Stripe verifies payment and the primary administrator approves the business.':'Free requires no payment. The public page and dashboard stay locked until the primary administrator approves the signed application.'}</small></p>
    <button disabled={busy} className={styles.button}>{busy?(paid?'Opening secure payment…':'Creating account…'):(paid?'Sign up now and pay with Stripe':'Submit signed Free application')}</button>
   </form>
  </>}</div>
  <footer className={styles.footer}>SelahFlow v{APP_VERSION} · Agreement → payment when required → approval → active business</footer>
 </main>;
}
