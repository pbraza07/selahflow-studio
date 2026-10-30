import TeamShowcase from '../components/team-showcase';
import {businessTeamShowcase} from '../../server/team-showcase.mjs';
import {businessIntroLines} from '../../server/business-profile-copy.mjs';
import {publicSocialLinks} from '../../server/business-social-links.mjs';
import BusinessAssistant from '../components/business-assistant';
import PoweredBySelahFlow from '../components/powered-by-selahflow';
import Image from 'next/image';
import BusinessNavigation from '../components/business-navigation';
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
type Row={id:string;name:string;slug:string;industry:string;description:string;city:string;region:string;data:string|null;brand_primary:string;brand_background:string;business_model:string;has_logo:boolean};
export default async function BusinessPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))notFound();
 const row=(await getPool().query("SELECT b.id,b.name,b.slug,b.industry,b.description,b.city,b.region,b.brand_primary,b.brand_background,b.business_model,EXISTS(SELECT 1 FROM business_logos l WHERE l.business_id=b.id) AS has_logo,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active' LIMIT 1",[slug])).rows[0] as Row|undefined;
 if(!row)notFound();
 let config:{staff?:any[];tagline?:string;services?:Service[];theme?:any;address?:string;socialLinks?:Record<string,string>;homeHeaderAction?:string;homeCta?:string;homeServicesTitle?:string;homeServicesIntro?:string}={};try{config=row.data?JSON.parse(row.data):{};}catch{}
 const services=(Array.isArray(config.services)?config.services:[]).filter(s=>s&&typeof s.name==='string'&&Number.isFinite(s.price)&&Number.isFinite(s.duration)).slice(0,30);
 const team=await businessTeamShowcase(getPool(),row.id,config);
 const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 const theme={...themeStyles(config.theme,row.brand_primary,row.brand_background),'--forest':row.brand_primary,'--forest-deep':row.brand_primary,'--cream':row.brand_background} as CSSProperties;
 return <div className={styles.site} style={theme} data-selah-theme="true"><BusinessNavigation slug={slug} name={row.name} hasLogo={row.has_logo} socialLinks={publicSocialLinks(config.socialLinks)} bookLabel={config.homeHeaderAction}/>
 <main><section className={styles.businessHero}><p className={styles.kicker}>{row.industry.replaceAll('-',' ').toUpperCase()} · SELAHFLOW BUSINESS</p>{row.has_logo&&<span className="sf-business-logo-surface"><img src={'/api/branding/logo?slug='+encodeURIComponent(row.slug)} alt={row.name+' logo'} className="sf-business-profile-logo"/></span>}<h1>{row.name}</h1>{businessIntroLines({tagline:config.tagline,business_model:row.business_model,description:row.description}).map((line,index)=><p key={index}>{line}</p>)}{displayBusinessAddress(config.address,row.city,row.region)&&<div className={styles.businessLocation}><MapPin size={17}/><a className="sf-directions-link" href={googleMapsDirections(displayBusinessAddress(config.address,row.city,row.region))} target="_blank" rel="noopener noreferrer" aria-label={'Get directions to '+row.name}>{displayBusinessAddress(config.address,row.city,row.region)} ↗</a></div>}<div className={styles.actions}><Link className={styles.button} href={'/book/'+slug}>{config.homeCta||'Book a service'} <ArrowRight size={17}/></Link><Link className={styles.outline} href={"/membership/"+slug}>View memberships &amp; join</Link><Link className={styles.outline} href="/discover">Explore other businesses</Link></div></section>
 <section className={styles.servicesSection}><h2>{config.homeServicesTitle||'Services & prices'}</h2><p>{config.homeServicesIntro||'Prices and durations reflect this business’s current service catalog.'}</p>{services.length?<div className={styles.serviceCards}>{services.map(s=><article key={s.id}><h3>{s.name}</h3>{s.description&&<p>{s.description}</p>}<div className={styles.serviceDetails}><span><Clock3 size={16}/>{durationLabel(s)}{isTermUnit(s.durationUnit||'minutes')?' · Enrollment':''}</span><strong>{price(s.price)}</strong></div></article>)}</div>:<div className={styles.emptyCatalog}><h3>Services coming soon</h3><p>This business is setting up its service catalog.</p></div>}</section>
 <TeamShowcase members={team}/>
 <div className={styles.businessGoogleSection}><GoogleBusinessGallery slug={slug} landing/></div>
 <section className={styles.featured}><div><h2>Ready to book with {row.name}?</h2><p>Choose your service, review available times, and send your booking request.</p></div><Link className={styles.button} href={'/book/'+slug}>See booking availability <ArrowRight size={17}/></Link></section></main><footer className={styles.footer}><PoweredBySelahFlow/><Link href={'/book/'+slug}>Book online</Link></footer><BusinessAssistant slug={slug} name={row.name}/></div>;
}
