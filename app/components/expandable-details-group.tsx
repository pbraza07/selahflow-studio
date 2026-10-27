'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
/** Native details stay keyboard accessible; bulk controls affect this view only. */
export default function ExpandableDetailsGroup({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),[allOpen,setAllOpen]=useState(false);
 const sync=()=>{const nodes=Array.from(root.current?.querySelectorAll('details')||[]);setAllOpen(nodes.length>0&&nodes.every(node=>node.open));};
 useEffect(()=>{const node=root.current;node?.addEventListener('toggle',sync,true);sync();return()=>node?.removeEventListener('toggle',sync,true);},[children]);
 function toggle(){const next=!allOpen;root.current?.querySelectorAll('details').forEach(node=>{node.open=next;});setAllOpen(next);}
 return <div ref={root}><div style={{display:'flex',justifyContent:'flex-end',margin:'12px 0'}}><button type="button" className="outline" onClick={toggle} aria-label={allOpen?'Collapse all booking details':'Expand all booking details'}><span aria-hidden="true">{allOpen?'▴':'▾'}</span> {allOpen?'Collapse all':'Expand all'}</button></div>{children}</div>;
}
