'use client';
import SocialPlatformIcon from './social-platform-icon';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import {SOCIAL_PLATFORMS} from '../../server/business-social-links.mjs';
const OwnerGoogleBusiness=dynamic(()=>import('./owner-google-business'));
const OwnerBrandProfile=dynamic(()=>import('./owner-brand-profile'));
const OwnerThemeEditor=dynamic(()=>import('./owner-theme-editor'));
const VisualPageEditor=dynamic(()=>import('./visual-page-editor'));
const PageEditorSettings=dynamic(()=>import('./page-editor-settings'));
const BookingPageSharing=dynamic(()=>import('./booking-page-sharing'));
const sections=[['identity','Brand appearance'],['pages','Page content'],['google','Photos & Google'],['sharing','Links & sharing']] as const;
export default function OwnerBranding({slug,config,setConfig,onSave,onProfileSaved,busy,dirty}:{slug:string;config:any;setConfig:any;onSave:()=>void;onProfileSaved:(profile:any)=>void;busy:boolean;dirty:boolean}){
 const [section,setSection]=useState<(typeof sections)[number][0]>('identity');
 const [visited,setVisited]=useState<string[]>(['identity']);
 useEffect(()=>{if(new URLSearchParams(window.location.search).has('googleBusiness')){setSection('google');setVisited(old=>[...new Set([...old,'google'])]);}},[]);
 function openSection(id:(typeof sections)[number][0]){setSection(id);setVisited(old=>old.includes(id)?old:[...old,id]);}
 return <section className="sf-branding-workspace" aria-label="Branding and public pages"><div className="panel padded"><h2>Your brand, pages &amp; sharing</h2><p>Manage your business identity, page design and links in one place. Questions stay in Business settings → Questions; plans and prices stay in their business tools.</p><nav className="sf-branding-tabs" aria-label="Branding sections">{sections.map(([id,label])=><button key={id} type="button" className={section===id?'primary':'outline'} aria-current={section===id?'page':undefined} onClick={()=>openSection(id)}>{label}</button>)}</nav>{dirty&&<p role="status">You have unpublished page changes. <button type="button" className="primary" disabled={busy} onClick={onSave}>Save page changes</button></p>}</div>
 <div hidden={section!=='identity'}>{visited.includes('identity')&&<><OwnerBrandProfile slug={slug} onSaved={onProfileSaved}/><OwnerThemeEditor/></>}</div>
 <div hidden={section!=='google'}>{visited.includes('google')&&<OwnerGoogleBusiness/>}</div>
 <div hidden={section!=='pages'}>{visited.includes('pages')&&<><VisualPageEditor config={config} setConfig={setConfig} slug={slug} onSave={onSave} onExit={()=>setSection('identity')} busy={busy} dirty={dirty}/><details className="panel padded"><summary>All page wording &amp; booking display options</summary><PageEditorSettings config={config} setConfig={setConfig}/><button type="button" className="primary" disabled={busy||!dirty} onClick={onSave}>Save page changes</button></details></>}</div>
 <div hidden={section!=='sharing'}>{visited.includes('sharing')&&<><section className="panel padded"><h2>Social media links</h2><p>Add complete HTTPS profile links. Leave a field empty to hide it from clients.</p>{SOCIAL_PLATFORMS.map(([id,label])=><label key={id}><span className="sf-social-input-label">{config.socialLinks?.[id]&&<SocialPlatformIcon platform={id}/>} {label}</span><input type="url" maxLength={500} value={config.socialLinks?.[id]||''} placeholder={id==='website'?'https://your-business.com':'https://'+(id==='x'?'x.com':id+'.com')+'/your-profile'} onChange={e=>setConfig((c:any)=>({...c,socialLinks:{...(c.socialLinks||{}),[id]:e.target.value}}))}/></label>)}<button type="button" className="primary" disabled={busy||!dirty} onClick={onSave}>{busy?'Saving…':'Save links'}</button></section><BookingPageSharing slug={slug} name={config.name}/></>}</div>
 </section>;
}
