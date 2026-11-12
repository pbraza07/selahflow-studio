import {randomBytes} from 'node:crypto';
import {requireOwner} from '../../../../lib/auth';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin,tokenHash,sessionToken,cookie} from '../../../../server/security.mjs';
import {kioskCookie,kioskMarker} from '../../../../server/kiosk.mjs';
export const dynamic='force-dynamic';export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
const fail=(e:unknown)=>Response.json({error:(e as Error).message==='AUTH_REQUIRED'?'Sign in as the business owner on this tablet first.':(e as Error).message},{status:(e as Error).message==='AUTH_REQUIRED'?401:400,headers});
export async function GET(req:Request){try{const owner=await requireOwner(req),pool=getPool(),b=(await pool.query("SELECT id,slug,auto_no_show_enabled FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!b)throw Error('Business unavailable.');const devices=(await pool.query('SELECT id,created_at,expires_at FROM kiosk_devices WHERE business_id=$1 AND revoked_at IS NULL AND expires_at>now()',[b.id])).rows;const review=(await pool.query("SELECT a.id,a.date,a.start FROM automatic_attendance r JOIN appointments a ON a.id=r.appointment_id WHERE r.owner=$1 AND r.status='review' AND a.status='Confirmed' ORDER BY a.date DESC,a.start DESC LIMIT 20",[owner])).rows;return Response.json({slug:b.slug,autoNoShow:b.auto_no_show_enabled,devices,review},{headers});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});const pool=getPool();let db;try{
 const owner=await requireOwner(req),raw=await req.text();if(raw.length>2000)throw Error('Request too large.');const input=JSON.parse(raw);db=await pool.connect();await db.query('BEGIN');
 const b=(await db.query("SELECT id,slug FROM businesses WHERE owner_id=$1 AND status='active' FOR UPDATE",[owner])).rows[0];if(!b)throw Error('Business unavailable.');const h=new Headers(headers);
 if(input.action==='pair'){
  if(input.slug!==b.slug||input.signOut!==true)throw Error('Confirm tablet mode and owner sign-out for this business.');
  const token=randomBytes(32).toString('hex');await db.query("INSERT INTO kiosk_devices(business_id,token_hash,expires_at) VALUES($1,$2,now()+interval '90 days')",[b.id,tokenHash(token)]);
  await db.query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(sessionToken(req)||'')]);
  h.append('Set-Cookie',cookie('',0));h.append('Set-Cookie',kioskCookie(b.slug,token));h.append('Set-Cookie',kioskMarker(b.slug));
 }else if(input.action==='autoNoShow'&&typeof input.enabled==='boolean')await db.query('UPDATE businesses SET auto_no_show_enabled=$1,auto_no_show_after=CASE WHEN NOT auto_no_show_enabled AND $1 THEN now() ELSE auto_no_show_after END WHERE id=$2',[input.enabled,b.id]);
 else if(input.action==='revoke')await db.query('UPDATE kiosk_devices SET revoked_at=now() WHERE business_id=$1',[b.id]);
 else throw Error('Choose a tablet setting.');
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES(gen_random_uuid()::text,$1,$2,'kiosk_settings',$3)",[owner,new Date().toISOString(),JSON.stringify({action:input.action,enabled:input.enabled})]);
 await db.query('COMMIT');return Response.json({ok:true,slug:b.slug},{headers:h});
 }catch(e){if(db)await db.query('ROLLBACK');return fail(e);}finally{db?.release();}}
