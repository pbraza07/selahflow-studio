'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {BellRing,Check,X} from 'lucide-react';
import DevicePushControls from './device-push-controls';
import styles from './owner-device-notifications.module.css';

export default function OwnerDeviceNotifications(){
 const [open,setOpen]=useState(false),[enabled,setEnabled]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{
  if(!open)return;
  const node=dialog.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  if(!node)return;
  node.showModal();document.body.style.overflow='hidden';
  return()=>{node.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[open]);
 return <div className={styles.wrapper}>
  <button type="button" className={'outline small '+styles.trigger} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>
   {enabled?<Check size={16} aria-hidden="true"/>:<BellRing size={16} aria-hidden="true"/>}
   <span>{enabled?'Notifications on':'Enable notifications'}</span>
  </button>
  <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();setOpen(false);}}>
   <div className={styles.heading}><h2 id={titleId}>Notifications on this device</h2><button type="button" className={'outline '+styles.close} onClick={()=>setOpen(false)} aria-label="Close device notifications"><X size={20}/></button></div>
   <p className={styles.intro}>Stay up to date with new session requests and completed payments.</p>
   <DevicePushControls onEnabledChange={setEnabled}/>
   <p className={styles.note}>Alerts apply to this business. Allow notifications in your browser when prompted. Device and Focus settings can affect delivery.</p>
  </dialog>
 </div>;
}
