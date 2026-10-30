'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
type Notice={id:string;date:string;start:number;teamMember:string;customerName:string;services:string[];unread:boolean};
const time=(minutes:number)=>new Date(2000,0,1,Math.floor(minutes/60),minutes%60).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
export default function TeamAppointmentBell({onOpen}:{onOpen:()=>void}){
 const [items,setItems]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[open,setOpen]=useState(false);
 async function load(){try{const r=await fetch('/api/team/notifications',{cache:'no-store'}),d=await r.json();if(r.ok){setItems(d.items||[]);setUnread(d.unread||0);}}catch{}}
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),15000);return()=>clearInterval(timer);},[]);
 async function toggle(){const next=!open;setOpen(next);if(next&&unread){const ids=items.filter(i=>i.unread).map(i=>i.id);try{const r=await fetch('/api/team/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'markRead',ids})});if(r.ok){setUnread(0);setItems(v=>v.map(i=>({...i,unread:false})));}}catch{}}}
 return <div className="sf-notification-bell"><button type="button" className="sf-bell-button" onClick={()=>void toggle()} aria-label={`${unread} unread assigned appointment confirmations`} aria-expanded={open}><Bell size={21}/>{unread>0&&<span className="sf-bell-count">{unread>99?'99+':unread}</span>}</button>
  {open&&<div className="sf-bell-popover"><div className="sf-bell-heading"><strong>My appointment confirmations</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Close notifications">×</button></div><p className="sf-bell-meta">Only appointments assigned to this team member appear here.</p>{items.length?items.slice(0,8).map(i=><div className="sf-bell-item" key={i.id}><strong>{i.customerName} · {i.teamMember}</strong><span>{i.date} at {time(i.start)}{i.services.length?' · '+i.services.join(', '):''}</span></div>):<p className="sf-bell-empty">No assigned appointment confirmations.</p>}<button type="button" className="sf-bell-review" onClick={()=>{setOpen(false);onOpen();}}>Open my calendar →</button></div>}
 </div>;
}
