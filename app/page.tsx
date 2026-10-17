import {APP_VERSION} from '../lib/app-version';
import Link from 'next/link';
import {ArrowRight, Search, Sparkles} from 'lucide-react';
import AccountLink from './components/account-link';
import PlanBenefitCards from './components/plan-benefit-cards';
import PublicNavigation from './components/public-navigation';
import PartnerValue,{RevenueExplainer} from './components/partner-value';
import styles from './site.module.css';
export default function PlatformHome(){return <div className={styles.site}>
<PublicNavigation/>
<main id="main-content"><section className={`${styles.hero} ${styles.discoveryHero}`}><div><p className={styles.kicker}><Sparkles size={16}/> PAUSE. FIND YOUR MOMENT.</p><h1>Make time for <em>what matters.</em></h1><p>From your next training session to everyday care, find a business and a time that works for you.</p>
<form action="/discover" method="get" className={styles.homeSearch} role="search" aria-label="Find a business"><label>What are you looking for?<input name="q" placeholder="Business name or keyword" maxLength={80}/></label><label>Where?<input name="city" placeholder="City (optional)" autoComplete="address-level2" maxLength={80}/></label><button className={styles.button} type="submit"><Search size={18}/> Find a business</button></form>
<nav className={styles.categoryChips} aria-label="Explore categories">{[['sports-coaching','Sports coaching'],['fitness','Fitness'],['hair','Hair & beauty'],['wellness','Wellness'],['auto-detailing','Auto detailing']].map(([value,label])=><Link key={value} href={'/discover?industry='+value}>{label}<ArrowRight size={14}/></Link>)}</nav><AccountLink/></div>
<aside className={styles.heroPanel}><p className={styles.kicker}>A LITTLE LESS ADMIN. MORE LIFE.</p><h2>Your next appointment starts here.</h2><ol className={styles.journey}><li><span>01</span><div><b>Find your fit</b><p>Explore businesses, services and locations.</p></div></li><li><span>02</span><div><b>Choose your time</b><p>See availability and send your booking request.</p></div></li><li><span>03</span><div><b>Know what’s next</b><p>Check your booking status and follow the business’s payment instructions.</p></div></li></ol><Link className={styles.panelLink} href="/discover">Explore all businesses <ArrowRight size={18}/></Link></aside></section>
<PartnerValue/>
<PlanBenefitCards placement="home"/><RevenueExplainer/></main>
<footer className={styles.footer}><span>SelahFlow · Pause &amp; Flow · v{APP_VERSION}</span><nav aria-label="Footer"><Link href="/discover">For customers</Link><Link href="/pricing">For businesses</Link><Link href="/admin/platform">Platform administration</Link></nav></footer></div>;}
