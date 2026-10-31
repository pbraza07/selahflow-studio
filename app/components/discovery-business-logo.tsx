'use client';
import {useState} from 'react';
import styles from '../site.module.css';
const placeholder='/brand/symbol.svg';
export default function DiscoveryBusinessLogo({slug,name,hasLogo=false,logoVersion}:{slug:string;name:string;hasLogo?:boolean;logoVersion?:string|null}){
 const [failedSource,setFailedSource]=useState('');
 const source=hasLogo?'/api/branding/logo?'+new URLSearchParams({slug,...(logoVersion?{v:logoVersion}:{})}).toString():placeholder;
 const fallback=source===placeholder||source===failedSource;
 return <a className={styles.discoveryBusinessLogo} href={'/'+encodeURIComponent(slug)} aria-label={'Visit '+name+' business page'}><img src={fallback?placeholder:source} alt={fallback?'SelahFlow':name+' logo'} width={180} height={120} loading="lazy" data-placeholder={fallback?'true':undefined} onError={()=>{if(!fallback)setFailedSource(source);}}/></a>;
}
