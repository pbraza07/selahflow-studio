import {randomBytes,randomUUID} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {hashPassword,tokenHash,validOrigin,cookie} from '../../../../server/security.mjs';
import {defaultSettings} from '../../../../lib/defaults';
import {onboardingPreset} from '../../../../server/onboarding-presets.mjs';
import {validNewPassword} from '../../../../server/platform-roles.mjs';
import {BUSINESS_INDUSTRIES,canonicalState} from '../../../../lib/business-options';
import {isReservedBusinessSlug,dashboardPath,businessPath,bookingPath} from '../../../../server/route-slugs.mjs';
export const runtime='nodejs';
const industries=new Set<string>([...BUSINESS_INDUSTRIES.map(([id])=>id),'custom']);
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403});
 try{
  const body=await req.text();
  if(body.length>6000)return Response.json({error:'Request too large.'},{status:413});
  const b=JSON.parse(body);
  if(b.website)return Response.json({error:'Unable to register.'},{status:400});
  const email=String(b.email||'').trim().toLowerCase();
  const name=String(b.businessName||'').trim();
  const slug=String(b.slug||'').trim().toLowerCase();
  const industry=String(b.industry||'other');
  const city=String(b.city||'').trim(),region=canonicalState(String(b.region||''));
  const password=b.password;
  if(isReservedBusinessSlug(slug))return Response.json({error:'This booking URL is reserved for the original business.'},{status:409});
  if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254||
    !validNewPassword(password)||
    name.length<2||name.length>100||city.length>80||(b.region&&!region)||!industries.has(industry)||
    !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug))
    return Response.json({error:'Enter a valid business name, URL slug, email and password (6+ characters).'},{status:400});
  const pool=getPool();
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',').at(-1)!.trim();
  const limit=await pool.query("INSERT INTO public_limits(key,count,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_limits.window_start<now()-interval '1 hour' THEN 1 ELSE public_limits.count+1 END,window_start=CASE WHEN public_limits.window_start<now()-interval '1 hour' THEN now() ELSE public_limits.window_start END RETURNING count",['signup:'+tokenHash(ip)]);
  if(limit.rows[0].count>10)return Response.json({error:'Registration limit reached. Please try later.'},{status:429});
  const userId=randomUUID(),businessId=randomUUID(),session=randomBytes(32).toString('hex');
  const preset=onboardingPreset(industry);
  const config={...structuredClone(defaultSettings),name,tagline:industry,...preset,phone:'',address:'',greeting:'Welcome! How can we help?',timezone:'America/New_York'};
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[userId,email,hashPassword(password)]);
   await client.query("INSERT INTO businesses(id,owner_id,slug,name,industry,city,region,status,is_listed,listing_requested) VALUES($1,$2,$3,$4,$5,$6,$7,'pending',FALSE,FALSE)",[businessId,userId,slug,name,industry,city,region]);
   await client.query('UPDATE businesses SET brand_primary=$1,brand_background=$2 WHERE id=$3',[preset.brandPrimary,preset.brandBackground,businessId]);
   await client.query("INSERT INTO business_memberships(business_id,user_id,role) VALUES($1,$2,'owner')",[businessId,userId]);
   await client.query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES($1,'free','active')",[businessId]);
   await client.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[userId,JSON.stringify(config)]);
   await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[tokenHash(session),userId]);
   await client.query('COMMIT');
  }catch(error){
   await client.query('ROLLBACK');
   if((error as {code?:string}).code==='23505')return Response.json({error:'This email or booking URL is already registered.'},{status:409});
   throw error;
  }finally{client.release();}
  return Response.json({ok:true,slug,status:'pending',bookingUrl:bookingPath(slug),dashboardUrl:'/registration-status',businessUrl:businessPath(slug)},{status:201,headers:{'Set-Cookie':cookie(session),'Cache-Control':'no-store'}});
 }catch(error){console.error('Business registration failed',error);return Response.json({error:'Registration is temporarily unavailable.'},{status:503});}
}
