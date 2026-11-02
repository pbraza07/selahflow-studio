import {publicPageMetadata} from '../../server/search-metadata.mjs';
import BookingSoftwareDetails from '../components/booking-software-details';
import Link from 'next/link';
import {ArrowRight,Store} from 'lucide-react';
import PublicNavigation from '../components/public-navigation';
import PublicFooter from '../components/public-footer';
import PartnerValue,{RevenueExplainer} from '../components/partner-value';
import PlanBenefitCards from '../components/plan-benefit-cards';
import AccountLink from '../components/account-link';
import styles from '../site.module.css';
import audience from '../audience-pages.module.css';
export const metadata=publicPageMetadata('/businesses');
export default function BusinessesPage(){return <div className={styles.site}><PublicNavigation/><main id="main-content"><section className={audience.businessHero}><p className={styles.kicker}><Store size={16}/> FOR BUSINESS OWNERS &amp; TEAMS</p><h1>Booking software.<br/><em>Built for your service business.</em></h1><p>Manage online appointment scheduling, class bookings and memberships with your own branding, services and rules. Keep team schedules, client relationships and payment status organized, so your business can focus on the next customer experience.</p><div className={styles.actions}><Link className={styles.button} href="/signup">List your business <ArrowRight size={17}/></Link><Link className={styles.outline} href="#plans">Explore plans</Link><Link className={audience.textLink} href="#our-business-model">How SelahFlow earns revenue</Link></div><AccountLink/></section><PartnerValue/><PlanBenefitCards placement="home"/><BookingSoftwareDetails/><RevenueExplainer/></main><PublicFooter/></div>;}
