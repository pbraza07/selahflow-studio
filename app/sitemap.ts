import type {MetadataRoute} from 'next';
import {getPool} from '../server/database.mjs';
import {isStaging} from '../server/staging-safety.mjs';
import {SEARCH_ORIGIN,SEARCH_PAGES,validPublicSlug} from '../server/search-metadata.mjs';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 if(isStaging())return [];
 // Match the marketplace's existing publication rule; inactive/pending businesses remain excluded.
 const rows=(await getPool().query("SELECT slug FROM businesses WHERE status='active' ORDER BY slug")).rows;
 const businessPages = rows.filter((row:{slug:string}) => validPublicSlug(row.slug))
   .flatMap((row:{slug:string}) => {
     const slug = encodeURIComponent(row.slug);
     return [{url: SEARCH_ORIGIN+'/'+slug}, {url: SEARCH_ORIGIN+'/book/'+slug}];
   });
 return [...SEARCH_PAGES.map(([path])=>({url:SEARCH_ORIGIN+path})), ...businessPages];
}
