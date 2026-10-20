import Link from 'next/link';
import {ArrowRight,CalendarCheck2,ChartNoAxesCombined,HeartHandshake,Repeat2,Palette,Users,ClipboardList,Bell,Share2,Download} from 'lucide-react';
import styles from './partner-value.module.css';

export default function PartnerValue(){return <section className={styles.section} id="for-businesses" aria-labelledby="partner-heading">
 <div className={styles.heading}><span>FOR THE PEOPLE BEHIND THE BUSINESS</span><h2 id="partner-heading">You bring the talent.<br/>We help with the busywork.</h2><p>Your brand, your booking rules and your client relationships—in one workspace. Give customers a convenient way to book while your team spends more time delivering great service.</p></div>
 <div className={styles.grid}>
  <article><Palette size={27} aria-hidden="true"/><h3>Your business, your look.</h3><p>Customize your logo, colors, fonts, images and page wording. Edit your public pages in live view and collect the registration answers your business needs.</p></article>
  <article><CalendarCheck2 size={27} aria-hidden="true"/><h3>Make booking the easy part.</h3><p>Let clients request a time from your own booking page. Manage approvals, team schedules and group spaces in one place.</p></article>
  <article><Repeat2 size={27} aria-hidden="true"/><h3>Give regulars a reason to return.</h3><p>Offer memberships and packages. Keep client history, attendance, sessions left and renewals together.</p></article>
  <article><ChartNoAxesCombined size={27} aria-hidden="true"/><h3>See the numbers more clearly.</h3><p>See submitted, approved, pending-payment and paid amounts in their own categories. Track membership purchases and renewals alongside services, with unpaid projections separate from money received.</p></article>
  <article><Users size={27} aria-hidden="true"/><h3>A team that stays in sync.</h3><p>See daily, weekly and monthly schedules, class rosters and spaces left. Set recurring sessions, block unavailable times and move sessions while preserving existing sign-ups.</p></article>
  <article><ClipboardList size={27} aria-hidden="true"/><h3>Know the client behind the booking.</h3><p>Keep client profiles, unique membership IDs, booking answers and attendance history together. Check clients in, record no-shows and see membership sessions remaining.</p></article>
  <article><Bell size={27} aria-hidden="true"/><h3>Clearer next steps for customers.</h3><p>Choose which services need approval. Offer payment links, booking updates and membership receipts with configured payment and email providers. Device push is available where enabled.</p></article>
  <article><Share2 size={27} aria-hidden="true"/><h3>One link, wherever clients find you.</h3><p>Share your business and booking pages through your website, social profiles or a message. Approved businesses can also be discovered in the SelahFlow marketplace.</p></article>
  <article><Download size={27} aria-hidden="true"/><h3>Less scattered recordkeeping.</h3><p>Import client lists, export records and open the details behind your reports. Keep operational history organized without building a separate spreadsheet for every task.</p></article>
  <article><HeartHandshake size={27} aria-hidden="true"/><h3>A simple first-visit fee model.</h3><p>The proposed 10% fee applies once to a new client’s first eligible completed, paid visit. Repeat visits at that business do not carry that fee. The fee is not currently collected.</p><a href="#our-business-model">See the fee example and terms</a></article>
 </div>
 <p className={styles.availability}>Feature limits depend on your plan. Payment links, email and device push require compatible providers and configuration. Start with Free; paid subscription billing and the proposed first-visit fee are not active. SelahFlow organizes your records but does not replace accounting or tax advice.</p>
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
