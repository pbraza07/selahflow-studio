'use client';
import {useEffect,useState} from 'react';
export default function CustomerBookingStatus(){
 const [item,setItem]=useState<any>(null),[error,setError]=useState(''),[id,setId]=useState('');
 useEffect(()=>{try{const requested=new URLSearchParams(window.location.search).get('id')||'';const latest=localStorage.getItem('selahflow:latest-booking')||'';setId(requested||latest);}catch{}},[]);
 useEffect(()=>{if(!id)return;let token='';try{token=JSON.parse(localStorage.getItem('selahflow:customer-bookings')||'{}')[id]||'';}catch{}
 if(!token){setError('This device does not have access to that booking. Open the original confirmation page.');return;}
 fetch('/api/customer-booking',{headers:{Authorization:'Bearer '+token},cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);setItem(data);}).catch(e=>setError(e.message));},[id]);
 return <main style={{maxWidth:640,margin:'40px auto',padding:24}}><h1>Booking details and status</h1>{error&&<p role="alert">{error}</p>}{!item&&!error&&<p>Loading your booking…</p>}{item&&<section><h2>{item.business}</h2><h3>Status: {item.status}</h3><p>Date: {item.date}</p><p>Time: {Math.floor(item.start/60)%12||12}:{String(item.start%60).padStart(2,'0')} {item.start<720?'AM':'PM'} Eastern</p><p>Services: {item.services.join(', ')}</p><p>{item.status==='Awaiting approval'?'This request is not confirmed until accepted.':'This is the latest recorded booking status.'}</p><button type="button" onClick={()=>window.location.reload()}>Refresh status</button></section>}</main>;
}
