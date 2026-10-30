'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,ChevronDown,ChevronUp} from 'lucide-react';
import {PLANS} from '../../lib/plans';
import styles from '../site.module.css';

type PlanCode='free'|'professional'|'business';
export default function PlanBenefitCards({placement='home'}:{placement?:'home'|'pricing'}){
 const [expanded,setExpanded]=useState<PlanCode|null>(null);
 return <section id="plans" aria-label="SelahFlow subscription plan benefits" className={styles.plansSection}>
  <div className={styles.plansHeading}>
   <span className={styles.plansEyebrow}>SIMPLE PLANS · BUILT FOR EVERY BUSINESS</span>
   <h2>A little business. A growing team. Room for both.</h2>
   <p>Pick the room you need today. Every plan helps organize bookings, clients and attendance. Open a card to see all included benefits and limits.</p>
  </div>
  <div className={styles.planGrid}>
   {(Object.entries(PLANS) as [PlanCode,(typeof PLANS)[PlanCode]][]).map(([code,plan])=>{
    const opened=expanded===code;
    const isPaid=code!=='free';
    return <article key={code} id={placement==='pricing'?code:undefined} className={styles.planCard} data-plan={code}>
     <div className={styles.planCardTop}>
      <span className={styles.planTier}>{code==='professional'?'POPULAR FOR GROWING TEAMS':code==='business'?'MORE ROOM TO SCALE':'GET STARTED'}</span>
      <h3>{plan.name}</h3>
      <p className={styles.planSubtitle}>{plan.summary}</p>
      <p className={styles.planPrice}>${(plan.monthlyCents/100).toFixed(2)}<span>/month</span></p>
      <p className={styles.planPriceNote}>{isPaid?'Monthly subscription · Stripe checkout after approval':'No monthly package fee'}</p>
     </div>
     <div className={styles.planHighlights}>
      <p><b>{plan.bookableStaff}</b> bookable team member{plan.bookableStaff===1?'':'s'}</p>
      <p><b>{plan.limits.services}</b> services</p>
      <p><b>{plan.limits.membershipPlans}</b> active membership offers</p>
     </div>
     <button type="button" className={styles.planDetailsToggle} aria-expanded={opened}
      aria-controls={'selah-'+placement+'-'+code+'-benefits'}
      onClick={()=>setExpanded(opened?null:code)}>
      {opened?'Hide '+plan.name+' benefits':'See all '+plan.name+' benefits'}
      {opened?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
     </button>
     {opened&&<div id={'selah-'+placement+'-'+code+'-benefits'} className={styles.planExpanded}>
      <h4>What&apos;s included</h4>
      <ul>{plan.included.map(item=><li key={item}><CheckCircle2 size={17} aria-hidden="true"/><span>{item}</span></li>)}</ul>
      <p>Your business keeps its records and history as your plan changes.</p>
     </div>}
     <Link className={styles.planCta} href={'/signup?plan='+code}>
      {'Sign up for '+plan.name} <ArrowRight size={16}/>
     </Link>
    </article>;
   })}
  </div>
  <p className={styles.plansDisclosure}>All registrations require the business services and revenue agreement. Paid packages renew monthly through Stripe after administrator approval. Eligible first-customer commissions may apply, including on Free, when enabled by the administrator. Online payments require the business’s Stripe connection. Email and SMS depend on separate setup and may carry provider costs. AI receptionist and premium add-ons are not included.</p>
 </section>;
}
