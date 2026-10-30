'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {businessSlugFromPath,pageShortcuts,safeBusinessSlug} from '../../server/page-shortcuts.mjs';
export default function PageShortcuts(){
 const pathname=usePathname(),menu=useRef<HTMLDetailsElement>(null);
 const [context,setContext]=useState<{slug:string|null;profileId:string|null}>({slug:null,profileId:null});
 useEffect(()=>{
  const update=()=>{
   const marker=document.querySelector<HTMLElement>('[data-business-slug]');
   let slug=businessSlugFromPath(pathname)||safeBusinessSlug(marker?.dataset.businessSlug)||safeBusinessSlug(new URLSearchParams(window.location.search).get('business'));
   try{if(slug)sessionStorage.setItem('selahflow:last-public-business',slug);else slug=safeBusinessSlug(sessionStorage.getItem('selahflow:last-public-business'));}catch{}
   const profileId=document.querySelector<HTMLElement>('[data-team-profile-id]')?.dataset.teamProfileId||null;
   setContext(old=>old.slug===slug&&old.profileId===profileId?old:{slug,profileId});
  };
  update();if(menu.current)menu.current.open=false;
  const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-business-slug','data-team-profile-id']});
  const outside=(event:PointerEvent)=>{if(menu.current&&!menu.current.contains(event.target as Node))menu.current.open=false;};
  document.addEventListener('pointerdown',outside);
  return()=>{observer.disconnect();document.removeEventListener('pointerdown',outside);};
 },[pathname]);
 return <nav className="sf-page-shortcuts" aria-label="Page shortcuts"><button type="button" className="sf-shortcut-back" onClick={()=>{if(window.history.length>1)window.history.back();else window.location.assign(context.slug?'/'+context.slug:'/discover');}}><span aria-hidden="true">←</span> Back</button><details ref={menu} onKeyDown={event=>{if(event.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}><summary>Pages <span aria-hidden="true">⌄</span></summary><div className="sf-shortcut-menu" onClick={event=>{if((event.target as Element).closest('a')&&menu.current)menu.current.open=false;}}>{context.slug&&<span className="sf-shortcut-context">{context.slug.replaceAll('-',' ')}</span>}{pageShortcuts(context.slug,context.profileId).map((link:{label:string;href:string})=><a key={link.label} href={link.href} aria-current={pathname===link.href.split('?')[0]?'page':undefined}>{link.label}</a>)}<small>Owner and team workspaces require their own sign-in.</small></div></details></nav>;
}
