'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';

export default function SessionEditorDialog({open,sessionNumber,busy,onClose,onSave,children}:{open:boolean;sessionNumber:number;busy:boolean;onClose:()=>void;onSave:()=>Promise<boolean>;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),saving=useRef(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!open)return;
  setError('');
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';dialog.current?.showModal();
  return()=>{document.body.style.overflow=overflow;previous?.focus({preventScroll:true});};
 },[open]);
 if(!open)return <>{children}</>;
 const save=async()=>{
   if(saving.current||busy)return;
   saving.current=true;setError('');
   try{if(!await onSave())setError('The session could not be saved. Review your settings and try again. Your draft is still here.');}
   catch(e){setError((e instanceof Error?e.message:'The session could not be saved.')+' Your draft is still here.');}
   finally{saving.current=false;}
  };
 const close=()=>{if(!busy&&!saving.current)onClose();};
 return <dialog ref={dialog} className="sf-new-session-dialog" aria-labelledby="sf-new-session-title" onCancel={e=>{e.preventDefault();close();}} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&(e.target as HTMLElement).tagName==='INPUT'){e.preventDefault();void save();}}}>
  <header className="sf-new-session-header"><div><h2 id="sf-new-session-title">New session {sessionNumber}</h2><p>Set up this session here. It is a draft until you save business settings.</p></div><button type="button" className="outline" disabled={busy} onClick={close} aria-label="Close session editor">Close</button></header>
  {children}
  {error&&<p role="alert" className="error">{error}</p>}
  <footer className="sf-new-session-actions"><p>Saving applies all pending business settings changes.</p><div className="button-row"><button type="button" className="outline" disabled={busy} onClick={close}>Keep draft & close</button><button type="button" className="primary" disabled={busy} onClick={save}>{busy?'Saving…':'Save business settings'}</button></div></footer>
 </dialog>;
}
