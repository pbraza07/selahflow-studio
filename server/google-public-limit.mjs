import {tokenHash} from './security.mjs';
export async function googlePublicAllowed(db,req,slug){
 const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1).trim();
 const row=(await db.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '15 minutes' THEN now() ELSE public_limits.window_start END RETURNING count",['google-public:'+tokenHash(ip)+':'+slug])).rows[0];
 return !!row&&row.count<=120;
}
