'use client';
import {useRef} from 'react';
import {usePathname} from 'next/navigation';
import {Menu,ArrowUpRight} from 'lucide-react';
import styles from './business-navigation.module.css';
export default function BusinessNavigation({slug,name,note,hasLogo=false}:{slug:string;name:string;note?:string;hasLogo?:boolean}){
 const menu=useRef<HTMLDetailsElement>(null),home='/'+encodeURIComponent(slug),book='/book/'+encodeURIComponent(slug);
 const pathname=usePathname();
 const links=<><a href={home} aria-current={pathname===home?'page':undefined}>Overview</a><a href={book} aria-current={pathname===book?'page':undefined}>Book a session</a><a href={'/membership/'+encodeURIComponent(slug)} aria-current={pathname==='/membership/'+encodeURIComponent(slug)?'page':undefined}>Memberships</a><a href={book+'#registration-status'}>Check registration</a><a href="/login">Owner sign in <ArrowUpRight size={14}/></a></>;
 return <header className={styles.header}><a className={styles.identity} href={home}>{hasLogo?<span className="sf-business-logo-frame"><img className="sf-business-logo-image" src={'/api/branding/logo?slug='+encodeURIComponent(slug)} alt="" width={132} height={112} onError={e=>{e.currentTarget.style.display='none';}}/></span>:<span className={styles.mark} aria-hidden="true">{name.slice(0,1)}</span>}<span><strong>{name}</strong><small>{note||'BOOK. BELONG. FIND YOUR FLOW.'}</small></span></a><nav className={styles.desktop} aria-label="Business navigation">{links}</nav><details className={styles.mobile} ref={menu} onKeyDown={e=>{if(e.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}><summary><Menu size={21}/> Menu</summary><nav aria-label="Business mobile navigation" onClick={e=>{if((e.target as Element).closest('a')&&menu.current)menu.current.open=false;}}>{links}</nav></details></header>;
}
