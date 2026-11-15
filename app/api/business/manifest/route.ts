import {getPool} from '../../../../server/database.mjs';
import {resolveTheme} from '../../../../server/themes.mjs';
import {businessManifest} from '../../../../server/business-device-name.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const slug=new URL(req.url).searchParams.get('slug')||'';
 if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(slug))
  return Response.json({error:'Unknown business.'},{status:404,headers:{'Cache-Control':'no-store'}});
 try{
  const row=(await getPool().query(
   "SELECT b.slug,b.name,b.brand_primary,b.brand_background,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active'",
   [slug])).rows[0];
  if(!row)return Response.json({error:'Unknown business.'},{status:404,headers:{'Cache-Control':'no-store'}});
  let raw:{theme?:unknown}={};try{raw=JSON.parse(row.data||'{}')}catch{}
  const theme=resolveTheme(raw.theme,row.brand_primary,row.brand_background);
  return new Response(JSON.stringify(businessManifest(row.slug,row.name,theme,new URL(req.url).searchParams.get('audience')==='public'?'public':'owner')),{
   headers:{'Content-Type':'application/manifest+json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
  });
 }catch{
  return Response.json({error:'Manifest unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
