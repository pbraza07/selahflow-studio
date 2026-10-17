import Link from 'next/link';
import {ArrowRight,CalendarCheck2,ChartNoAxesCombined,HeartHandshake,Repeat2} from 'lucide-react';
import styles from './partner-value.module.css';

export default function PartnerValue(){return <section className={styles.section} id="for-businesses" aria-labelledby="partner-heading">
 <div className={styles.heading}><span>FOR THE PEOPLE BEHIND THE BUSINESS</span><h2 id="partner-heading">You bring the talent.<br/>We help with the busywork.</h2><p>A booking link, an organized calendar and a clearer picture of your business. More room to serve your clients—and breathe.</p></div>
 <div className={styles.grid}>
  <article><CalendarCheck2 size={27} aria-hidden="true"/><h3>Make booking the easy part.</h3><p>Let clients request a time from your own booking page. Manage approvals, team schedules and group spaces in one place.</p></article>
  <article><Repeat2 size={27} aria-hidden="true"/><h3>Give regulars a reason to return.</h3><p>Offer memberships and packages. Keep client history, attendance, sessions left and renewals together.</p></article>
  <article><ChartNoAxesCombined size={27} aria-hidden="true"/><h3>See the numbers more clearly.</h3><p>Track paid services and membership activity separately from upcoming bookings. Spend less time piecing the story together.</p></article>
 </div>
 <details className={styles.details}><summary>How does that fit your business?</summary><div className={styles.examples}>
  <p><b>Coaches, academies &amp; classes</b><span>Keep rosters, available spaces and session balances in step. More coaching, less chasing the headcount.</span></p>
  <p><b>Beauty, wellness &amp; personal services</b><span>Give every appointment a place and every returning client a history. A calmer front desk starts here.</span></p>
  <p><b>Home, auto &amp; professional services</b><span>Share your services, collect booking details and organize the day. Your expertise stays at the center.</span></p>
 </div></details>
 <div className={styles.invitation}><HeartHandshake size={21} aria-hidden="true"/><p>Your business. Your branding. Your client relationships.</p><Link href="/signup">Start with Free <ArrowRight size={17}/></Link></div>
 </section>;}

export function RevenueExplainer(){return <section className={`${styles.section} ${styles.revenue}`} id="our-business-model" aria-labelledby="revenue-heading">
 <div className={styles.heading}><span>LET’S TALK MONEY, PLAINLY</span><h2 id="revenue-heading">How SelahFlow makes money.</h2><p>The model is simple: business plans, a proposed first-customer fee paid by the business, and optional extras. Here’s where things stand today.</p></div>
 <div className={styles.grid}>
  <article><span className={styles.label}>THE FOUNDATION</span><h3>Business subscriptions</h3><p>Start on Free. Professional and Business offer higher limits as your team grows.</p><strong className={styles.status}>Free is available. Paid billing is not active yet.</strong></article>
  <article><span className={styles.label}>PROPOSED · NOT CURRENTLY CHARGED</span><h3>10% on a first visit. Once.</h3><p>The proposed fee applies to a new client’s first eligible, completed and paid booking at your business. Repeat visits at that business don’t carry this fee.</p><strong className={styles.status}>This proposal includes your own links and referrals, as well as marketplace bookings.</strong></article>
  <article><span className={styles.label}>OPTIONAL · FUTURE OFFERINGS</span><h3>Extras you choose</h3><p>AI receptionist, enhanced messaging and marketing tools could be offered separately when available. They are not included in today’s plans.</p><strong className={styles.status}>Card processing costs are separate. Any future platform payment fee will be disclosed.</strong></article>
 </div>
 <div className={styles.feeExample}><b>A simple example of the proposed fee</b><p><strong>$100</strong> eligible first visit <span>→</span> <strong>$10</strong> to SelahFlow <span>→</span> <strong>$90</strong> to the business before processing costs.</p><small>Illustration only. This fee is not being collected today.</small></div>
 <details className={styles.details}><summary>A few fair questions about the proposed 10%</summary><div className={styles.faq}>
  <p><b>What about my existing clients?</b> Returning clients, duplicate profiles and imported customer records should not be treated as new customers.</p>
  <p><b>Does the booking source matter?</b> The proposal covers a new client from your website, social media, referrals or SelahFlow. It is broader than a marketplace referral fee.</p>
  <p><b>When would it start?</b> Only after clear terms are shared and accepted by the business. Eligibility, taxes, tips, refunds and any exclusions must be defined before collection begins.</p>
  <p><b>Does this replace my accountant?</b> SelahFlow organizes your operations and reporting. It does not replace accounting, tax or payroll services.</p>
 </div></details>
 </section>;}
