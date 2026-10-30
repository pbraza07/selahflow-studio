import PublicNavigation from '../components/public-navigation';
import PublicFooter from '../components/public-footer';
import site from '../site.module.css';
import styles from '../platform-pages.module.css';
import {AI_ADDON_MONTHLY_CENTS} from '../../lib/plans';
import PlanBenefitCards from '../components/plan-benefit-cards';
export default function Pricing(){
 return <div className={site.site}><PublicNavigation/><main id="main-content" className={styles.shell}>
  <section className={styles.hero}><h1>Find the right SelahFlow plan.</h1>
   <p>Compare precisely what each tier includes and which limits will apply to your business when that plan is assigned. Choose a package, review and sign the business agreement, then submit your application.</p>
   <p>Free has no monthly charge. Professional and Business use recurring Stripe subscriptions after business approval. Package fees are separate from eligible first-customer commissions and processor fees.</p>
  </section>
  <PlanBenefitCards placement="pricing"/>
  <section className={styles.card} aria-label="Optional AI receptionist information"><h2>Future AI Receptionist add-on</h2>
   <p className={styles.price}>${(AI_ADDON_MONTHLY_CENTS/100).toFixed(2)}<small> /month proposed, plus disclosed usage charges</small></p>
   <p>Voice calls, AI-managed SMS, advanced phone automation and usage-billed integrations are <b>not enabled</b> as part of any tier today. Email and SMS notifications require the applicable configured providers; device push remains a separate permission per business/device.</p>
  </section>
  <footer className={styles.footer}>Review package, commission, renewal and cancellation terms before signing up. Subscription benefits are controlled by the business’s stored entitlement, not by selecting a plan on this page.</footer>
 </main><PublicFooter/></div>;
}
