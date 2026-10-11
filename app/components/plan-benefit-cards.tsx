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
   <h2>Choose the space your business needs.</h2>
   <p>Start free and grow when you need more people, services or bookable sessions. Every business keeps its own settings, clients and booking history.</p>
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
      <p className={styles.planPriceNote}>{isPaid?'Proposed monthly pricing · paid checkout not yet available':'Free registration available now'}</p>
     </div>
     <div className={styles.planHighlights}>
      <p><b>{plan.bookableStaff}</b> bookable team member{plan.bookableStaff===1?'':'s'}</p>
      <p><b>{plan.limits.services}</b> services</p>
      <p><b>{plan.limits.bookingFields}</b> custom booking questions</p>
      <p><b>{plan.limits.sessionSeries}</b> session templates / recurring series</p>
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
      <p>Existing records remain saved if a plan later changes. An authorized platform administrator can review plan assignments and one-time extra team seat requests.</p>
     </div>}
     <Link className={styles.planCta} href={code==='free'?'/signup':placement==='home'?'/pricing#'+code:'/signup'}>
      {code==='free'?'Create a free business account':placement==='home'?'View '+plan.name+' plan information':'Start free while paid plans are in preparation'} <ArrowRight size={16}/>
     </Link>
    </article>;
   })}
  </div>
  <p className={styles.plansDisclosure}>Plan limits are applied to a business’s assigned subscription. Paid tiers can be assigned by a platform administrator after external verification; monthly subscription checkout is not connected yet. Automated AI receptionist, phone and SMS services are not included in these plans. Customer membership payments depend on separate merchant Stripe setup.</p>
 </section>;
}
