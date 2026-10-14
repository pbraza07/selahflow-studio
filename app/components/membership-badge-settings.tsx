'use client';
import {useId} from 'react';
import MembershipBadge,{type MembershipBadgeDesign} from './membership-badge';
import {MEMBERSHIP_BADGE_ICONS} from '../../server/membership-badges.mjs';
export default function MembershipBadgeSettings({value,onChange,name,inherited=null,disabled=false,type=false}:{value:MembershipBadgeDesign|null;onChange:(value:MembershipBadgeDesign|null)=>void;name:string;inherited?:MembershipBadgeDesign|null;disabled?:boolean;type?:boolean}){
 const id=useId();
 const edit=(field:string,next:string)=>{if(value)onChange({...value,[field]:next});};
 return <fieldset className="sf-membership-badge-settings" disabled={disabled}><legend>{type?'Membership type badge':'Plan badge'}</legend>
  <label className="sf-membership-badge-toggle"><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked?{label:name.trim().slice(0,60),color:'#123F3A',icon:'badge',shape:'pill'}:null)}/>{type?'Customize this type’s badge':'Use a custom badge for this plan'}</label>
  {!value&&<p>{type?'Uses the automatic badge based on each plan’s name.':'Inherits the membership type badge, or the automatic badge when no type badge is set.'}</p>}
  {value&&<div className="sf-membership-badge-fields"><label htmlFor={id+'-label'}>Badge label<input id={id+'-label'} maxLength={60} value={value.label} placeholder={name||'Use membership name'} onChange={e=>edit('label',e.target.value)}/></label><label htmlFor={id+'-color'}>Badge background<input id={id+'-color'} type="color" value={value.color} onChange={e=>edit('color',e.target.value)}/></label><label htmlFor={id+'-icon'}>Badge icon<select id={id+'-icon'} value={value.icon} onChange={e=>edit('icon',e.target.value)}>{MEMBERSHIP_BADGE_ICONS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label htmlFor={id+'-shape'}>Badge shape<select id={id+'-shape'} value={value.shape} onChange={e=>edit('shape',e.target.value)}><option value="pill">Pill</option><option value="rounded">Rounded box</option></select></label></div>}
  <div className="sf-membership-badge-preview"><small>Active member preview</small><MembershipBadge memberNumber="AB0101" membershipName={name||'Membership'} membershipStatus="active" sessionsIncluded={1} sessionsUsed={0} badge={value||inherited}/></div>
  <p>Text contrast is automatic. Members with no sessions remaining keep their neutral ID badge.</p>
 </fieldset>;
}
