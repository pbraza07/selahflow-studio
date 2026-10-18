import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export const EMAIL_LOGO_CID='selahflow-logo';
let logo;
export function emailLogo(){return logo??=readFileSync(join(process.cwd(),'public/brand/email-logo.png'));}
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function content(text){
 // Only HTTPS URLs become links. Escape both prose and attributes, including client data.
 return String(text??'').split(/(https:\/\/[^\s<>"']+)/g).map((part,index)=>index%2?`<a href="${escape(part)}" style="color:#123f3a;text-decoration:underline;overflow-wrap:anywhere;word-break:break-word">${escape(part)}</a>`:escape(part).replace(/\r?\n/g,'<br>')).join('');
}
export function brandedEmailHtml(message,{logoSrc='cid:'+EMAIL_LOGO_CID}={}){
 const actions=(Array.isArray(message.actions)?message.actions:[]).filter(a=>{try{return new URL(a.url).protocol==='https:';}catch{return false;}}).slice(0,4);
 let prose=String(message.text||'');
 for(const a of actions)prose=prose.split('\n').filter(line=>!line.includes(a.url)).join('\n');
 const buttons=actions.map((a,i)=>`<tr><td style="padding:6px 0"><a href="${escape(a.url)}" style="display:block;border:1px solid #a9beb2;border-radius:12px;background:${i===0?'#123f3a':'#eef3ed'};color:${i===0?'#ffffff':'#123f3a'};padding:16px 18px;text-align:center;text-decoration:none;font-size:16px;font-weight:bold;line-height:1.4">${escape(a.label)}</a></td></tr>`).join('');

 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f7f4ec;color:#123f3a;font-family:Arial,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #ccd5cd;border-radius:16px"><tr><td style="padding:28px 24px;border-bottom:3px solid #c6a66a;background:#f7f4ec"><img src="${escape(logoSrc)}" alt="SelahFlow — Your bookings flow. You breathe." width="300" style="display:block;width:100%;max-width:300px;height:auto;border:0"></td></tr><tr><td style="padding:28px 24px"><h1 style="font-size:22px;line-height:1.4;margin:0 0 24px;color:#123f3a">${escape(message.subject||'Your SelahFlow update')}</h1><div style="font-size:16px;line-height:1.75;color:#314e43;overflow-wrap:anywhere;word-break:break-word">${content(prose)}</div>${buttons?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">${buttons}</table>`:''}</td></tr><tr><td style="padding:20px 24px;background:#e6ede6;font-size:12px;line-height:1.6;color:#425a4b">Powered by <strong>SelahFlow</strong><br>Your bookings flow. You breathe.<br>For service or booking questions, contact your business directly.</td></tr></table></td></tr></table></body></html>`;
}
export function resendBrand(message){return {html:brandedEmailHtml(message),attachments:[{filename:'selahflow-logo.png',content:emailLogo().toString('base64'),content_id:EMAIL_LOGO_CID}]};}
