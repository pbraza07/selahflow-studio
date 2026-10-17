'use client';
import {useEffect,useState} from 'react';
export default function NotificationProviderStatus(){
 const [state,setState]=useState<{emailConfigured:boolean;smsConfigured:boolean;accountEmail:string;emailProvider?:string}|null>(null);
 useEffect(()=>{fetch('/api/studio/approvals',{cache:'no-store'}).then(r=>r.json()).then(d=>setState({...d.providerStatus,accountEmail:d.accountEmail})).catch(()=>{});},[]);
 if(!state)return <p className="muted"><small>Checking delivery-provider configuration…</small></p>;
 return <div className="sf-delivery-provider-status" role="status">
  <div>Email ({state.emailProvider||'Email service'}): <b>{state.emailConfigured?'Configured':'Not configured'}</b>. Account email: {state.accountEmail||'Not available'}</div>
  <div>SMS (Twilio): <b>{state.smsConfigured?'Configured':'Not configured'}</b>.</div>
  {(!state.emailConfigured||!state.smsConfigured)&&<p>Checked channels only send messages once their provider credentials are set up on Render. In-app booking review continues to work without them. See release documentation for configuration.</p>}
 </div>;
}
