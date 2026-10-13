'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
type Notice={kind?:string;id:string;date:string;start_minute:number;created_at:string;customerName:string;services:string[];unread:boolean};
export default function OwnerNotificationBell({onOpen}:{onOpen:()=>void}){
 const [items,setItems]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[open,setOpen]=useState(false);
 async function load(){try{const r=await fetch('/api/push/inbox',{cache:'no-store'}),d=await r.json();if(r.ok){setItems(d.items||[]);setUnread(d.unread||0);}}catch{}}
 useEffect(()=>{load();const timer=setInterval(load,15000);const handler=()=>load();window.addEventListener('selahflow:booking-reviewed',handler);return()=>{clearInterval(timer);window.removeEventListener('selahflow:booking-reviewed',handler);};},[]);
 async function toggle(){const newOpen=!open;setOpen(newOpen);
  if(newOpen&&items.some(x=>x.unread)){
   const ids=items.filter(x=>x.unread).map(x=>x.id);
   try{const r=await fetch('/api/push/inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'markRead',ids})});if(r.ok){setUnread(0);setItems(items.map(i=>({...i,unread:false})));}}catch{}
  }
 }
 return <div className="sf-notification-bell">
 <button className="sf-bell-button" aria-label={'Request alerts: '+unread+' unread'} aria-expanded={open} type="button" onClick={toggle}><Bell size={21}/>{unread>0&&<span className="sf-bell-count">{unread>99?'99+':unread}</span>}</button>
 {open&&<div className="sf-bell-popover"><div className="sf-bell-heading"><strong>Booking & membership alerts</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Close notifications">×</button></div>
  <p className="sf-bell-meta">{items.length} pending requests · New items marked read when opened</p>
  {items.length?items.slice(0,8).map(item=><div className="sf-bell-item" key={item.id}><strong>{item.kind==='membership'?'MEMBERSHIP REQUEST · ':''}{item.customerName||'Customer'}</strong><span>{item.date||'Membership'} · {(item.services||[]).join(', ')}</span></div>):<p className="sf-bell-empty">No pending requests.</p>}
  <button type="button" className="sf-bell-review" onClick={()=>{setOpen(false);onOpen();}}>Open approval inbox →</button>
 </div>}
 </div>;
}
