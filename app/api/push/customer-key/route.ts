import {configured} from '../../../../../server/push-crypto.mjs';
export const runtime='nodejs';
export async function GET(){return Response.json({publicKey:configured()?process.env.VAPID_PUBLIC_KEY:null},{headers:{'Cache-Control':'no-store'}});}
