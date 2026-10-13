'use client';
import {BadgeCheck, Crown, GraduationCap, Hash, Medal, ShieldCheck, Star, Gem} from 'lucide-react';
import type {CSSProperties} from 'react';
import {hasUsableMembership} from '../../server/member-badge-state.mjs';

type MembershipBadgeProps={
 memberNumber?:string|null;
 membershipName?:string|null;
 membershipStatus?:string|null;
 sessionsIncluded?:number|null;
 sessionsUsed?:number|null;
};

/**
 * Package colors are derived from the membership's actual tier name, never
 * from player identity. Unknown custom tier names receive a stable color.
 */
export function membershipBadgeTheme(name:string){
 const level=name.trim().toLowerCase();
 if(/gold/.test(level))return {background:'#ffc83d',Icon:Crown};
 if(/platinum|diamond/.test(level))return {background:'#b8dbe9',Icon:Gem};
 if(/silver/.test(level))return {background:'#cbd5e1',Icon:Medal};
 if(/bronze/.test(level))return {background:'#d9a16b',Icon:Medal};
 if(/pro|elite|premium|vip/.test(level))return {background:'#ef4335',Icon:Star};
 if(/academy|student|youth/.test(level))return {background:'#44aff5',Icon:GraduationCap};
 if(/basic|starter|standard|entry/.test(level))return {background:'#9dd49f',Icon:ShieldCheck};
 const palette=['#63c7b5','#f0bc83','#a8b8ed','#deb4df','#93caef'];
 let hash=0;
 for(const ch of level)hash=(hash*31+ch.charCodeAt(0))>>>0;
 return {background:palette[hash%palette.length],Icon:BadgeCheck};
}

export default function MembershipBadge({memberNumber,membershipName,membershipStatus,sessionsIncluded,sessionsUsed}:MembershipBadgeProps){
 const id=String(memberNumber||'').trim().toUpperCase();
 const active=hasUsableMembership({status:membershipStatus,sessionsIncluded,sessionsUsed});
 const level=active?String(membershipName||'').trim():'';
 if(!id&&!level)return null;
 const theme=level?membershipBadgeTheme(level):{background:'#f1f2f4',Icon:Hash};
 const Icon=theme.Icon;
 const style:CSSProperties={
  display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,
  background:theme.background,color:'#171717',border:'1.5px solid #171717',
  borderRadius:999,padding:'4px 10px',fontSize:12,fontWeight:750,lineHeight:1.25,
  width:'fit-content',maxWidth:'100%',verticalAlign:'middle',
  whiteSpace:'normal',overflowWrap:'anywhere',
 };
 return <span className="sf-membership-level-badge" style={style} aria-label={level?level+' membership'+(id?' ID '+id:''):'Membership ID '+id}>
  <Icon aria-hidden="true" size={14} strokeWidth={2.5} style={{flexShrink:0}}/>
  <span>{level?level+(id?' · '+id:''):'ID '+id}</span>
 </span>;
}
