'use client';
import {useEffect,useState} from 'react';
import styles from '../platform-pages.module.css';
type Status={setupComplete:boolean;connected:boolean;sender:string;needsReconnect:boolean;provider:string;redirectUri:string;missingConfiguration:string[]};
export default function PlatformGmailSettings(){
 const [state,setState]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmDisconnect,setConfirmDisconnect]=useState(false);
 async function refresh(){try{const r=await fetch('/api/platform/gmail',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setState(d);}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void refresh();if(new URLSearchParams(location.search).get('gmail')==='error')setError('Google authorization was not completed. Check the OAuth setup and reconnect.');},[]);
 async function action(action:string){setBusy(true);setError('');try{const r=await fetch('/api/platform/gmail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}),d=await r.json();if(!r.ok)throw Error(d.error);if(d.authorizationUrl&&new URL(d.authorizationUrl).origin==='https://accounts.google.com')location.assign(d.authorizationUrl);else{setConfirmDisconnect(false);await refresh();}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section id="platform-gmail" className={styles.card} aria-label="Shared Gmail sender"><h2>Shared Gmail sender</h2><p>Connect one Gmail or Google Workspace account to send booking approval links, payment requests and confirmations for all businesses. Each message identifies its business and uses only that business’s saved recipient.</p>
 {error&&<p role="alert" className={styles.alert}>{error}</p>}
 {state&&!state.setupComplete&&<p>Missing server configuration: {state.missingConfiguration.join(', ')}. Keep any encryption key that is already configured.</p>}
 {state&&<><p>Selected email service: <strong>{state.provider}</strong> · {state.connected?'Connected':state.needsReconnect?'Reconnect required':'Not connected'}</p>{state.sender&&<p>Sending account: {state.sender}</p>}
 {!state.setupComplete&&<><p>Google application setup is required before connecting. No Gmail password is entered into SelahFlow.</p><ol><li>In Google Cloud, enable the Gmail API and configure the OAuth consent screen.</li><li>Create a Web application OAuth client with this exact authorized redirect URI:<br/><code style={{overflowWrap:'anywhere'}}>{state.redirectUri}</code></li><li>Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_TOKEN_ENCRYPTION_KEY to this service’s protected server configuration. Set EMAIL_PROVIDER=gmail.</li><li>Return here and choose Connect Gmail. For a Google app in Testing, add the sending account as a test user.</li></ol></>}
 <button className={styles.button} disabled={busy||!state.setupComplete} onClick={()=>action('connect')}>{busy?'Please wait…':state.connected||state.needsReconnect?'Reconnect Gmail':'Connect Gmail'}</button> <button className={styles.secondary} disabled={busy} onClick={refresh}>Refresh connection status</button>
 {state.sender&&<button className={styles.secondary} disabled={busy} onClick={()=>setConfirmDisconnect(true)}>Disconnect Gmail</button>}
 {confirmDisconnect&&<div role="alert"><p>Disconnect the shared sender for every business in this environment? Queued emails will wait for a new connection.</p><button className={styles.button} disabled={busy} onClick={()=>action('disconnect')}>Confirm disconnect</button> <button className={styles.secondary} onClick={()=>setConfirmDisconnect(false)}>Keep connected</button></div>}
 <p><small>Google authorization requests permission to send email and identify the sending account. It does not request inbox-reading access. Google Testing authorizations with Gmail access can expire after seven days. Staging recipient restrictions remain in effect.</small></p></>}
 </section>;
}
