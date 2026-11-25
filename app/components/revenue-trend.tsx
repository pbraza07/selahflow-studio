'use client';

import {useId,useMemo,useState} from 'react';
import {revenueTrend,trendWindows} from '../../server/revenue-trend.mjs';
import styles from './revenue-trend.module.css';

type Interval=keyof typeof trendWindows;
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const axisMoney=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
function label(day:string, interval:Interval) {
 return new Intl.DateTimeFormat('en-US',{month:'short',...(interval==='Monthly'?{year:'numeric'}:{day:'numeric'}),timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'));
}

export default function RevenueTrend({payments,through}:{payments:Record<string,any>[];through:string}) {
 const [interval,setInterval]=useState<Interval>('Monthly');
 const [selected,setSelected]=useState<number|null>(null);
 const id=useId();
 const rows=useMemo(()=>revenueTrend(payments,through,interval),[payments,through,interval]);
 const last=rows.length-1, index=selected??last, current=rows[index];
 const peak=Math.max(100,...rows.map(r=>r.cents));
 const points=rows.map((r,i)=>({x:1000*i/last,y:112-100*r.cents/peak}));
 const line=points.reduce((path,p,i)=>{
  if(!i)return 'M0 '+p.y;
  const prev=points[i-1],mid=(prev.x+p.x)/2;
  return path+' C'+mid+' '+prev.y+' '+mid+' '+p.y+' '+p.x+' '+p.y;
 },'');
 const total=rows.reduce((sum,r)=>sum+r.cents,0);
 const periodName=(interval==='Weekly'?'Week of ':'')+label(current.day,interval);
 return <section className={styles.card} aria-label="Paid revenue trend">
  <header><div><h2>Paid revenue trend</h2><strong>{money.format(total/100)}</strong>
   <p>Last {rows.length} {interval==='Daily'?'days':interval==='Weekly'?'weeks':'months'} through {through} · Eastern time</p></div>
   <div role="group" aria-label="Revenue interval" className={styles.switcher}>{(Object.keys(trendWindows) as Interval[]).map(value=><button key={value} type="button" aria-pressed={interval===value} onClick={()=>{setInterval(value);setSelected(null);}}>{value}</button>)}</div></header>
  <div className={styles.readout}><span>{periodName}</span><b>{money.format(current.cents/100)}</b><span>{current.payments} {current.payments===1?'payment':'payments'}</span></div>
  <div className={styles.chart}><div aria-hidden="true" className={styles.axis}><span>{axisMoney.format(peak/100)}</span><span>{axisMoney.format(peak/200)}</span><span>$0</span></div>
   <div className={styles.plot} onPointerMove={e=>{if(e.pointerType==='mouse'){const rect=e.currentTarget.getBoundingClientRect();setSelected(Math.max(0,Math.min(last,Math.round(last*(e.clientX-rect.left)/rect.width))));}}}>
   <svg viewBox="0 0 1000 124" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#46e6c5" stopOpacity=".38"/><stop offset="1" stopColor="#46e6c5" stopOpacity=".02"/></linearGradient></defs>
   {[12,62,112].map(y=><path key={y} d={'M0 '+y+' H1000'} stroke="#456369" strokeDasharray="3 6" vectorEffect="non-scaling-stroke"/>)}
   <path d={line+' L1000 112 H0 Z'} fill={'url(#'+id+')'}/><path d={line} fill="none" stroke="#69f2d4" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
   <path d={'M'+points[index].x+' 0 V112'} stroke="#d2fff4" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/></svg>
   <input type="range" min="0" max={last} value={index} onChange={e=>setSelected(Number(e.target.value))} aria-label="Inspect revenue period" aria-valuetext={periodName+', '+money.format(current.cents/100)} />
   </div></div>
  <footer><span>{label(rows[0].day,interval)}</span><span>{label(rows[Math.floor(last/2)].day,interval)}</span><span>{label(rows[last].day,interval)}</span></footer>
 </section>;
}
