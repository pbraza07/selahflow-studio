'use client';
import {useEffect,useMemo,useState} from 'react';
import type {CSSProperties} from 'react';
import {COLOR_ROLES,PALETTES,FONTS,resolveTheme,themeStyles,accessibleText,contrast} from '../../server/themes.mjs';
type Theme={palette:string;bodyFont:string;headingFont:string;colors:Record<string,string>};
type Profile={name:string;description:string;city:string;region:string;brand_primary:string;brand_background:string;theme?:Theme};
const GROUPS=[
 {title:'Page & sections',roles:['page','header','hero','surface','card','policy','footer']},
 {title:'Interactive elements',roles:['button','buttonHover','secondaryButton','selected','step','input']},
 {title:'Borders & accents',roles:['border','accent']}
];
const hex=/^#[0-9a-fA-F]{6}$/;
const bodyId='sf-theme-editor';
export default function OwnerThemeEditor(){
 const [profile,setProfile]=useState<Profile|null>(null);
 const [theme,setTheme]=useState<Theme>(()=>resolveTheme(null));
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const [expanded,setExpanded]=useState('Page & sections');
 const roleLabels=Object.fromEntries(COLOR_ROLES as [string,string][]);
 const css=useMemo(()=>themeStyles(theme) as CSSProperties,[theme]);
 async function load(){const r=await fetch('/api/business',{cache:'no-store'}),data=await r.json();if(!r.ok||!data.business)throw Error(data.error||'Unable to load theme.');const b=data.business as Profile;setProfile(b);setTheme(resolveTheme(b.theme,b.brand_primary,b.brand_background));}
 useEffect(()=>{load().catch(e=>setStatus((e as Error).message));},[]);
 function applyPalette(id:string){const p=PALETTES.find(p=>p.id===id);if(!p)return;setTheme(old=>({...old,palette:p.id,colors:{...p.colors}}));setStatus('Palette selected. Save to publish the changes.');}
 function setColor(role:string,value:string){if(!hex.test(value))return;setTheme(old=>({...old,palette:'custom',colors:{...old.colors,[role]:value.toUpperCase()}}));setStatus('Custom color selected. Save to publish.');}
 async function save(){if(!profile)return;setBusy(true);setStatus('');try{const r=await fetch('/api/business/theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme})}),d=await r.json();if(!r.ok)throw Error(d.error||'Save failed.');await load();window.dispatchEvent(new Event('selahflow:theme-updated'));setStatus('Saved! Your booking page, public business page and workspace now use this theme.');}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}
 return <section className="sf-editor" id={bodyId} aria-label="Business color and font editor">
 <div className="sf-editor-heading"><div><h2>Full-page themes &amp; fonts</h2><p>Choose one of 20 designer combinations or pick any color for each page area. Changes are unique to your business.</p></div><button type="button" className="primary" disabled={busy||!profile} onClick={save}>{busy?'Saving…':'Save & publish theme'}</button></div>
 {status&&<p className="notice" role="status" aria-live="polite">{status}</p>}
 <h3>1. Choose your palette</h3><p className="muted">Each combination includes coordinated backgrounds, buttons, cards, borders and readable text colors.</p>
 <div className="sf-palette-grid">{PALETTES.map(p=><button type="button" key={p.id} className={'sf-palette-option '+(theme.palette===p.id?'sf-palette-active':'')} aria-pressed={theme.palette===p.id} onClick={()=>applyPalette(p.id)}><span className="sf-palette-swatches">{[p.colors.header,p.colors.page,p.colors.card,p.colors.button,p.colors.accent].map((c,i)=><i key={i} style={{background:c}}/>)}</span><span>{p.name}</span></button>)}</div>
 <div className="sf-font-row"><div><h3>2. Choose your fonts</h3><p className="muted">Set separate typefaces for headings and body text.</p></div><label>Headings<select aria-label="Heading font" value={theme.headingFont} onChange={e=>setTheme(old=>({...old,headingFont:e.target.value}))}>{FONTS.map(f=><option key={f[0]} value={f[0]}>{f[1]}</option>)}</select></label><label>Body / buttons<select aria-label="Body font" value={theme.bodyFont} onChange={e=>setTheme(old=>({...old,bodyFont:e.target.value}))}>{FONTS.map(f=><option key={f[0]} value={f[0]}>{f[1]}</option>)}</select></label></div>
 <h3>3. Custom colors: page areas</h3><p className="muted">Click a swatch to choose any color, or enter its six-digit HEX value. Text colors are fixed to white on dark surfaces for reliable readability.</p>
 <div className="sf-theme-groups">{GROUPS.map(group=><section className="sf-theme-group" key={group.title}><button type="button" className="sf-group-toggle" aria-expanded={expanded===group.title} onClick={()=>setExpanded(expanded===group.title?'':group.title)}>{group.title}<span>{expanded===group.title?'−':'+'}</span></button>{expanded===group.title&&<div className="sf-color-grid">{group.roles.map(role=><div className="sf-color-control" key={role}><label htmlFor={'sf-color-'+role}>{roleLabels[role]}</label><div><input type="color" id={'sf-color-'+role} value={theme.colors[role]} aria-label={roleLabels[role]+' color picker'} onChange={e=>setColor(role,e.target.value)}/><input aria-label={roleLabels[role]+' hexadecimal color'} maxLength={7} key={theme.colors[role]+'-'+role} defaultValue={theme.colors[role]} onBlur={e=>{if(hex.test(e.target.value))setColor(role,e.target.value);else e.target.value=theme.colors[role];}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/></div></div>)}</div>}</section>)}</div>
 <h3>4. Live preview</h3><div className="sf-live-preview" style={css}><div className="sf-preview-header"><b>{profile?.name||'Your business'}</b><span>Book now</span></div><div className="sf-preview-content"><div className="sf-preview-hero"><small>WELCOME TO OUR STUDIO</small><h4>Find your next opening.</h4><p>Colors and typography automatically adapt to your selections.</p></div><div className="sf-preview-policy">Before your visit · Please arrive a few minutes early.</div><div className="sf-preview-panel"><div className="sf-preview-steps">① Service &nbsp; → &nbsp; ② Time &amp; team &nbsp; → &nbsp; ③ Confirm</div><div className="sf-preview-card"><strong>Signature service</strong><span>45 min · $40.00</span></div><div className="sf-preview-input">Your full name</div><div className="sf-preview-actions"><button type="button">Continue</button><span>Back to services</span></div></div></div><div className="sf-preview-footer">Powered by SelahFlow</div></div>
 <p className="muted sf-contrast-note">Text colors on headers, buttons, cards and form elements are automatically adjusted to meet readable contrast when necessary. Your original HEX selections are preserved.</p>
 <div className="sf-editor-bottom"><button type="button" className="primary" onClick={save} disabled={busy||!profile}>{busy?'Saving…':'Save & publish theme'}</button><a className="outline" href={profile?'/book/'+encodeURIComponent((profile as Profile & {slug?:string}).slug||''):'#'} target="_blank" rel="noreferrer">Preview live booking page</a></div>
 </section>;
}
