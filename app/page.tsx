import Link from 'next/link';
import {ArrowRight,CalendarCheck2,Store} from 'lucide-react';
import PublicNavigation from './components/public-navigation';
import PublicFooter from './components/public-footer';
import styles from './site.module.css';
import audience from './audience-pages.module.css';
export default function PlatformHome(){return <div className={styles.site}><PublicNavigation/><main id="main-content" className={audience.home}><p className={styles.kicker}>SELAHFLOW · PAUSE &amp; FLOW</p><h1>A little more ease.<br/><em>Whichever side of the booking you’re on.</em></h1><p>Here to book your next visit, or make your business day run more smoothly? Find your flow.</p><div className={audience.audiences}><article><CalendarCheck2 size={32} aria-hidden="true"/><h2>For customers</h2><p>Find a business, choose your next session and know what’s happening with your registration or membership.</p><Link className={styles.button} href="/customers">Find your next appointment <ArrowRight size={18}/></Link></article><article><Store size={32} aria-hidden="true"/><h2>For businesses</h2><p>Meet your calmer workday. Explore booking tools, client and membership management, plans and how partnering with SelahFlow works.</p><Link className={styles.button} href="/businesses">Explore business benefits <ArrowRight size={18}/></Link></article></div></main><PublicFooter/></div>;}
