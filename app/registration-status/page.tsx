import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {getPool} from '../../server/database.mjs';
import {tokenHash} from '../../server/security.mjs';
import {dashboardPath} from '../../server/route-slugs.mjs';
import styles from '../platform-pages.module.css';
export const dynamic='force-dynamic';

export default async function RegistrationStatus(){
 const token=(await cookies()).get('salonflow_session')?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token))redirect('/login');
 const found=await getPool().query("SELECT b.name,b.slug,b.status,u.email,p.plan_code,p.requested_plan_code,p.billing_status FROM sessions s JOIN users u ON u.id=s.user_id JOIN businesses b ON b.owner_id=u.id LEFT JOIN business_subscriptions p ON p.business_id=b.id WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1",[tokenHash(token)]);
 const b=found.rows[0];if(!b)redirect('/login');
 const requested=b.requested_plan_code||'free',paid=requested!=='free',paymentVerified=!paid||(b.billing_status==='active'&&b.plan_code===requested);
 if(b.status==='active')redirect(paymentVerified?dashboardPath(b.slug):'/settings/package');
 const rejected=b.status==='rejected',suspended=b.status==='suspended';
 return <main className={styles.shell}>
  <header className={styles.top}><Link href="/" className={styles.brand}><img className="selah-logo" src="/brand/logo.svg?v=1.3.99" alt="SelahFlow" width="240" height="64"/></Link><nav className={styles.nav}><Link href="/login">Sign in</Link><Link href="/discover">Marketplace</Link></nav></header>
  <section className={styles.hero}><h1>{rejected?'Application not approved':suspended?'Business temporarily suspended':paid&&!paymentVerified?'Complete package payment':'Business registration awaiting approval'}</h1><p>{b.name} · {b.email}</p></section>
  <section className={styles.card} style={{maxWidth:730}}>
   <p>Selected package: <strong>{requested}</strong>.</p>
   {rejected?<><h2>Your application was declined.</h2><p>Contact SelahFlow platform support for more information.</p></>:suspended?<><h2>This business is not currently active.</h2><p>Please contact SelahFlow platform support.</p></>:paid&&!paymentVerified?<><h2>Your signed agreement was received.</h2><p>Next, complete secure Stripe payment. The business page and dashboard stay private until Stripe verifies the first paid invoice and the primary administrator approves the application.</p><p><Link href="/settings/package?onboarding=1" className={styles.button}>Sign up now and pay with Stripe</Link></p></>:<><h2>{paid?'Stripe payment verified.':'Your signed Free application was received.'}</h2><p>The primary SelahFlow administrator must approve your business before the owner dashboard and public page become functional.</p><p><Link href="/registration-status" className={styles.button}>Refresh approval status</Link></p></>}
  </section>
 </main>;
}
