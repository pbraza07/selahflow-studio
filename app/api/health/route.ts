import {APP_VERSION} from '../../../lib/app-version';
import {getPool} from '../../../server/database.mjs';
export const dynamic='force-dynamic';
export async function GET(){try{await getPool().query('SELECT 1');return Response.json({status:'ok',version:APP_VERSION});}catch{return Response.json({status:'unavailable'},{status:503});}}
