import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveTheme,accessibleText} from './themes.mjs';
export const EMAIL_LOGO_CID='selahflow-logo';
let logo;
export function emailLogo(){return logo??=readFileSync(join(process.cwd(),'public/brand/email-logo.png'));}
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function emailInlineLogo(message){
 if(message.emailBrand)return message.emailBrand.logo?{bytes:message.emailBrand.logo,cid:'business-logo',filename:'business-logo.png'}:null;
 return {bytes:emailLogo(),cid:EMAIL_LOGO_CID,filename:'selahflow-logo.png'};
}
function content(text,color){
 return String(text??'').split(/(https:\/\/[^\s<>"']+)/g).map((part,index)=>index%2?`<a href="${escape(part)}" style="color:${color};text-decoration:underline;overflow-wrap:anywhere;word-break:break-word">${escape(part)}</a>`:escape(part).replace(/\r?\n/g,'<br>')).join('');
}
export function brandedEmailHtml(message,{logoSrc}={}){
 const brand=message.emailBrand,name=brand?.name||'SelahFlow';
 const defaults=resolveTheme(null).colors,colors=brand?.colors||defaults;
 // Defense in depth: only strict hex colors may enter inline email styles.
 const c=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,/^#[a-f0-9]{6}$/i.test(colors[key]||'')?colors[key]:value]));
 const headerBackground=brand?c.header:c.page;
 const ink=accessibleText(c.surface),headerInk=accessibleText(headerBackground),footerInk=accessibleText(c.footer),linkInk=accessibleText(c.surface,c.button);
 const inline=emailInlineLogo(message),src=logoSrc||inline&&'cid:'+inline.cid;
 const identity=inline?`<img src="${escape(src)}" alt="${escape(name)}" width="300" style="display:block;width:auto;max-width:100%;max-height:150px;height:auto;border:0">`:`<strong style="font-size:26px;color:${headerInk}">${escape(name)}</strong>`;
 const actions=(Array.isArray(message.actions)?message.actions:[]).filter(a=>{try{return new URL(a.url).protocol==='https:';}catch{return false;}}).slice(0,4);
 let prose=String(message.text||'');
 for(const a of actions)prose=prose.split('\n').filter(line=>!line.includes(a.url)).join('\n');
 const buttons=actions.map((a,i)=>{const bg=i===0?c.button:c.secondaryButton;return `<tr><td style="padding:6px 0"><a href="${escape(a.url)}" style="display:block;border:1px solid ${c.border};border-radius:12px;background:${bg};color:${accessibleText(bg)};padding:16px 18px;text-align:center;text-decoration:none;font-size:16px;font-weight:bold;line-height:1.4">${escape(a.label)}</a></td></tr>`;}).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:${c.page};color:${ink};font-family:Arial,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;background:${c.surface};border:1px solid ${c.border};border-radius:16px"><tr><td style="padding:28px 24px;border-bottom:3px solid ${c.accent};background:${headerBackground};color:${headerInk}">${identity}${inline&&brand?`<p style="margin:14px 0 0;font-size:18px;font-weight:bold;color:${headerInk}">${escape(name)}</p>`:''}</td></tr><tr><td style="padding:28px 24px"><h1 style="font-size:22px;line-height:1.4;margin:0 0 24px;color:${ink}">${escape(message.subject||'Your '+name+' update')}</h1><div style="font-size:16px;line-height:1.75;color:${ink};overflow-wrap:anywhere;word-break:break-word">${content(prose,linkInk)}</div>${buttons?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">${buttons}</table>`:''}</td></tr><tr><td style="padding:20px 24px;background:${c.footer};font-size:12px;line-height:1.6;color:${footerInk}">${brand?`Sent for <strong>${escape(name)}</strong> via SelahFlow.<br>For service or booking questions, contact ${escape(name)} directly.`:'Powered by <strong>SelahFlow</strong><br>Your bookings flow. You breathe.<br>For service or booking questions, contact your business directly.'}</td></tr></table></td></tr></table></body></html>`;
}
export function resendBrand(message){const inline=emailInlineLogo(message);return {html:brandedEmailHtml(message),attachments:inline?[{filename:inline.filename,content:inline.bytes.toString('base64'),content_id:inline.cid}]:[]};}
