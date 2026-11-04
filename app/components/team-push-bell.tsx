'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
export default function TeamPushBell({token}:{token:string}){
 const [count,setCount]=useState(0),[open,setOpen]=useState(false),[items,setItems]=useState<{id:string;customerName:string;date:string;unread:boolean}[]>([]);
 async function load(){try{const r=await fetch('/api/push/inbox',{headers:{Authorization:'Bearer '+token},cache:'no-store'}),d=await r.json();if(r.ok){setCount(d.unread||0);setItems(d.items||[]);}}catch{}}
 useEffect(()=>{load();const id=setInterval(load,15000);return()=>clearInterval(id);},[token]);
 async function show(){setOpen(!open);if(!open&&count>0){const r=await fetch('/api/push/inbox',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'markRead',ids:items.filter(x=>x.unread).map(x=>x.id)})});if(r.ok){setCount(0);setItems(v=>v.map(i=>({...i,unread:false})));}}}
 return <div className="sf-notification-bell"><button type="button" className="sf-bell-button" onClick={show} aria-label={count+' unread team booking alerts'} aria-expanded={open}><Bell size={21}/>{count>0&&<span className="sf-bell-count">{count}</span>}</button>
 {open&&<div className="sf-bell-popover"><div className="sf-bell-heading"><strong>Team booking alerts</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Close">×</button></div>{items.length?items.slice(0,8).map(i=><div key={i.id} className="sf-bell-item"><strong translate="no">{i.customerName}</strong><span>{i.date}</span></div>):<p className="sf-bell-empty">No pending bookings.</p>}<button type="button" className="sf-bell-review" onClick={()=>{setOpen(false);document.getElementById('team-review-inbox')?.scrollIntoView({behavior:'smooth'});}}>Review requests →</button></div>}</div>;
}
