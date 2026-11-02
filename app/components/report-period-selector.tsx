'use client';
import {useState} from 'react';
import {financialPeriodBounds} from '../../server/financial-pipeline.mjs';
import styles from './owner-reports.module.css';
export type ReportDates={from:string;to:string};
export default function ReportPeriodSelector({range,onRange,date,custom,onCustom}:{range:string;onRange:(value:string)=>void;date:string;custom:ReportDates;onCustom:(value:ReportDates)=>void}){
 const [open,setOpen]=useState(false),[from,setFrom]=useState(custom.from),[to,setTo]=useState(custom.to),[error,setError]=useState('');
 const bounds=financialPeriodBounds(range,date,custom);
 const label=(day:string)=>new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 return <div className={styles.periodControls}><div className="tabs" aria-label="Financial report periods">{['Today','This week','This month','Past 6 months','Year to date','All time'].map(value=><button type="button" key={value} className={range===value?'active':''} aria-pressed={range===value} onClick={()=>{onRange(value);setOpen(false);}}>{value}</button>)}</div>
 <div className={styles.dateRange}><button type="button" className={range==='Custom date range'?'primary':'outline'} aria-expanded={open} aria-controls="financial-report-custom-dates" onClick={()=>{setFrom(custom.from);setTo(custom.to);setError('');setOpen(value=>!value);}}>Custom date range ▾</button>{open&&<div id="financial-report-custom-dates" className={styles.datePopover} role="group" aria-label="Choose custom report dates"><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Through<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<div className="button-row"><button type="button" className="primary" onClick={()=>{try{financialPeriodBounds('Custom date range',date,{from,to});onCustom({from,to});onRange('Custom date range');setOpen(false);}catch(e:any){setError(e.message);}}}>Apply date range</button><button type="button" className="outline" onClick={()=>setOpen(false)}>Cancel</button></div></div>}</div>
 <p className={styles.periodCaption} role="status">{bounds.from&&bounds.to?`${label(bounds.from)} – ${label(bounds.to)} · Eastern time`:'All available report dates · Eastern time'}{range==='This week'?' · Sunday–Saturday':''}{range!=='All time'&&range!=='Custom date range'?` · As of ${label(date)}`:''}</p></div>;
}
