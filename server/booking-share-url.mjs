export function bookingShareUrl(slug,origin){
 if(!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug||''))throw Error('Business booking link unavailable.');
 const base=new URL(origin);if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw Error('Invalid booking origin.');return new URL('/book/'+slug,base.origin).href;
}
