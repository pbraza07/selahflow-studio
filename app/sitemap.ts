import type {MetadataRoute} from 'next';
import {getPool} from '../server/database.mjs';
import {isStaging} from '../server/staging-safety.mjs';
import {SEARCH_ORIGIN,SEARCH_PAGES,validPublicSlug} from '../server/search-metadata.mjs';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 if(isStaging())return [];
 // Match the marketplace's existing publication rule; inactive/pending businesses remain excluded.
 const rows=(await getPool().query("SELECT slug FROM businesses WHERE status='active' ORDER BY slug")).rows;
 return [...SEARCH_PAGES.map(([path])=>({url:SEARCH_ORIGIN+path})),...rows.filter((r:{slug:string})=>validPublicSlug(r.slug)&&!SEARCH_PAGES.some(([path])=>path==='/'+r.slug)).map((r:{slug:string})=>({url:SEARCH_ORIGIN+'/'+encodeURIComponent(r.slug)}))];
}
