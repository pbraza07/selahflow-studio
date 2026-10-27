import {getPool} from '../../../server/database.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 try{
  const url=new URL(req.url),q=(url.searchParams.get('q')||'').trim().slice(0,80);
  const industry=(url.searchParams.get('industry')||'').trim().slice(0,32);
  const city=(url.searchParams.get('city')||'').trim().slice(0,80);
  const pool=getPool();
  const result=await pool.query(
    "SELECT b.slug,b.name,b.industry,b.description,b.city,b.region,l.updated_at AS logo_version,st.data AS studio_data FROM businesses b LEFT JOIN business_logos l ON l.business_id=b.id LEFT JOIN settings st ON st.owner=b.owner_id WHERE b.status='active' AND ($1='' OR b.name ILIKE '%'||$1||'%' OR b.description ILIKE '%'||$1||'%') AND ($2='' OR b.industry=$2) AND ($3='' OR b.city ILIKE '%'||$3||'%') ORDER BY b.updated_at DESC LIMIT 500",
    [q.replace(/[%_]/g,'\\$&'),industry,city.replace(/[%_]/g,'\\$&')]
  );
  return Response.json({businesses:result.rows.map((row:{studio_data:string|null;[key:string]:unknown})=>{const {studio_data,logo_version,...business}=row;let address='';try{address=String(JSON.parse(studio_data||'{}').address||'');}catch{}return {...business,hasLogo:Boolean(logo_version),logoVersion:logo_version?new Date(String(logo_version)).toISOString():null,address:address&&!address.startsWith('Add your')?address:''};})},{headers:{'Cache-Control':'public, max-age=15'}});
 }catch(e){console.error('Marketplace unavailable',e);return Response.json({error:'Marketplace is temporarily unavailable.'},{status:503});}
}
