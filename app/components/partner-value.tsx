import BenefitsTable from './benefits-table';
import Link from 'next/link';
import {ArrowRight,CalendarCheck2,ChartNoAxesCombined,HeartHandshake,Repeat2,Palette,Users,ClipboardList,Bell,Share2,Download} from 'lucide-react';
import styles from './partner-value.module.css';

export default function PartnerValue(){return <section className={styles.section} id="for-businesses" aria-labelledby="partner-heading">
 <div className={styles.heading}><span>FOR THE PEOPLE BEHIND THE BUSINESS</span><h2 id="partner-heading">You bring the talent.<br/>We help with the busywork.</h2><p>Your brand, your booking rules and your client relationships—in one workspace. Give customers a convenient way to book while your team spends more time delivering great service.</p></div>
 <BenefitsTable/>
 <p className={styles.availability}>Feature limits depend on your plan. Payment links, email and device push require compatible providers and configuration. Start with Free or authorize a monthly paid package through Stripe after business approval. First-purchase commissions require administrator activation and accepted terms; cash billing also requires separate card authorization. SelahFlow organizes your records but does not replace accounting or tax advice.</p>
 <details className={styles.details}><summary>How does that fit your business?</summary><div className={styles.examples}>
  <p><b>Coaches, academies &amp; classes</b><span>Keep rosters, available spaces and session balances in step. More coaching, less chasing the headcount.</span></p>
  <p><b>Beauty, wellness &amp; personal services</b><span>Give every appointment a place and every returning client a history. A calmer front desk starts here.</span></p>
  <p><b>Home, auto &amp; professional services</b><span>Share your services, collect booking details and organize the day. Your expertise stays at the center.</span></p>
 </div></details>
 <div className={styles.invitation}><HeartHandshake size={21} aria-hidden="true"/><p>Your business. Your branding. Your client relationships.</p><Link href="/signup">Start with Free <ArrowRight size={17}/></Link></div>
 </section>;}

export function RevenueExplainer(){return <section className={`${styles.section} ${styles.revenue}`} id="our-business-model" aria-labelledby="revenue-heading">
 <div className={styles.heading}><span>LET’S TALK MONEY, PLAINLY</span><h2 id="revenue-heading">How SelahFlow makes money.</h2><p>The model is simple: business plans, optional first-purchase fees paid by the business, and optional extras. Here’s where things stand today.</p></div>
 <div className={styles.grid}>
  <article><span className={styles.label}>THE FOUNDATION</span><h3>Business subscriptions</h3><p>Start on Free. Professional and Business offer higher limits as your team grows.</p><strong className={styles.status}>Free has no monthly package fee. Paid packages use authorized monthly Stripe billing.</strong></article>
  <article><span className={styles.label}>OWNER TERMS ACCEPTANCE AND ADMIN ACTIVATION REQUIRED</span><h3>10% or $5 minimum on each first purchase type.</h3><p>The platform administrator can activate a commission of 10% or $5, whichever is greater, on a client’s first paid booking and separately on their first paid membership. Repeat bookings and membership renewals carry no new commission.</p><strong className={styles.status}>Covers your own links, referrals and marketplace purchases after business activation.</strong></article>
  <article><span className={styles.label}>OPTIONAL · FUTURE OFFERINGS</span><h3>Extras you choose</h3><p>AI receptionist, enhanced messaging and marketing tools could be offered separately when available. They are not included in today’s plans.</p><strong className={styles.status}>Card processing costs are separate. Commission terms are reviewed in Business settings → Payment setup before activation.</strong></article>
 </div>
 <div className={styles.feeExample}><b>A simple example of the fee</b><p><strong>$100</strong> eligible first purchase <span>→</span> <strong>$10</strong> to SelahFlow <span>→</span> <strong>$90</strong> to the business before processing costs.</p><small>Illustration for an activated business. Stripe processing costs are additional.</small></div>
 <details className={styles.details}><summary>A few fair questions about commissions</summary><div className={styles.faq}>
  <p><b>What about my existing clients?</b> Existing booking clients at activation and previously paid memberships are protected. A client may qualify separately for a first membership after their first booking.</p>
  <p><b>Does the booking source matter?</b> The fee covers eligible first purchases from your website, social media, referrals or SelahFlow. Each business has its own eligibility tracking.</p>
  <p><b>When would it start?</b> After the business owner connects Stripe, accepts the fee terms in Business settings → Payment setup, and the platform administrator enables each fee. Card fees are deducted from business proceeds. Authorized cash commissions are itemized and billed monthly to the business’s saved card. They are not added to client prices. The fee is the greater of 10% or $5, capped at the payment amount minus $0.01 for payments of $5 or less. Discounts reduce the percentage fee basis; separately recorded taxes, tips and products are excluded from booking commissions. Verified Stripe refunds return the card commission proportionally. Contact support to correct a cash commission.</p>
  <p><b>Does this replace my accountant?</b> SelahFlow organizes your operations and reporting. It does not replace accounting, tax or payroll services.</p>
 </div></details>
 </section>;}
