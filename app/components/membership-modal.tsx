'use client';
import {useEffect,useId,useRef} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
export default function MembershipModal({title,busy,onClose,children}:{title:string;busy:boolean;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null;dialog.showModal();return ()=>{dialog.close();if(previous?.isConnected)previous.focus();};},[]);
 return <dialog ref={ref} className="sf-membership-modal" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <header><h2 id={titleId}>{title}</h2><button type="button" className="outline" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20}/></button></header>
  <div className="sf-membership-modal-body">{children}</div>
 </dialog>;
}
