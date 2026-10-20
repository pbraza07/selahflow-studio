import Link from 'next/link';
import {ArrowRight,Store} from 'lucide-react';
import PublicNavigation from '../components/public-navigation';
import PublicFooter from '../components/public-footer';
import PartnerValue,{RevenueExplainer} from '../components/partner-value';
import PlanBenefitCards from '../components/plan-benefit-cards';
import AccountLink from '../components/account-link';
import styles from '../site.module.css';
import audience from '../audience-pages.module.css';
export const metadata={title:'For businesses | SelahFlow',description:'Organize bookings, clients and memberships. Explore SelahFlow benefits, plans and transparent pricing.'};
export default function BusinessesPage(){return <div className={styles.site}><PublicNavigation/><main id="main-content"><section className={audience.businessHero}><p className={styles.kicker}><Store size={16}/> FOR BUSINESS OWNERS &amp; TEAMS</p><h1>Less juggling.<br/><em>More doing what you love.</em></h1><p>Build a booking experience with your own branding, services and rules. Keep schedules, client relationships, memberships and every financial stage organized—so your business can focus on the next great customer experience.</p><div className={styles.actions}><Link className={styles.button} href="/signup">List your business <ArrowRight size={17}/></Link><Link className={styles.outline} href="#plans">Explore plans</Link><Link className={audience.textLink} href="#our-business-model">How SelahFlow earns revenue</Link></div><AccountLink/></section><PartnerValue/><PlanBenefitCards placement="home"/><RevenueExplainer/></main><PublicFooter/></div>;}
