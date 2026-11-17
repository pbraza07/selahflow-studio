'use client';
import {Children,cloneElement,isValidElement,useState} from 'react';
import MembershipModal from './membership-modal';
import type {ReactNode,TableHTMLAttributes,ReactElement} from 'react';
function text(node:any):string{if(node==null||typeof node==='boolean')return '';if(typeof node==='string'||typeof node==='number')return String(node);if(Array.isArray(node))return node.map(text).join(' ');if(isValidElement<any>(node)){const p=node.props;if(p['data-sort-value']!==undefined)return String(p['data-sort-value']);if(['button','details','input'].includes(String(node.type)))return '';return text(p.children)||String(p.memberNumber||p.membershipName||'');}return '';}
export function compareTableValues(a:string,b:string){const n=(s:string)=>/^[\s$€£%+\-,\d.]+$/.test(s)&&s.trim()?Number(s.replace(/[^\d.\-]/g,'')):NaN;const x=n(a),y=n(b);if(Number.isFinite(x)&&Number.isFinite(y))return x-y;return a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});}
export default function SortableTable({children,cards=false,...props}:TableHTMLAttributes<HTMLTableElement>&{cards?:boolean}){
 const [detailKey,setDetailKey]=useState<string|null>(null);
 const body=Children.toArray(children).find((n:any)=>n.type==='tbody') as ReactElement<any>|undefined;
 const detail=Children.toArray(body?.props.children).find((r:any)=>String(r.key)===detailKey) as ReactElement<any>|undefined;
 const head=Children.toArray(children).find((n:any)=>n.type==='thead') as ReactElement<any>|undefined;
 const labels=Children.toArray(head?.props.children).flatMap((r:any)=>Children.toArray(r.props?.children).map((c:any)=>text(c.props?.children)));
 const cardRow=(row:any)=>!isValidElement<any>(row)||Children.toArray(row.props.children).some((c:any)=>c.props?.colSpan)?row:cloneElement(row,{},Children.map(row.props.children,(cell,i)=>isValidElement<any>(cell)?cloneElement(cell,{'data-label':labels[i]}):cell),<td className="sf-record-view"><button type="button" className="outline" onClick={()=>setDetailKey(String(row.key))}>View details</button></td>);
 const [sort,setSort]=useState<{index:number;direction:1|-1}|null>(null);
 return <><div className={cards?"sf-table-scroll sf-record-cards":"sf-table-scroll"} role="region" aria-label={props['aria-label']||'Scrollable table'} tabIndex={0}><table {...props}>{Children.map(children,section=>{
 if(!isValidElement<any>(section))return section;
 if(section.type==='thead')return cloneElement(section,{},Children.map((section as ReactElement<any>).props.children,row=>isValidElement<any>(row)?cloneElement(row,{},Children.map(row.props.children,(cell,i)=>{
 if(!isValidElement<any>(cell))return cell;const label=text(cell.props.children);if(!label||/^(select|actions?)$/i.test(label))return cell;
 return cloneElement(cell,{'aria-sort':sort?.index===i?(sort.direction===1?'ascending':'descending'):'none'},<button type="button" className="sf-sort-heading" onClick={()=>setSort(old=>({index:i,direction:old?.index===i&&old.direction===1?-1:1}))}>{cell.props.children}<span aria-hidden="true">{sort?.index===i?(sort.direction===1?' ↑':' ↓'):' ↕'}</span></button>);
 })):row));
 if(section.type==='tbody'&&sort){const rows=Children.toArray((section as ReactElement<any>).props.children) as ReactElement<any>[];return cloneElement(section,{},rows.map((row,index)=>({row,index})).sort((a,b)=>{const value=(r:ReactElement<any>)=>{if(!isValidElement<any>(r))return '';return text(Children.toArray(r.props.children)[sort.index]);};return sort.direction*compareTableValues(value(a.row),value(b.row))||a.index-b.index;}).map(x=>cards?cardRow(x.row):x.row));}
 if(section.type==='tbody'&&cards)return cloneElement(section,{},Children.toArray((section as ReactElement<any>).props.children).map(cardRow));
 return section;
 })}</table></div>{detail&&<MembershipModal title="Item details" busy={false} onClose={()=>setDetailKey(null)}><dl className="sf-record-detail">{Children.toArray(detail.props.children).map((cell:any,i)=><div key={i}><dt>{labels[i]}</dt><dd>{cell.props?.children}</dd></div>)}</dl></MembershipModal>}</>;
}
