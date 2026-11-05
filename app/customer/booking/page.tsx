'use client';
import {useEffect,useState} from 'react';
import PublicNavigation from '../../components/public-navigation';
import PublicFooter from '../../components/public-footer';
import BookingPayment from '../../components/booking-payment';
import CustomerBookingPush from '../../components/customer-booking-push';
import styles from '../../site.module.css';
import view from './booking-status.module.css';
export default function CustomerBookingStatus(){
 const [item,setItem]=useState<any>(null),[error,setError]=useState(''),[id,setId]=useState(''),[token,setToken]=useState(''),[ready,setReady]=useState(false),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false);
 useEffect(()=>{try{
  const requested=new URLSearchParams(window.location.search).get('id')||'',latest=localStorage.getItem('selahflow:latest-booking')||'',selected=requested||latest;
  setId(selected);setToken(JSON.parse(localStorage.getItem('selahflow:customer-bookings')||'{}')[selected]||'');
 }catch{}finally{setReady(true);}},[]);
 useEffect(()=>{if(!id)return;if(!token){setError('This device does not have access to that booking. Open the original confirmation page.');return;}
  let stopped=false;setLoading(true);setError('');
  fetch('/api/customer-booking',{headers:{Authorization:'Bearer '+token},cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);if(!stopped)setItem(data);}).catch(e=>{if(!stopped){setItem(null);setError(e.message);}}).finally(()=>{if(!stopped)setLoading(false);});
  return()=>{stopped=true;};
 },[id,token,revision]);
 useEffect(()=>{const resume=()=>{if(document.visibilityState==='visible')setRevision(v=>v+1);};window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);return()=>{window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};},[]);
 return <div className={styles.site}><PublicNavigation/><main id="main-content" className={view.main}><h1>Booking details and payment</h1>
  {error&&<p role="alert">{error}</p>}
  {ready&&!id?<section className={view.card}><h2>No booking selected</h2><p>Open the confirmation for your booking, or find the business and choose Booking &amp; membership status. You do not need a business account.</p><a href="/discover">Find a business</a></section>:!item&&!error&&<p role="status">Loading your booking…</p>}
  {error&&<p><a href="/discover">Find your business to check booking status</a></p>}
  {item&&<><section className={view.card}><h2>{item.business}</h2><span className={view.badge}>Status: {item.status}</span><dl className={view.details}><dt>Date</dt><dd>{item.date}</dd><dt>Time</dt><dd>{Math.floor(item.start/60)%12||12}:{String(item.start%60).padStart(2,'0')} {item.start<720?'AM':'PM'} Eastern</dd><dt>Services</dt><dd>{(item.services||[]).join(', ')}</dd></dl><p>{item.status==='Awaiting approval'?'This request is not confirmed until accepted. Payment becomes available after approval.':'This is the latest recorded booking status.'}</p><button type="button" className="outline" disabled={loading} onClick={()=>setRevision(v=>v+1)}>{loading?'Refreshing…':'Refresh status'}</button>
   {item.paymentAvailable&&token&&<div id="booking-payment" className={view.payment}><h3>Payment</h3><BookingPayment key={revision} slug={item.slug} id={id} token={token}/></div>}
  </section><CustomerBookingPush token={token} id={id} showStatusLink={false}/></>}
 </main><PublicFooter/></div>;
}
