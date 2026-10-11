import Image from 'next/image';
import Link from 'next/link';
import {ArrowRight, CalendarCheck2, ShieldCheck, Sparkles, Store, UsersRound} from 'lucide-react';
import AccountLink from './components/account-link';
import PlanBenefitCards from './components/plan-benefit-cards';
import styles from './site.module.css';
export default function PlatformHome(){return <div className={styles.site}>
<header className={styles.header}><Link href="/"><Image src="/brand/logo.svg" alt="SelahFlow" width={225} height={60}/></Link><nav><Link href="/discover">Find a business</Link><Link href="/pricing">Pricing</Link><Link href="/login">Sign in</Link><Link href="/signup">List your business</Link></nav></header>
<main><section className={styles.hero}><div><p className={styles.kicker}><Sparkles size={16}/> YOUR TIME, BEAUTIFULLY ORGANIZED</p><h1>More room to do <em>what matters.</em></h1><p>SelahFlow brings bookings, customers and everyday business operations together—so owners can focus on their craft and customers can book with confidence.</p><div className={styles.actions}><Link className={styles.button} href="/discover">Explore businesses <ArrowRight size={17}/></Link><Link className={styles.outline} href="/signup">Grow with SelahFlow</Link></div><AccountLink/></div><div className={styles.heroPanel}><p>SELAHFLOW / PAUSE &amp; FLOW</p><h2>Every appointment, a little more ease.</h2><p><CalendarCheck2 size={18}/> Easy scheduling and confirmed bookings</p><p><UsersRound size={18}/> Dedicated business workspaces</p><p><Store size={18}/> Discover service professionals</p><p><ShieldCheck size={18}/> Private, business-specific data</p></div></section>
<PlanBenefitCards placement="home"/></main>
<footer className={styles.footer}>SelahFlow · Pause &amp; Flow · v1.3.29 <Link href="/admin/platform">Platform administration</Link></footer></div>;}
