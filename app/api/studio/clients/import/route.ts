import {randomUUID} from 'node:crypto';
import {getPool} from '../../../../../server/database.mjs';
import {requireOwner} from '../../../../../lib/auth';
import {validOrigin} from '../../../../../server/security.mjs';
import {readClientSpreadsheet} from '../../../../../server/client-import.mjs';
import {validateClientInput,sameClientContact} from '../../../../../server/client-profile-logic.mjs';
export const runtime='nodejs';
const key=(s:unknown)=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function get(row:Record<string,string>,aliases:string[]){const entry=Object.entries(row).find(([header])=>aliases.includes(key(header)));return entry?String(entry[1]||'').trim():'';}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403});
 let client;
 try{
  const owner=await requireOwner(req);
  const form=await req.formData(),file=form.get('file');
  if(!(file instanceof File)||file.size>5_000_000||file.size<1)throw Error('Choose an Excel or CSV file under 5 MB.');
  const {headers,records}=readClientSpreadsheet(Buffer.from(await file.arrayBuffer()),file.name);
  if(!records.length)throw Error('No client records found.');
  const mapped=records.map((row,index)=>{
   const first=get(row,['firstname','givenname']),last=get(row,['lastname','surname','familyname']);
   const name=get(row,['name','fullname','clientname','customername','client','customer'])||[first,last].filter(Boolean).join(' ');
   const email=get(row,['email','emailaddress','clientemail','customeremail']);
   const phone=get(row,['phone','phonenumber','mobile','mobilephone','telephone','cell','cellphone']);
   const notes=get(row,['notes','note','comments','internalnotes']);
   try{return {...validateClientInput({name,email,phone,notes}),columns:row};}
   catch(e){throw Error('Row '+(index+2)+': '+(e as Error).message);}
  });
  client=await getPool().connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':clients']);
  const business=await client.query("SELECT status FROM businesses WHERE owner_id=$1",[owner]);
  if(business.rows[0]?.status!=='active')throw Error('Business workspace unavailable.');
  const existing=(await client.query('SELECT id,name,email,phone FROM business_client_profiles WHERE owner=$1',[owner])).rows;
  let created=0,updated=0;
  for(const row of mapped){
   const match=existing.find((p:{id:string;name:string;email:string;phone:string})=>sameClientContact(p,row));
   if(match){
    await client.query('UPDATE business_client_profiles SET commission_existing_client=true,import_columns=COALESCE(import_columns,\'{}\'::jsonb)||$1::jsonb,updated_at=now() WHERE owner=$2 AND id=$3',[JSON.stringify(row.columns),owner,match.id]);updated++;
   }else{
    const id=randomUUID();
    await client.query('INSERT INTO business_client_profiles(id,owner,name,email,phone,notes,import_columns,commission_existing_client) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,true)',[id,owner,row.name,row.email,row.phone,row.notes,JSON.stringify(row.columns)]);
    existing.push({id,...row});created++;
   }
  }
  await client.query('COMMIT');
  return Response.json({ok:true,created,updated,columns:headers},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});return Response.json({error:(e as Error).message||'Import failed.'},{status:400});}
 finally{client?.release();}
}
