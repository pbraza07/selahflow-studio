'use client';
import type {CSSProperties,ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {themeStyles} from '../../server/themes.mjs';
import TeamAppointmentBell from './team-appointment-bell';
export default function TeamPageShell({branding,children,profileId}:{branding?:any;children:ReactNode;profileId?:string}){
 const workspace=usePathname()==='/team/workspace';
 return <div className="sf-team-branded" data-business-slug={branding?.slug} data-team-profile-id={profileId} data-selah-theme style={themeStyles(branding?.theme) as CSSProperties}>{branding&&<header className="sf-team-business-header"><a href={'/'+branding.slug}><span className="sf-business-logo-surface"><img src={'/api/branding/logo?slug='+encodeURIComponent(branding.slug)} alt={branding.name} onError={e=>{e.currentTarget.style.display='none';}}/></span><strong>{branding.name}</strong></a>{workspace&&<TeamAppointmentBell onOpen={()=>document.querySelector<HTMLElement>('.sf-team-tabs')?.scrollIntoView({behavior:'smooth'})}/>}</header>}<main className="sf-team-shell">{children}</main></div>;
}
