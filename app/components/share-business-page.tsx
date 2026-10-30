'use client';
import {useState} from 'react';
import {Share2,Check,Copy} from 'lucide-react';
export default function ShareBusinessPage({name,slug}:{name:string;slug?:string}){
 const [copied,setCopied]=useState(false);
 async function share(){
  const url=slug?new URL('/'+encodeURIComponent(slug),window.location.origin).href:new URL(window.location.pathname,window.location.origin).href;
  try{
   if(navigator.share){await navigator.share({title:name,text:'Visit '+name+' on SelahFlow',url});return;}
   await navigator.clipboard.writeText(url);setCopied(true);window.setTimeout(()=>setCopied(false),3000);
  }catch(error){if((error as Error).name==='AbortError')return;try{await navigator.clipboard.writeText(url);setCopied(true);window.setTimeout(()=>setCopied(false),3000);}catch{window.prompt('Copy business page link:',url);}}
 }
 return <button type="button" onClick={()=>void share()} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:9,padding:'12px 20px',borderRadius:9,border:'1px solid currentColor',background:'transparent',color:'inherit',font:'inherit',fontWeight:600,cursor:'pointer'}} aria-label={'Share '+name+' business page'}>{copied?<Check size={17}/>:<Share2 size={17}/>} {copied?'Link copied':'Share page'}</button>;
}
