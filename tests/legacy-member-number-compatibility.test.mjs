import {replaceLegacyMemberId} from '../server/replace-legacy-member-id.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {issueMemberId} from '../server/member-id-policy.mjs';

test('legacy IDs are upgraded without losing history and blocked on all new and returning registrations',async()=>{
 const pg=new PGlite();
 const read=f=>readFile(new URL('../migrations/'+f,import.meta.url),'utf8');
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')&&f<'040').sort())await pg.exec(await read(f));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name) VALUES('b1','u1','one','One'),('b2','u2','two','Two'); ALTER TABLE business_client_profiles DROP CONSTRAINT business_client_profiles_member_number_six;");
  await pg.exec("INSERT INTO business_client_profiles(id,owner,name,email,member_number,date_of_birth) VALUES('old','u1','Legacy Client','old@example.com','LC010200','2000-01-02'); ALTER TABLE business_client_profiles ADD CONSTRAINT business_client_profiles_member_number_six CHECK(member_number IS NULL OR member_number ~ '^[A-Z]{2}[0-9]{4}$') NOT VALID;");
  // This is the exact constraint error from staging's booking confirmation.
  await assert.rejects(pg.exec("UPDATE business_client_profiles SET archived=FALSE WHERE id='old'"),/business_client_profiles_member_number_six/);
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')&&f>='040').sort())await pg.exec(await read(f));
  await assert.rejects(pg.exec("UPDATE business_client_profiles SET archived=FALSE WHERE id='old'"),/member_number_six/);
  const client={query:async(s,p)=>{const r=await pg.query(s,p);return {...r,rowCount:r.rows.length||r.affectedRows||0};},release(){}};
  await pg.exec('BEGIN');
  await replaceLegacyMemberId(client,{owner:'u1',businessId:'b1',client:{name:'Legacy Client',dateOfBirth:'2000-01-02',memberNumber:'LC010200'}});
  await pg.exec('COMMIT');
  assert.equal((await pg.query("SELECT member_number FROM business_client_profiles WHERE id='old'")).rows[0].member_number,'LC0102');
  assert.equal(await issueMemberId(pg,{businessId:'b1',name:'Legacy Client',dateOfBirth:'2000-01-02'}),'LC0102');
  await assert.rejects(issueMemberId(pg,{businessId:'b1',name:'Legacy Client',dateOfBirth:'2000-01-02',requested:'LC010200'}),/Legacy IDs/);
  await assert.rejects(pg.exec("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('b1','Legacy','Client','old@example.com','2000-01-02','LC010200')"),/exactly two/);
  const fresh=await issueMemberId(pg,{businessId:'b1',name:'Fresh Client',dateOfBirth:'2000-01-02'});
  assert.match(fresh,/^[A-Z]{2}[0-9]{4}$/);
  assert.equal((await pg.query('SELECT count(*) AS n FROM legacy_business_member_numbers')).rows[0].n,0);
 }finally{await pg.close();}
});
