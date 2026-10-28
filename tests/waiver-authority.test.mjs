import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {tokenHash} from '../server/security.mjs';
import {canReviewWaivers,assertWaiverAuthority} from '../server/waiver-authority.mjs';
test('waiver activation and legal review require a current platform administrator session',async()=>{
 const db=new PGlite();try{
 for(const file of ['001_initial.sql','002_public_booking.sql','003_platform_foundation.sql','004_business_customization.sql'])await db.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await db.exec('ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false');
 await db.query("INSERT INTO users(id,email,password_hash) VALUES('admin','pbraza@gmail.com','hash'),('owner','owner@example.test','hash')");
 await db.query("INSERT INTO platform_admins(user_id,role) VALUES('admin','primary')");
 for(const [id,token] of [['admin','a'.repeat(64)],['owner','b'.repeat(64)]])await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[tokenHash(token),id]);
 const req=token=>new Request('https://example.test/api/studio',{headers:{cookie:'salonflow_session='+token}});
 const admin=req('a'.repeat(64)),owner=req('b'.repeat(64));
 assert.equal(await canReviewWaivers(db,admin),true);assert.equal(await canReviewWaivers(db,owner),false);
 for(const next of [{categoryWaiver:{enabled:true,review:{reference:'forged'}}},{waiverLegalReview:{reference:'forged'}},{categoryWaiver:null}])await assert.rejects(assertWaiverAuthority(db,owner,{categoryWaiver:{enabled:true}},next),/platform administrator/);
 await assertWaiverAuthority(db,admin,{}, {categoryWaiver:{enabled:true}});
 await assertWaiverAuthority(db,owner,{categoryWaiver:{enabled:true}},{categoryWaiver:{enabled:true},name:'Other change'});
 await db.query("DELETE FROM platform_admins WHERE user_id='admin'");
 await assert.rejects(assertWaiverAuthority(db,admin,{}, {waiverLegalReview:{reference:'review'}}),/platform administrator/);
 assert.equal(await canReviewWaivers(db,new Request('https://example.test')),false);
 }finally{await db.close();}
});
