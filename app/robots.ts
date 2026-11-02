import type {MetadataRoute} from 'next';
import {isStaging} from '../server/staging-safety.mjs';
import {SEARCH_ORIGIN} from '../server/search-metadata.mjs';
export const dynamic='force-dynamic';
export default function robots():MetadataRoute.Robots{
 if(isStaging())return {rules:{userAgent:'*',disallow:'/'}};
 return {rules:{userAgent:'*',allow:['/','/api/marketplace','/api/branding/logo'],disallow:['/api/','/admin/','/studio/','/settings/','/account/','/team/workspace','/team/review/','/payment/','/membership-pay/','/booking/respond/','/customer/','/onsite/']},sitemap:SEARCH_ORIGIN+'/sitemap.xml'};
}
