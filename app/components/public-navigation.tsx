'use client';
import Link from 'next/link';
import {useRef} from 'react';
import {usePathname} from 'next/navigation';
import {Menu,ArrowUpRight} from 'lucide-react';
import styles from '../site.module.css';
export default function PublicNavigation(){
 const menu=useRef<HTMLDetailsElement>(null),pathname=usePathname();
 const links=<><Link href="/discover" aria-current={pathname==='/discover'?'page':undefined}>Find a business</Link><Link href="/customers#visit-help" aria-current={pathname==='/customers'?'page':undefined}>Client help</Link><Link href="/businesses" aria-current={pathname==='/businesses'?'page':undefined}>For business owners</Link><Link href="/pricing" aria-current={pathname==='/pricing'?'page':undefined}>Business plans</Link><Link href="/privacy" aria-current={pathname==='/privacy'?'page':undefined}>Privacy Policy</Link><Link href="/login">Business sign in</Link><Link className={styles.button} href="/signup">Register your business <ArrowUpRight size={16}/></Link></>;
 return <><a className={styles.skipLink} href="#main-content">Skip to content</a><header className={`${styles.header} ${styles.publicHeader}`}><Link href="/" aria-label="SelahFlow home"><img src="/brand/logo.svg?v=1.3.99" alt="SelahFlow" width="260" height="69"/></Link><nav className={styles.desktopNav} aria-label="Main">{links}</nav><details ref={menu} className={styles.mobileNav} onKeyDown={e=>{if(e.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}><summary><Menu size={21}/> Menu</summary><nav aria-label="Mobile main" onClick={e=>{if((e.target as Element).closest('a')&&menu.current)menu.current.open=false;}}>{links}</nav></details></header></>;
}
