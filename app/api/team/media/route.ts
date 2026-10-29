import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {getPool} from '../../../../server/database.mjs';
import {validOrigin} from '../../../../server/security.mjs';
import {teamIdentity,assertClientAppointment,publicTeam,portalError} from '../../../../server/team-portal.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=(e:any)=>Response.json({error:e.status?e.message:'Image unavailable. Choose a JPG, PNG or WebP image.'},{status:e.status||400,headers});
export async function GET(req:Request){try{const pool=getPool(),id=new URL(req.url).searchParams.get('id');const m=(await pool.query('SELECT * FROM team_media WHERE id=$1',[id])).rows[0];if(!m)throw portalError('Image not found.',404);
 if(m.kind==='portrait'){try{await publicTeam(pool,m.account_id);}catch{const a=await teamIdentity(pool,req);if(a.id!==m.account_id)throw portalError('Image not found.',404);}}
 else {const a=await teamIdentity(pool,req);if(a.id!==m.account_id)throw portalError('Image not found.',404);await assertClientAppointment(pool,a,m.appointment_id);}
 return new Response(new Uint8Array(m.bytes),{headers:{...headers,'Content-Type':'image/webp'}});}catch(e){return fail(e);}}
export async function POST(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const pool=getPool(),a=await teamIdentity(pool,req);if(Number(req.headers.get('content-length'))>6*1024*1024)throw portalError('Choose an image smaller than 5 MB.',413);
 const form=await req.formData(),file=form.get('image'),kind=String(form.get('kind')),appointmentId=kind==='portrait'?null:String(form.get('appointmentId'));
 if(!['portrait','client','service'].includes(kind)||!(file instanceof File)||file.size>5*1024*1024||file.size<32||!['image/jpeg','image/png','image/webp'].includes(file.type))throw portalError('Choose a JPG, PNG or WebP image smaller than 5 MB.');
 if(appointmentId)await assertClientAppointment(pool,a,appointmentId);
 const source=Buffer.from(await file.arrayBuffer());const image=sharp(source,{limitInputPixels:25000000});const meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format||''))throw portalError('Choose a JPG, PNG or WebP image.');const bytes=await image.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
 const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT id FROM team_accounts WHERE id=$1 FOR UPDATE',[a.id]);const count=(await db.query('SELECT COUNT(*)::int AS count FROM team_media WHERE account_id=$1',[a.id])).rows[0].count;if(kind!=='portrait'&&count>=200)throw portalError('Your workspace allows 200 photos. Remove an older photo first.');if(kind==='portrait')await db.query("DELETE FROM team_media WHERE account_id=$1 AND kind='portrait'",[a.id]);const id=randomUUID();await db.query('INSERT INTO team_media(id,account_id,appointment_id,kind,bytes) VALUES($1,$2,$3,$4,$5)',[id,a.id,appointmentId,kind,bytes]);await db.query('COMMIT');return Response.json({ok:true,id},{headers});}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }catch(e){return fail(e);}}
export async function DELETE(req:Request){if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});try{const pool=getPool(),a=await teamIdentity(pool,req),id=new URL(req.url).searchParams.get('id');await pool.query('DELETE FROM team_media WHERE id=$1 AND account_id=$2',[id,a.id]);return Response.json({ok:true},{headers});}catch(e){return fail(e);}}
