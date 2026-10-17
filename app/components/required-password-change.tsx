'use client';
import {useState} from 'react';
import {CheckCircle2,LockKeyhole,ShieldCheck} from 'lucide-react';
export default function RequiredPasswordChange(){
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[complete,setComplete]=useState(false);
 async function change(e:React.FormEvent){
  e.preventDefault();setError('');
  if(next.length<6||next!==confirm||current===next){setError('Choose a different password with at least 6 characters, and confirm it matches.');return;}
  setBusy(true);
  try{
   const r=await fetch('/api/account/password',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({currentPassword:current,newPassword:next}),cache:'no-store'});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Unable to change password.');
   setCurrent('');setNext('');setConfirm('');setComplete(true);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <main className="sf-password-reset-page"><section className="sf-password-reset-card">
  <div className="sf-reset-symbol"><LockKeyhole size={28}/></div>
  <span>ACCOUNT SECURITY · SELAHFLOW</span>
  <h1>{complete?'Your password has been updated':'Create your own secure password'}</h1>
  {complete?<><p><CheckCircle2 size={18}/> Your temporary password has been replaced. You may now return to your workspace.</p>
    <a className="primary" href="/business">Continue to SelahFlow</a></>:
   <><p>The platform administrator issued you a temporary sign-in password. Before accessing your business records, set a new private password that only you know.</p>
    <form onSubmit={change}>
     <label>Temporary password<input type="password" required minLength={6} autoComplete="current-password" maxLength={256} value={current} onChange={e=>setCurrent(e.target.value)}/></label>
     <label>Your new password<input type="password" required minLength={6} autoComplete="new-password" maxLength={128} value={next} onChange={e=>setNext(e.target.value)}/></label>
     <label>Confirm new password<input type="password" required minLength={6} autoComplete="new-password" maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
     {error&&<p className="sf-password-reset-error" role="alert">{error}</p>}
     <button className="primary" disabled={busy} type="submit"><ShieldCheck size={17}/>{busy?'Saving your password…':'Set my private password'}</button>
    </form><small>Existing passwords are never visible to administrators. All previously active sessions were signed out for your security.</small></>}
 </section></main>;
}
