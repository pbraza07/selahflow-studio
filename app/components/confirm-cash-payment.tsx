'use client';
import {useState} from 'react';
export default function ConfirmCashPayment({id,kind,name,amount,team=false,onChanged}:{id:string;kind:'booking'|'membership';name:string;amount:number;team?:boolean;onChanged:()=>void|Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 async function save(){if(!confirm('Confirm '+new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount)+' cash was received from '+name+' for this '+kind+'? Eligible first-purchase commissions will enter the business cash commission balance.'))return;
 setBusy(true);setError('');try{const r=await fetch(team?'/api/team/cash-payment':'/api/studio/onsite-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(team?{id,kind,confirmed:true}:{action:kind==='membership'?'cashMembership':'cash',...(kind==='membership'?{membershipId:id}:{bookingId:id}),confirmed:true})}),d=await r.json();if(!r.ok)throw Error(d.error||'Cash payment could not be recorded.');setSaved(true);try{await onChanged();}catch{setError('Cash is recorded. Reload to refresh the list; do not record it again.');}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <span style={{display:'inline-block'}}>{saved?<span role="status">Cash payment recorded</span>:<button type="button" className="outline" disabled={busy} onClick={()=>void save()}>{busy?'Recording cash…':'Pay cash · Confirm received'}</button>}{error&&<span role="alert" style={{display:'block'}}>{error}</span>}</span>;
}
