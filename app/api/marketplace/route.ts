import {getPool} from '../../../server/database.mjs';
import {discoveryBusiness,matchesDiscovery,marketplaceIndustries} from '../../../server/discovery-search.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 try{
  const url=new URL(req.url),filters={q:(url.searchParams.get('q')||'').trim().slice(0,80),industry:(url.searchParams.get('industry')||'').trim().slice(0,32),city:(url.searchParams.get('city')||'').trim().slice(0,80)};
  const result=await getPool().query("SELECT b.slug,b.name,b.industry,b.description,b.city,b.region,l.updated_at AS logo_version,st.data AS studio_data,d.address AS google_address,d.city AS google_city,d.region AS google_region FROM businesses b LEFT JOIN business_logos l ON l.business_id=b.id LEFT JOIN settings st ON st.owner=b.owner_id LEFT JOIN business_google_profiles g ON g.business_id=b.id LEFT JOIN business_discovery_locations d ON d.business_id=b.id AND d.place_id=g.place_id AND d.fetched_at>now()-interval '30 days' WHERE b.status='active' ORDER BY b.updated_at DESC");
  const businesses=result.rows.map(discoveryBusiness).filter((b:any)=>matchesDiscovery(b,filters)).slice(0,500).map((b:any)=>{const {_cities,...publicBusiness}=b;return publicBusiness;});
  return Response.json({businesses,industries:marketplaceIndustries(result.rows)},{headers:{'Cache-Control':'public, max-age=15'}});
 }catch(e){console.error('Marketplace unavailable',e);return Response.json({error:'Marketplace is temporarily unavailable.'},{status:503});}
}
