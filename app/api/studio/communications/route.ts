import {communicationSetup,communicationBusiness,communicationContacts,communicationCampaigns,previewCommunication,queueCommunication,cancelCommunication} from '../../../../server/client-communications.mjs';
import {deliveryProviderStatusWithConnection} from '../../../../server/notification-delivery.mjs';
import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
function failure(e:unknown){const message=(e as Error).message,auth=message==='AUTH_REQUIRED';return Response.json({error:auth?'Sign in as the business owner.':message==='Business workspace unavailable.'?message:/Enter |Select |Choose |Staging |No rejected|platform administrator|changed|expired|cancelled|not found|HTTPS|secure|connect|URL|button|preview/i.test(message)?message:'Communications are temporarily unavailable.'},{status:auth?401:message==='Business workspace unavailable.'?403:/changed|expired|cancelled/i.test(message)?409:400,headers});}
export async function GET(req:Request){try{const owner=await requireOwner(req),pool=getPool(),b=await communicationBusiness(pool,owner),campaigns=await communicationCampaigns(pool,b.id);if(new URL(req.url).searchParams.get('history')==='1')return Response.json({campaigns,setup:communicationSetup()},{headers});return Response.json({...await communicationContacts(pool,b),campaigns,setup:communicationSetup(),provider:await deliveryProviderStatusWithConnection(pool),business:b.name},{headers});}catch(e){return failure(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{
 const owner=await requireOwner(req),pool=getPool();const raw=await req.text();if(raw.length>80000)return Response.json({error:'Message or recipient list is too large.'},{status:413,headers});const b=JSON.parse(raw);
 if(b.action==='preview')return Response.json(await previewCommunication(pool,{owner,input:b,origin:trustedOrigin(req)}),{headers});
 if(b.action==='send'||b.action==='retry'){if(!communicationSetup().workerEnabled)throw Error('The platform administrator must enable the background email worker before sending.');if(!(await deliveryProviderStatusWithConnection(pool)).emailConfigured)throw Error('Connect the business email delivery provider before sending.');return Response.json(await queueCommunication(pool,{owner,campaignId:b.campaignId,retry:b.action==='retry'}),{headers});}
 if(b.action==='cancel')return Response.json(await cancelCommunication(pool,{owner,campaignId:b.campaignId}),{headers});
 return Response.json({error:'Choose a communications action.'},{status:400,headers});
 }catch(e){return failure(e);}}
