import Image from 'next/image';
import type {CSSProperties} from 'react';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowRight,Clock3,MapPin} from 'lucide-react';
import {getPool} from '../../server/database.mjs';
import styles from '../site.module.css';
import {themeStyles} from '../../server/themes.mjs';
import {durationLabel,isTermUnit} from '../../lib/service-terms';
import {googleMapsDirections,displayBusinessAddress} from '../../lib/maps';
import GoogleBusinessGallery from '../components/google-business-gallery';
import ShareBusinessPage from '../components/share-business-page';
export const dynamic='force-dynamic';
type Service={id:string;name:string;duration:number;durationUnit?:string;durationValue?:number;price:number;description?:string};
type Row={name:string;slug:string;industry:string;description:string;city:string;region:string;data:string|null;brand_primary:string;brand_background:string;business_model:string;has_logo:boolean};
export default async function BusinessPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))notFound();
 const row=(await getPool().query("SELECT b.name,b.slug,b.industry,b.description,b.city,b.region,b.brand_primary,b.brand_background,b.business_model,EXISTS(SELECT 1 FROM business_logos l WHERE l.business_id=b.id) AS has_logo,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active' LIMIT 1",[slug])).rows[0] as Row|undefined;
 if(!row)notFound();
 let config:{tagline?:string;services?:Service[];theme?:any;address?:string}={};try{config=row.data?JSON.parse(row.data):{};}catch{}
 const services=(Array.isArray(config.services)?config.services:[]).filter(s=>s&&typeof s.name==='string'&&Number.isFinite(s.price)&&Number.isFinite(s.duration)).slice(0,30);
 const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 const theme={...themeStyles(config.theme,row.brand_primary,row.brand_background),'--forest':row.brand_primary,'--forest-deep':row.brand_primary,'--cream':row.brand_background} as CSSProperties;
 return <div className={styles.site} style={theme} data-selah-theme="true"><header className={styles.header}><Link href="/"><Image src="/brand/logo.svg" alt="SelahFlow" width={220} height={60}/></Link><nav><Link href="/discover">Discover</Link><Link href="/login">Owner login</Link><Link href={'/book/'+slug}>Book appointment</Link></nav></header>
 <main><section className={styles.businessHero}><p className={styles.kicker}>{row.industry.replaceAll('-',' ').toUpperCase()} · SELAHFLOW BUSINESS</p>{row.has_logo&&<img src={'/api/branding/logo?slug='+encodeURIComponent(row.slug)} alt={row.name+' logo'} className="sf-business-profile-logo"/>}<h1>{row.name}</h1><p>{row.business_model||row.description||config.tagline||'Appointments made simple. Discover services and book a time that works for you.'}</p>{displayBusinessAddress(config.address,row.city,row.region)&&<div className={styles.businessLocation}><MapPin size={17}/><a className="sf-directions-link" href={googleMapsDirections(displayBusinessAddress(config.address,row.city,row.region))} target="_blank" rel="noopener noreferrer" aria-label={'Get directions to '+row.name}>{displayBusinessAddress(config.address,row.city,row.region)} ↗</a></div>}<div className={styles.actions}><ShareBusinessPage name={row.name}/><Link className={styles.button} href={'/book/'+slug}>Book an appointment <ArrowRight size={17}/></Link><Link className={styles.outline} href={"/membership/"+slug}>View memberships &amp; join</Link><Link className={styles.outline} href="/discover">Explore other businesses</Link></div></section>
 <GoogleBusinessGallery slug={slug}/>
 <section className={styles.servicesSection}><h2>Services &amp; prices</h2><p>Prices and durations reflect this business's current service catalog.</p>{services.length?<div className={styles.serviceCards}>{services.map(s=><article key={s.id}><h3>{s.name}</h3>{s.description&&<p>{s.description}</p>}<div className={styles.serviceDetails}><span><Clock3 size={16}/>{durationLabel(s)}{isTermUnit(s.durationUnit||'minutes')?' · Enrollment':''}</span><strong>{price(s.price)}</strong></div></article>)}</div>:<div className={styles.emptyCatalog}><h3>Services coming soon</h3><p>This business is setting up its appointment catalog.</p></div>}</section>
 <section className={styles.featured}><div><h2>Ready to visit {row.name}?</h2><p>Choose your services, professional, date and available time.</p></div><Link className={styles.button} href={'/book/'+slug}>See available appointments <ArrowRight size={17}/></Link></section></main><footer className={styles.footer}><Link href="/">Powered by SelahFlow</Link><Link href={'/book/'+slug}>Book online</Link></footer></div>;
}
