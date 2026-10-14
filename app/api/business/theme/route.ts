import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {themeIsValid,resolveTheme} from '../../../../server/themes.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403});
 try{
  const owner=await requireOwner(req);
  const raw=await req.text();
  if(raw.length>12000)return Response.json({error:'Theme selection is too large.'},{status:413});
  const input=JSON.parse(raw);
  if(!themeIsValid(input?.theme))return Response.json({error:'Choose valid theme colors and fonts.'},{status:400});
  const theme=resolveTheme(input.theme);
  const pool=getPool(),client=await pool.connect();
  try{
   await client.query('BEGIN');
   const b=(await client.query('SELECT id,status FROM businesses WHERE owner_id=$1 FOR UPDATE',[owner])).rows[0];
   if(!b){await client.query('ROLLBACK');return Response.json({error:'Business not found.'},{status:404});}
   if(b.status!=='active'){await client.query('ROLLBACK');return Response.json({error:'Business awaiting platform approval.'},{status:403});}
   const row=(await client.query('SELECT data FROM settings WHERE owner=$1 FOR UPDATE',[owner])).rows[0];
   if(!row){await client.query('ROLLBACK');return Response.json({error:'Business settings are not available.'},{status:409});}
   const settings=JSON.parse(row.data||'{}');
   settings.theme=theme;
   await client.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(settings),owner]);
   await client.query('UPDATE businesses SET brand_primary=$1,brand_background=$2,updated_at=now() WHERE id=$3',[theme.colors.button,theme.colors.page,b.id]);
   await client.query('COMMIT');
   return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }catch(e){console.error('Theme update failed:',e);return Response.json({error:(e as Error).message==='AUTH_REQUIRED'?'Please sign in again.':'Unable to save your theme. Please retry.'},{status:(e as Error).message==='AUTH_REQUIRED'?401:503});}
}
