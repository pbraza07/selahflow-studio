'use client';
import Link from 'next/link';
import {useRef} from 'react';
import {usePathname} from 'next/navigation';
import {Menu, ArrowUpRight} from 'lucide-react';
import styles from '../site.module.css';
export default function PublicNavigation(){
 const menu=useRef<HTMLDetailsElement>(null);
 const pathname=usePathname();
 return <><a className={styles.skipLink} href="#main-content">Skip to content</a><header className={`${styles.header} ${styles.publicHeader}`}><Link href="/" aria-label="SelahFlow home"><img src="/brand/logo.svg?v=1.3.99" alt="SelahFlow" width="260" height="69"/></Link><nav className={styles.desktopNav} aria-label="Main"><Link href="/customers" aria-current={pathname==='/customers'||pathname==='/discover'?'page':undefined}>For customers</Link><Link href="/businesses" aria-current={pathname==='/businesses'||pathname==='/pricing'?'page':undefined}>For businesses</Link><Link href="/privacy" aria-current={pathname==='/privacy'?'page':undefined}>Privacy Policy</Link><Link href="/login">Sign in</Link><Link className={styles.button} href="/signup">List your business <ArrowUpRight size={16}/></Link></nav><details ref={menu} className={styles.mobileNav} onKeyDown={e=>{if(e.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}><summary><Menu size={21}/> Menu</summary><nav aria-label="Mobile main"><Link href="/customers">For customers</Link><Link href="/discover">Find a business <ArrowUpRight size={16}/></Link><Link href="/businesses">For businesses</Link><Link href="/login">Sign in to your workspace</Link><Link href="/signup">List your business</Link><Link href="/pricing">Compare plans</Link><Link href="/privacy" aria-current={pathname==='/privacy'?'page':undefined}>Privacy Policy</Link></nav></details></header></>;
}
