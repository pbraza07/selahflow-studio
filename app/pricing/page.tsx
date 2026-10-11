import styles from '../platform-pages.module.css';
import {AI_ADDON_MONTHLY_CENTS} from '../../lib/plans';
import PlanBenefitCards from '../components/plan-benefit-cards';
export default function Pricing(){
 return <main className={styles.shell}>
  <header className={styles.top}><a className={styles.brand} href="/"><img className="selah-logo" src="/brand/logo.svg" alt="SelahFlow" width="380" height="68"/></a>
   <nav className={styles.nav}><a href="/discover">Discover</a><a href="/signup">Join free</a><a href="/login">Owner login</a></nav></header>
  <section className={styles.hero}><h1>Find the right SelahFlow plan.</h1>
   <p>Compare precisely what each tier includes and which limits will apply to your business when that plan is assigned. A free account can be registered today.</p>
   <p><b>Paid subscription checkout is not active yet.</b> Professional and Business prices are proposed, not charges. Platform administrators may assign entitlements manually after verification outside SelahFlow.</p>
  </section>
  <PlanBenefitCards placement="pricing"/>
  <section className={styles.card} aria-label="Optional AI receptionist information"><h2>Future AI Receptionist add-on</h2>
   <p className={styles.price}>$${(AI_ADDON_MONTHLY_CENTS/100).toFixed(2)}<small> /month proposed, plus disclosed usage charges</small></p>
   <p>Voice calls, AI-managed SMS, advanced phone automation and usage-billed integrations are <b>not enabled</b> as part of any tier today. Email and SMS notifications require the applicable configured providers; device push remains a separate permission per business/device.</p>
  </section>
  <footer className={styles.footer}>Actual processor fees, taxes, provider usage and paid-plan terms will be published before a paid checkout becomes available. Subscription benefits are controlled by the business’s stored entitlement, not by selecting a plan on this page.</footer>
 </main>;
}