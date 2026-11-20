import {publicPageMetadata} from '../../server/search-metadata.mjs';
import PublicNavigation from '../components/public-navigation';
import PublicFooter from '../components/public-footer';
import site from '../site.module.css';
import styles from '../platform-pages.module.css';
import PlanBenefitCards from '../components/plan-benefit-cards';
export const metadata=publicPageMetadata('/pricing');
export default function Pricing(){
 return <div className={site.site}><PublicNavigation/><main id="main-content" className={styles.shell}>
  <section className={styles.hero}><h1>Online booking software pricing.</h1>
   <p>Compare precisely what each tier includes and which limits will apply to your business when that plan is assigned. Choose a package, review and sign the business agreement, then submit your application.</p>
   <p>Free has no monthly charge. Professional and Business use recurring Stripe subscriptions after business approval. Package fees are separate from eligible first-customer commissions and processor fees.</p>
  </section>
  <PlanBenefitCards placement="pricing"/>
  <footer className={styles.footer}>Review package, commission, renewal and cancellation terms before signing up. Subscription benefits are controlled by the business’s stored entitlement, not by selecting a plan on this page.</footer>
 </main><PublicFooter/></div>;
}
