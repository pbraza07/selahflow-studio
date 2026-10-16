'use client';
import Link from 'next/link';
import {useRef} from 'react';
import {Menu, ArrowUpRight} from 'lucide-react';
import styles from '../site.module.css';
export default function PublicNavigation(){
 const menu=useRef<HTMLDetailsElement>(null);
 return <><a className={styles.skipLink} href="#main-content">Skip to content</a><header className={`${styles.header} ${styles.publicHeader}`}><Link href="/" aria-label="SelahFlow home"><img src="/brand/logo.svg" alt="SelahFlow" width="225" height="60"/></Link><nav className={styles.desktopNav} aria-label="Main"><Link href="/discover">Find a business</Link><Link href="/pricing">For businesses</Link><Link href="/login">Sign in</Link><Link className={styles.button} href="/signup">List your business <ArrowUpRight size={16}/></Link></nav><details ref={menu} className={styles.mobileNav} onKeyDown={e=>{if(e.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}><summary><Menu size={21}/> Menu</summary><nav aria-label="Mobile main"><span>FOR CUSTOMERS</span><Link href="/discover">Find a business <ArrowUpRight size={16}/></Link><span>FOR BUSINESS OWNERS</span><Link href="/login">Sign in to your workspace</Link><Link href="/signup">List your business</Link><Link href="/pricing">Compare plans</Link></nav></details></header></>;
}
