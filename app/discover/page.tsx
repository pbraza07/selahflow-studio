'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight, MapPin, Search, Store} from 'lucide-react';
import GoogleBusinessGallery from '../components/google-business-gallery';
import BusinessCarousel from '../components/business-carousel';
import DiscoveryBusinessLogo from '../components/discovery-business-logo';
import PublicFooter from '../components/public-footer';
import PublicNavigation from '../components/public-navigation';
import styles from '../site.module.css';
import {BUSINESS_INDUSTRIES} from '../../lib/business-options';
import {googleMapsDirections,displayBusinessAddress} from '../../lib/maps';
type Business={slug:string;name:string;industry:string;description:string;city:string;region:string;address?:string;hasLogo?:boolean;logoVersion?:string|null};
type Filters={q:string;city:string;industry:string};
const empty:Filters={q:'',city:'',industry:''};
export default function Discover(){
 const [filters,setFilters]=useState<Filters>(empty),[businesses,setBusinesses]=useState<Business[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null);
 async function search(values:Filters,updateUrl=false){
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setError('');setLoading(true);
  const params=new URLSearchParams();for(const [key,value] of Object.entries(values))if(value.trim())params.set(key,value.trim());
  if(updateUrl)window.history.pushState(null,'','/discover'+(params.size?'?'+params.toString():''));
  try{const r=await fetch('/api/marketplace?'+params,{signal:controller.signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Please try again.');if(!controller.signal.aborted)setBusinesses(d.businesses||[]);}
  catch(e){if(!controller.signal.aborted){setBusinesses([]);setError((e as Error).message);}}
  finally{if(!controller.signal.aborted)setLoading(false);}
 }
 useEffect(()=>{
  const restore=()=>{const p=new URLSearchParams(window.location.search);const values={q:(p.get('q')||'').slice(0,80),city:(p.get('city')||'').slice(0,80),industry:BUSINESS_INDUSTRIES.some(([v])=>v===p.get('industry'))?p.get('industry')! :''};setFilters(values);void search(values);};
  restore();window.addEventListener('popstate',restore);return()=>{request.current?.abort();window.removeEventListener('popstate',restore);};
 },[]);
 const clear=()=>{setFilters(empty);void search(empty,true);};
 const hasFilters=Object.values(filters).some(Boolean);
 return <div className={styles.site}><PublicNavigation/><main id="main-content" className={styles.discoveryMain}><section className={styles.discoveryHeading}><p className={styles.kicker}>DISCOVER YOUR NEXT MOMENT</p><h1>Find a business and book a service.</h1><p>Explore service businesses, view their services and choose a time on their booking page.</p></section>
 <form className={`${styles.homeSearch} ${styles.discoverySearch}`} role="search" aria-label="Search businesses" onSubmit={e=>{e.preventDefault();void search(filters,true);}}><label>Business or keyword<input placeholder="What are you looking for?" maxLength={80} value={filters.q} onChange={e=>setFilters({...filters,q:e.target.value})}/></label><label>City<input placeholder="Any city" autoComplete="address-level2" maxLength={80} value={filters.city} onChange={e=>setFilters({...filters,city:e.target.value})}/></label><label>Category<select value={filters.industry} onChange={e=>setFilters({...filters,industry:e.target.value})}><option value="">All categories</option>{[...BUSINESS_INDUSTRIES].sort((a,b)=>a[1].localeCompare(b[1])).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><button className={styles.button} type="submit"><Search size={18}/> Search</button></form>
 <div className={styles.resultsToolbar}><p role="status" aria-live="polite">{loading?'Finding businesses…':error?'Search unavailable':`${businesses.length} ${businesses.length===1?'business':'businesses'} found`}</p>{hasFilters&&<button className={styles.clearFilters} type="button" onClick={clear}>Clear filters</button>}</div>
 <section aria-label="Search results" aria-busy={loading}>{error?<div className={styles.discoveryEmpty}><h2>We couldn’t load businesses.</h2><p role="alert">{error}</p><button className={styles.button} onClick={()=>void search(filters)}>Try again</button></div>:loading?<div className={styles.businessGrid} aria-hidden="true">{[1,2,3].map(n=><div key={n} className={styles.loadingCard}><Store size={30}/><p>Finding your next appointment…</p></div>)}</div>:businesses.length?<BusinessCarousel key={businesses.map(b=>b.slug).join("|")} count={businesses.length}>{businesses.map(b=>{const address=displayBusinessAddress(b.address,b.city,b.region);return <article key={b.slug} className={styles.businessCard}><div className={styles.businessCardTop}><DiscoveryBusinessLogo slug={b.slug} name={b.name} hasLogo={b.hasLogo} logoVersion={b.logoVersion}/><span>{BUSINESS_INDUSTRIES.find(([v])=>v===b.industry)?.[1]||b.industry.replace(/-/g,' ')}</span></div><h2><a href={'/'+encodeURIComponent(b.slug)}>{b.name}</a></h2><p className={styles.businessAddress}><MapPin size={16}/>{address||'See business page for location'}</p><p className={styles.businessDescription}>{b.description||'Explore this business’s services and current availability.'}</p><GoogleBusinessGallery slug={b.slug} summary/><div className={styles.businessCardActions}><a className={styles.button} href={'/book/'+encodeURIComponent(b.slug)+'?source=marketplace'}>Book a service <ArrowRight size={17}/></a><a href={'/'+encodeURIComponent(b.slug)}>View business</a>{address&&<a href={googleMapsDirections(address)} target="_blank" rel="noopener noreferrer" aria-label={'Directions to '+b.name}>Directions ↗</a>}</div></article>;})}</BusinessCarousel>:<div className={styles.discoveryEmpty}><Search size={32}/><h2>A fresh search might help.</h2><p>Try a business name, a nearby city or a different category.</p><button className={styles.button} type="button" onClick={clear}>Explore all businesses</button></div>}</section>
 <aside className={styles.discoveryOwner}><div><h2>Your business belongs here.</h2><p>Give clients an easier way to find you and book.</p></div><a className={styles.outline} href="/signup">List your business <ArrowRight size={17}/></a></aside></main><PublicFooter/></div>;
}
