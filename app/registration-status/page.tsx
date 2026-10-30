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
 const found=await getPool().query("SELECT b.name,b.slug,b.status,u.email,p.requested_plan_code,p.billing_status FROM sessions s JOIN users u ON u.id=s.user_id JOIN businesses b ON b.owner_id=u.id LEFT JOIN business_subscriptions p ON p.business_id=b.id WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1",[tokenHash(token)]);
 const b=found.rows[0];if(!b)redirect('/login');
 if(b.status==='active')redirect(b.requested_plan_code&&b.requested_plan_code!=='free'&&b.billing_status!=='active'?'/settings/package':dashboardPath(b.slug));
 const rejected=b.status==='rejected',suspended=b.status==='suspended';
 return <main className={styles.shell}><header className={styles.top}><Link href="/" className={styles.brand}><img className="selah-logo" src="/brand/logo.svg?v=1.3.99" alt="SelahFlow" width="240" height="64"/></Link><nav className={styles.nav}><Link href="/login">Sign in</Link><Link href="/discover">Marketplace</Link></nav></header>
 <section className={styles.hero}><h1>{rejected?'Application not approved':suspended?'Business temporarily suspended':'Business registration awaiting approval'}</h1><p>{b.name} · {b.email}</p></section>
 <section className={styles.card} style={{maxWidth:730}}><p>Selected package: {b.requested_plan_code||'free'}. Paid checkout becomes available after approval; submitting this application does not charge a package fee.</p><h2>{rejected?'Your application was declined.':suspended?'This business is not currently active.':'Your application has been received.'}</h2><p>{rejected?'Your business was not approved. Contact SelahFlow platform support for more information.':suspended?'Please contact SelahFlow platform support.':'The primary SelahFlow administrator must approve your business before you can access the owner dashboard and accept bookings.'}</p><p>{!rejected&&!suspended?'After approval, your business will automatically appear in the marketplace. You may then sign in and configure services and staff.':''}</p><p><Link href="/registration-status" className={styles.button}>Refresh approval status</Link></p></section></main>;
}
