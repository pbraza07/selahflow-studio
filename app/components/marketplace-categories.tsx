'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import {BUSINESS_INDUSTRIES} from '../../lib/business-options';
import styles from '../site.module.css';
export default function MarketplaceCategories(){
 const [industries,setIndustries]=useState<string[]>([]);
 useEffect(()=>{
  let controller:AbortController|undefined;
  async function load(){
   controller?.abort();controller=new AbortController();const current=controller;
   try{const response=await fetch('/api/marketplace',{cache:'no-store',signal:current.signal}),data=await response.json();if(!response.ok)throw Error('Marketplace unavailable.');if(!current.signal.aborted)setIndustries(Array.isArray(data.industries)?data.industries.filter((x:unknown)=>typeof x==='string'):[]);}catch{if(!current.signal.aborted)setIndustries([]);}
  }
  const visible=()=>{if(document.visibilityState==='visible')void load();};
  void load();document.addEventListener('visibilitychange',visible);
  return()=>{controller?.abort();document.removeEventListener('visibilitychange',visible);};
 },[]);
 const available=new Set(industries);
 const categories=BUSINESS_INDUSTRIES.filter(([id])=>available.has(id)).sort((a,b)=>a[1].localeCompare(b[1]));
 if(!categories.length)return null;
 return <nav className={styles.categoryChips} aria-label="Explore categories">{categories.map(([id,label])=><Link key={id} href={'/discover?industry='+encodeURIComponent(id)}>{label}<ArrowRight size={14}/></Link>)}</nav>;
}
