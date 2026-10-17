'use client';
import {useState} from 'react';
import Link from 'next/link';
import styles from '../../platform-pages.module.css';
export default function PlatformAccessDenied(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function switchAccount(){setBusy(true);setError('');try{
 const r=await fetch('/api/auth/logout',{method:'POST'});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'Could not sign out.');}
 window.location.assign('/login?next=%2Fadmin%2Fplatform');
 }catch(e){setError((e as Error).message);setBusy(false);}}
 return <main className={styles.shell}><header className={styles.top}><Link className={styles.brand} href="/"><img src="/brand/logo.svg?v=1.3.99" width="220" height="55" alt="SelahFlow"/></Link></header>
 <section className={styles.hero}><h1>Platform administration requires an administrator account</h1>
 <p>The signed-in account does not have the platform administrator role. This is a protected page; business-owner accounts cannot access administrator information.</p></section>
 <section className={styles.card} style={{maxWidth:740}}>
 <h2>Sign in with your administrator account</h2><p>Use the registered primary administrator email, <strong>pbraza@gmail.com</strong>, or another account specifically authorized by the primary administrator. Your business account and data have not been changed.</p>
 {error&&<p role="alert" className={styles.alert}>{error}</p>}
 <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:20}}><button className={styles.button} disabled={busy} onClick={switchAccount}>{busy?'Signing out…':'Switch to administrator account'}</button><Link className={styles.secondary} href="/">Back to SelahFlow</Link></div>
 <p style={{marginTop:18}}><small>For your security, the administrator dashboard remains restricted. If you are already using the primary account, sign out here, then sign in again to refresh your session.</small></p>
 </section></main>;
}
