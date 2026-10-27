'use client';
import {BadgeCheck, Crown, GraduationCap, Hash, Medal, ShieldCheck, Star, Gem, Heart, Trophy, Users} from 'lucide-react';
import type {CSSProperties} from 'react';
import {hasUsableMembership,membershipDisplayStatus} from '../../server/member-badge-state.mjs';
import {resolveMembershipBadge} from '../../server/membership-badges.mjs';
import {accessibleText} from '../../server/themes.mjs';
export type MembershipBadgeDesign={label:string;color:string;icon:string;shape:'pill'|'rounded'};
const icons:Record<string,typeof BadgeCheck>={badge:BadgeCheck,crown:Crown,graduation:GraduationCap,medal:Medal,shield:ShieldCheck,star:Star,gem:Gem,heart:Heart,trophy:Trophy,users:Users};

type MembershipBadgeProps={
 memberNumber?:string|null;
 membershipName?:string|null;
 membershipStatus?:string|null;
 sessionsIncluded?:number|null;
 sessionsUsed?:number|null;
 badge?:MembershipBadgeDesign|null;
};

/**
 * Classification stays visible independently of payment/credit eligibility.
 * Saved plan/type designs take precedence over the automatic tier colors.
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

export default function MembershipBadge({memberNumber,membershipName,membershipStatus,sessionsIncluded,sessionsUsed,badge}:MembershipBadgeProps){
 const id=String(memberNumber||'').trim().toUpperCase();
 const active=hasUsableMembership({status:membershipStatus,sessionsIncluded,sessionsUsed});
 const level=String(membershipName||'').trim();
 const state=membershipDisplayStatus({status:membershipStatus,sessionsIncluded,sessionsUsed});
 const statusLabel=active?'':(({pending_payment:'Payment pending',pending:'Pending',exhausted:'Sessions exhausted',expired:'Expired',canceled:'Canceled',cancelled:'Canceled',past_due:'Payment overdue'} as Record<string,string>)[state]||String(membershipStatus||'').replaceAll('_',' ')||'Inactive');
 if(!id&&!level)return null;
 const design=level?resolveMembershipBadge(badge):null;
 const theme=level?(design?{background:design.color,Icon:icons[design.icon]}:membershipBadgeTheme(level)):{background:'#f1f2f4',Icon:Hash};
 const label=level?(design?.label||level):'';
 const Icon=theme.Icon;
 const style:CSSProperties={
  display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,
  background:theme.background,color:accessibleText(theme.background,'#171717'),border:'1.5px solid #171717',
  borderRadius:999,...(design?.shape==='rounded'?{borderRadius:8}:{}),padding:'4px 10px',fontSize:12,fontWeight:750,lineHeight:1.25,
  width:'fit-content',maxWidth:'100%',verticalAlign:'middle',
  whiteSpace:'normal',overflowWrap:'anywhere',
 };
 return <span className="sf-membership-level-badge" style={style} aria-label={level?level+' membership'+(id?' ID '+id:'')+(statusLabel?' · '+statusLabel:''):'Membership ID '+id}>
  <Icon aria-hidden="true" size={14} strokeWidth={2.5} style={{flexShrink:0}}/>
  <span>{level?label+(id?' · '+id:''):'ID '+id}{level&&statusLabel&&<small style={{fontSize:'inherit',fontWeight:600}}> · {statusLabel}</small>}</span>
 </span>;
}
