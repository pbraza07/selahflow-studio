import {getPool} from '../../../../../server/database.mjs';
import {requireOwner} from '../../../../../lib/auth';
import {completeGoogleBusiness,ownedGoogleBusiness} from '../../../../../server/google-business-connection.mjs';
import {trustedOrigin,sessionToken} from '../../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 let result='error',slug='';
 try{const owner=await requireOwner(req),b=await ownedGoogleBusiness(getPool(),owner);slug=b.slug;const q=new URL(req.url).searchParams;if(q.has('error'))throw Error();
 await completeGoogleBusiness(getPool(),{owner,session:sessionToken(req),state:q.get('state'),code:q.get('code')});result='connected';}catch{}
 return new Response(null,{status:303,headers:{Location:trustedOrigin(req)+(slug?'/studio/'+encodeURIComponent(slug):'/login')+'?googleBusiness='+result+'#google-business','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
