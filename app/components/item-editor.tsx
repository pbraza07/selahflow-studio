'use client';
import {useState,type ReactNode} from 'react';
import MembershipModal from './membership-modal';
export default function ItemEditor({title,summary,children,initialOpen=false,draft=false,busy=false,onSave,buttonLabel='View / edit'}:{title:string;summary?:ReactNode;children:ReactNode;initialOpen?:boolean;draft?:boolean;busy?:boolean;onSave?:()=>Promise<boolean>;buttonLabel?:string}){
 const [open,setOpen]=useState(initialOpen),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const locked=busy||saving;
 async function save(){if(locked||!onSave)return;setSaving(true);setError('');try{if(await onSave())setOpen(false);else setError('Unable to save. Your draft is still here.');}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
 return <article className="sf-item-card"><header><h3>{title}</h3><button type="button" className="outline" disabled={busy} onClick={()=>{setOpen(true);setError('');}}>{buttonLabel}</button></header>{summary&&<div className="sf-item-summary">{summary}</div>}{open&&<MembershipModal title={title} busy={locked} onClose={()=>setOpen(false)}>{draft&&<p className="notice">Changes remain in your business settings draft until saved. Closing this window keeps your draft.</p>}<fieldset className="sf-item-fields" disabled={locked} onKeyDown={e=>{if(draft&&e.key==='Enter'&&!e.nativeEvent.isComposing&&(e.target as HTMLElement).tagName==='INPUT'){e.preventDefault();if(onSave)void save();}}}>{children}</fieldset>{error&&<p role="alert" className="error">{error}</p>}{draft&&<footer className="sf-item-actions"><button type="button" className="outline" disabled={locked} onClick={()=>setOpen(false)}>Keep draft & close</button>{onSave&&<button type="button" className="primary" disabled={locked} onClick={()=>void save()}>{locked?'Saving…':'Save business settings'}</button>}</footer>}</MembershipModal>}</article>;
}
export function ItemFormDialog({title,children,busy=false}:{title:string;children:ReactNode;busy?:boolean}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="outline" disabled={busy} onClick={()=>setOpen(true)}>{title}</button>{open&&<MembershipModal title={title} busy={busy} onClose={()=>setOpen(false)}>{children}</MembershipModal>}</>;
}
