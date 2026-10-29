'use client';
import type {CSSProperties,ReactNode} from 'react';
import {themeStyles} from '../../server/themes.mjs';
export default function TeamPageShell({branding,children}:{branding?:any;children:ReactNode}){return <div className="sf-team-branded" data-selah-theme style={themeStyles(branding?.theme) as CSSProperties}>{branding&&<header className="sf-team-business-header"><a href={'/'+branding.slug}><span className="sf-business-logo-surface"><img src={'/api/branding/logo?slug='+encodeURIComponent(branding.slug)} alt={branding.name} onError={e=>{e.currentTarget.style.display='none';}}/></span><strong>{branding.name}</strong></a></header>}<main className="sf-team-shell">{children}</main></div>;}
