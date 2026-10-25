export const SOCIAL_PLATFORMS=[['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['youtube','YouTube'],['linkedin','LinkedIn'],['x','X'],['website','Website']];
const domains={instagram:['instagram.com'],facebook:['facebook.com','fb.com'],tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be'],linkedin:['linkedin.com'],x:['x.com','twitter.com']};
export function validateSocialLinks(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!SOCIAL_PLATFORMS.some(([id])=>id===k)))throw Error('Choose supported social platforms.');
 /** @type {Record<string,string>} */
 const links={};for(const [id,label]of SOCIAL_PLATFORMS){const raw=value[id];if(raw===undefined||raw==='')continue;if(typeof raw!=='string'||raw.length>500)throw Error('Use a valid '+label+' HTTPS link (up to 500 characters).');
 let url;try{url=new URL(raw.trim());}catch{throw Error('Enter the full HTTPS link for '+label+'.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||domains[id]&&!domains[id].some(d=>url.hostname===d||url.hostname.endsWith('.'+d)))throw Error('Enter a valid '+label+' HTTPS link.');links[id]=url.href;
 }return links;
}
/** @returns {Record<string,string>} */
export function publicSocialLinks(value){
 /** @type {Record<string,string>} */
 const result={};for(const [id]of SOCIAL_PLATFORMS){try{Object.assign(result,validateSocialLinks({[id]:value?.[id]}));}catch{}}return result;}
