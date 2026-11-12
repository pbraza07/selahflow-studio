'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
export function clearKioskClientStorage(){for(const storage of [window.localStorage,window.sessionStorage])try{for(const key of Object.keys(storage))if(/selahflow|product-order/i.test(key))storage.removeItem(key);}catch{}}
export default function KioskReturnGuard(){
 const pathname=usePathname(),[slug,setSlug]=useState(''),[left,setLeft]=useState(90);
 useEffect(()=>{const match=document.cookie.match(/(?:^|;\s*)sf_kiosk_slug=([a-z0-9-]+)(?:;|$)/);setSlug(match?.[1]||'');},[pathname]);
 useEffect(()=>{if(!slug||pathname.startsWith('/login')||pathname.startsWith('/studio')||pathname.startsWith('/admin'))return;
 document.body.classList.add('sf-kiosk-active');
 const protectForms=()=>document.querySelectorAll('form,input').forEach(el=>{if(el.getAttribute('autocomplete')!=='off')el.setAttribute('autocomplete','off');});protectForms();const observer=new MutationObserver(protectForms);observer.observe(document.body,{childList:true,subtree:true});
 let last=Date.now(),resetting=false;
 const activity=()=>{last=Date.now();setLeft(90);};
 const reset=()=>{if(resetting)return;resetting=true;clearKioskClientStorage();fetch('/api/kiosk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({business:slug,action:'reset'}),keepalive:true}).catch(()=>{});if(pathname==='/check-in/'+slug){window.dispatchEvent(new Event('sf-kiosk-home'));last=Date.now();setLeft(90);resetting=false;}else window.location.replace('/check-in/'+slug);};
 const events=['pointerdown','keydown','input','touchstart'];events.forEach(e=>document.addEventListener(e,activity,{passive:true}));window.addEventListener('sf-kiosk-reset',reset);
 const timer=setInterval(()=>{const main=document.querySelector('main');if(main){const style=getComputedStyle(main);for(const key of ['button','on-button','surface','on-surface','border']){const color=style.getPropertyValue('--sf-'+key);if(color)document.body.style.setProperty('--kiosk-'+key,color);}}const remaining=Math.max(0,90-Math.floor((Date.now()-last)/1000));setLeft(remaining);if(remaining===0)reset();},1000);
 // Never restore a prior client's page from the browser back/forward cache.
 const restore=(e:PageTransitionEvent)=>{if(e.persisted){clearKioskClientStorage();window.location.replace('/check-in/'+slug);}};window.addEventListener('pageshow',restore);
 return()=>{observer.disconnect();document.body.classList.remove('sf-kiosk-active');events.forEach(e=>document.removeEventListener(e,activity));window.removeEventListener('sf-kiosk-reset',reset);window.removeEventListener('pageshow',restore);clearInterval(timer);};
 },[slug,pathname]);
 if(!slug||pathname.startsWith('/login')||pathname.startsWith('/studio')||pathname.startsWith('/admin'))return null;
 return <aside className="sf-kiosk-return" aria-label="Tablet privacy controls"><span role={left<=20?'status':undefined}>{left<=20?`Returning to welcome in ${left} seconds…`:'Shared tablet · Finish here before leaving'}</span>{left<=20&&<button onClick={()=>document.dispatchEvent(new Event('pointerdown'))}>I’m still here</button>}<button onClick={()=>window.dispatchEvent(new Event('sf-kiosk-reset'))}>Done / Next client</button></aside>;
}
