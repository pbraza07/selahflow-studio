import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {issueMemberId} from '../server/member-id-policy.mjs';

test('historical IDs survive registration/profile updates while new malformed IDs and tenant reuse remain blocked',async()=>{
 const pg=new PGlite();
 const read=f=>readFile(new URL('../migrations/'+f,import.meta.url),'utf8');
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')&&f<'040').sort())await pg.exec(await read(f));
  await pg.exec("INSERT INTO users(id,email,password_hash) VALUES('u1','one@example.com','hash'),('u2','two@example.com','hash'); INSERT INTO businesses(id,owner_id,slug,name) VALUES('b1','u1','one','One'),('b2','u2','two','Two'); ALTER TABLE business_client_profiles DROP CONSTRAINT business_client_profiles_member_number_six;");
  await pg.exec("INSERT INTO business_client_profiles(id,owner,name,email,member_number,date_of_birth) VALUES('old','u1','Legacy Client','old@example.com','LC010200','2000-01-02'); ALTER TABLE business_client_profiles ADD CONSTRAINT business_client_profiles_member_number_six CHECK(member_number IS NULL OR member_number ~ '^[A-Z]{2}[0-9]{4}$') NOT VALID;");
  // This is the exact constraint error from staging's booking confirmation.
  await assert.rejects(pg.exec("UPDATE business_client_profiles SET archived=FALSE WHERE id='old'"),/business_client_profiles_member_number_six/);
  await pg.exec(await read('040_legacy_member_number_compatibility.sql'));
  await pg.exec("UPDATE business_client_profiles SET archived=FALSE,phone='+14155550123' WHERE id='old'");
  assert.equal((await pg.query("SELECT member_number FROM business_client_profiles WHERE id='old'")).rows[0].member_number,'LC010200');
  assert.equal(await issueMemberId(pg,{businessId:'b1',name:'Legacy Client',dateOfBirth:'2000-01-02'}),'LC010200');
  await pg.exec("INSERT INTO customer_booking_ids(business_id,first_name,last_name,email,date_of_birth,member_number) VALUES('b1','Legacy','Client','old@example.com','2000-01-02','LC010200')");
  await assert.rejects(pg.exec("INSERT INTO business_client_profiles(id,owner,name,member_number) VALUES('new','u1','New Client','NC010200')"),/business_client_profiles_member_number_six/);
  await assert.rejects(pg.exec("INSERT INTO business_client_profiles(id,owner,name,date_of_birth,member_number) VALUES('other','u2','Legacy Client','2000-01-02','LC010200')"),/business_client_profiles_member_number_six/);
  await assert.rejects(pg.exec("INSERT INTO business_client_profiles(id,owner,name,date_of_birth,member_number) VALUES('collision','u1','Another Client','2000-01-02','LC010200')"),/already belongs/);
  const fresh=await issueMemberId(pg,{businessId:'b1',name:'Fresh Client',dateOfBirth:'2000-01-02'});
  assert.match(fresh,/^[A-Z]{2}[0-9]{4}$/);
  assert.equal((await pg.query('SELECT count(*) AS n FROM legacy_business_member_numbers')).rows[0].n,1);
 }finally{await pg.close();}
});
