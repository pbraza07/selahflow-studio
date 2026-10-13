'use client';
import {Children,cloneElement,isValidElement,useState} from 'react';
import type {ReactNode,TableHTMLAttributes,ReactElement} from 'react';
function text(node:any):string{if(node==null||typeof node==='boolean')return '';if(typeof node==='string'||typeof node==='number')return String(node);if(Array.isArray(node))return node.map(text).join(' ');if(isValidElement<any>(node)){const p=node.props;if(p['data-sort-value']!==undefined)return String(p['data-sort-value']);if(['button','details','input'].includes(String(node.type)))return '';return text(p.children)||String(p.memberNumber||p.membershipName||'');}return '';}
export function compareTableValues(a:string,b:string){const n=(s:string)=>/^[\s$€£%+\-,\d.]+$/.test(s)&&s.trim()?Number(s.replace(/[^\d.\-]/g,'')):NaN;const x=n(a),y=n(b);if(Number.isFinite(x)&&Number.isFinite(y))return x-y;return a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});}
export default function SortableTable({children,...props}:TableHTMLAttributes<HTMLTableElement>){
 const [sort,setSort]=useState<{index:number;direction:1|-1}|null>(null);
 return <table {...props}>{Children.map(children,section=>{
 if(!isValidElement<any>(section))return section;
 if(section.type==='thead')return cloneElement(section,{},Children.map((section as ReactElement<any>).props.children,row=>isValidElement<any>(row)?cloneElement(row,{},Children.map(row.props.children,(cell,i)=>{
 if(!isValidElement<any>(cell))return cell;const label=text(cell.props.children);if(!label||/^(select|actions?)$/i.test(label))return cell;
 return cloneElement(cell,{'aria-sort':sort?.index===i?(sort.direction===1?'ascending':'descending'):'none'},<button type="button" className="sf-sort-heading" onClick={()=>setSort(old=>({index:i,direction:old?.index===i&&old.direction===1?-1:1}))}>{cell.props.children}<span aria-hidden="true">{sort?.index===i?(sort.direction===1?' ↑':' ↓'):' ↕'}</span></button>);
 })):row));
 if(section.type==='tbody'&&sort){const rows=Children.toArray((section as ReactElement<any>).props.children) as ReactElement<any>[];return cloneElement(section,{},rows.map((row,index)=>({row,index})).sort((a,b)=>{const value=(r:ReactElement<any>)=>{if(!isValidElement<any>(r))return '';return text(Children.toArray(r.props.children)[sort.index]);};return sort.direction*compareTableValues(value(a.row),value(b.row))||a.index-b.index;}).map(x=>x.row));}
 return section;
 })}</table>;
}
