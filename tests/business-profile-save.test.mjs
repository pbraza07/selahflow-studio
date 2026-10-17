import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {saveBusinessProfile} from '../server/business-profile.mjs';

test('profile save binds every SQL parameter, preserves omitted branding and updates only the authenticated owner',async()=>{
 const db=new PGlite();
 try{
  await db.exec("CREATE TABLE businesses(id text PRIMARY KEY,owner_id text,name text,description text,city text,region text,listing_requested boolean,is_listed boolean,brand_primary text,brand_background text,business_model text,google_listing_url text,updated_at timestamptz); INSERT INTO businesses(id,owner_id,name,brand_primary,brand_background,business_model,google_listing_url) VALUES('a','owner-a','Original A','#123456','#111111','Original model','https://maps.google.com/maps/a'),('b','owner-b','Original B','#654321','#222222','Other model','https://maps.google.com/maps/b')");
  await saveBusinessProfile(db,{owner:'owner-a',name:'Updated A',description:'New description',city:'Tampa',region:'FL',brandPrimary:null,brandBackground:'#333333',businessModel:null,googleLink:null});
  const {rows}=await db.query('SELECT * FROM businesses ORDER BY id');
  assert.equal(rows[0].name,'Updated A');
  assert.equal(rows[0].brand_primary,'#123456');
  assert.equal(rows[0].brand_background,'#333333');
  assert.equal(rows[0].business_model,'Original model');
  assert.equal(rows[0].google_listing_url,'https://maps.google.com/maps/a');
  assert.equal(rows[1].name,'Original B');
  assert.equal(rows[1].updated_at,null);
 }finally{await db.close();}
});
