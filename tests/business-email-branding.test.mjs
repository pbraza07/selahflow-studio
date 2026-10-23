import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import sharp from 'sharp';
import {loadBusinessEmailBrand} from '../server/business-email-branding.mjs';
import {brandedEmailHtml,resendBrand} from '../server/branded-email.mjs';
import {gmailMime,sealGmail} from '../server/gmail-delivery.mjs';
import {sendNotificationChannel} from '../server/notification-delivery.mjs';
import {resolveTheme,accessibleText} from '../server/themes.mjs';
const png=()=>sharp({create:{width:24,height:12,channels:4,background:'#ff0000'}}).png().toBuffer();
async function fixture(){
 const pg=new PGlite();for(const f of (await readdir(new URL('../migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'));
 for(const owner of ['a','b']){
  await pg.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[owner,owner+'@example.test','synthetic']);
  await pg.query('INSERT INTO businesses(id,owner_id,slug,name,status,brand_primary,brand_background) VALUES($1,$2,$3,$4,$5,$6,$7)',['biz-'+owner,owner,'business-'+owner,'Business '+owner,'active',owner==='a'?'#bb2200':'#112299',owner==='a'?'#fff1ee':'#eef0ff']);
  await pg.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[owner,'{}']);
 }
 return {pg,db:{query:(sql,values)=>pg.query(sql,values)}};
}
const message={subject:'Booking approved',text:'Hello <Client>\nPay: https://example.test/pay#token=private&booking=one',actions:[{label:'Make payment',url:'https://example.test/pay#token=private&booking=one'}]};
const htmlFromMime=mime=>{const part=mime.match(/Content-Type: text\/html;[^\r]+\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/);assert.ok(part);return Buffer.from(part[1].replace(/\s/g,''),'base64').toString();};

test('business branding is tenant-scoped and loads current theme/logo changes without stale caches',async()=>{
 const {pg,db}=await fixture();try{
  const bytes=await png();await pg.query('INSERT INTO business_logos(business_id,mime_type,bytes) VALUES($1,$2,$3)',['biz-a','image/png',bytes]);
  const a=await loadBusinessEmailBrand(db,{businessId:'biz-a'}),b=await loadBusinessEmailBrand(db,{businessId:'biz-b'});
  assert.equal(a.name,'Business a');assert.equal(a.colors.button,'#bb2200');assert.ok(a.logo);assert.equal(b.colors.button,'#112299');assert.equal(b.logo,null);
  assert.equal(await loadBusinessEmailBrand(db),null);await assert.rejects(loadBusinessEmailBrand(db,{businessId:'biz-a',ownerId:'b'}),/unavailable/);
  const theme=resolveTheme(null);theme.colors.button='#663399';theme.colors.header='#111111';theme.colors.page='#222222';theme.colors.surface='#333333';
  await pg.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify({theme}),'a']);
  const webp=await sharp(bytes).webp().toBuffer();await pg.query('UPDATE business_logos SET mime_type=$1,bytes=$2 WHERE business_id=$3',['image/webp',webp,'biz-a']);
  const fresh=await loadBusinessEmailBrand(db,{ownerId:'a'});assert.equal(fresh.colors.button,'#663399');assert.equal((await sharp(fresh.logo).metadata()).format,'png');
  const html=brandedEmailHtml({...message,emailBrand:fresh});for(const color of ['#663399','#111111','#222222','#333333'])assert.ok(html.includes(color));assert.ok(html.includes('color:'+accessibleText('#333333')));assert.match(html,/cid:business-logo/);assert.doesNotMatch(html,/cid:selahflow-logo|Business b/);
  await pg.query("DELETE FROM business_logos WHERE business_id='biz-a'");assert.equal((await loadBusinessEmailBrand(db,{businessId:'biz-a'})).logo,null);
  await pg.query("UPDATE businesses SET status='archived' WHERE id='biz-a'");await assert.rejects(loadBusinessEmailBrand(db,{businessId:'biz-a'}),/unavailable/);
 }finally{await pg.close();}
});
test('Gmail and Resend use matching business logo attachments, escaped content and secure action fragments',async()=>{
 const brand={name:'Business <A> & Co',colors:resolveTheme(null,'#bb2200','#fff1ee').colors,logo:await png()};
 const branded={...message,emailBrand:brand},html=brandedEmailHtml(branded),mime=Buffer.from(gmailMime('sender@gmail.com','client@example.test',branded),'base64url').toString(),resend=resendBrand(branded);
 assert.equal(htmlFromMime(mime),html);assert.match(mime,/From: SelahFlow <sender@gmail.com>/);assert.match(mime,/Content-ID: <business-logo>/);assert.match(mime,/name="business-logo.png"/);assert.equal(resend.attachments[0].content_id,'business-logo');assert.deepEqual(Buffer.from(resend.attachments[0].content,'base64'),brand.logo);
 assert.match(html,/Business &lt;A&gt; &amp; Co/);assert.match(html,/Hello &lt;Client&gt;/);assert.match(html,/token=private&amp;booking=one/);assert.doesNotMatch(html,/<Client>|src="https?:/);
 const missing={...branded,emailBrand:{...brand,logo:null}};assert.equal(resendBrand(missing).attachments.length,0);assert.doesNotMatch(brandedEmailHtml(missing),/<img|selahflow-logo/);assert.match(brandedEmailHtml(missing),/Business &lt;A&gt;/);
 const unsafe=brandedEmailHtml({...missing,emailBrand:{...missing.emailBrand,colors:{button:'red; background:url(https://bad.test)'}},actions:[{label:'Unsafe',url:'javascript:alert(1)'}]});assert.doesNotMatch(unsafe,/background:url|href="javascript/);
});
test('central delivery applies canonical branding for both providers, keeps sender/staging controls, and rejects forged message branding',async()=>{
 const {pg,db}=await fixture();try{
  await pg.query('INSERT INTO business_logos(business_id,mime_type,bytes) VALUES($1,$2,$3)',['biz-a','image/png',await png()]);
  const sent=[],fetcher=async(path,options)=>{sent.push({path,body:JSON.parse(options.body)});return {ok:true,json:async()=>({id:'resend-fixture'})};};
  const resendEnv={EMAIL_PROVIDER:'resend',RESEND_API_KEY:'synthetic',RESEND_FROM_EMAIL:'SelahFlow <sender@example.test>'};
  const context={businessId:'biz-a',brandingDb:db};
  assert.equal((await sendNotificationChannel('email','client@example.test',{...message,emailBrand:{name:'FORGED OTHER BUSINESS'}},resendEnv,fetcher,context)).status,'submitted');assert.equal(sent[0].body.from,resendEnv.RESEND_FROM_EMAIL);assert.match(sent[0].body.html,/Business a/);assert.doesNotMatch(sent[0].body.html,/FORGED OTHER/);
  assert.equal((await sendNotificationChannel('email','client@example.test',message,{...resendEnv,APP_ENV:'staging'},fetcher,context)).status,'not_configured');assert.equal(sent.length,1);
  assert.equal((await sendNotificationChannel('email','client@example.test',message,resendEnv,fetcher,{...context,businessId:'missing'})).status,'failed');assert.equal(sent.length,1);
  const env={EMAIL_PROVIDER:'gmail',GMAIL_CLIENT_ID:'fixture',GMAIL_CLIENT_SECRET:'fixture',GMAIL_TOKEN_ENCRYPTION_KEY:'a'.repeat(64)};
  await pg.query("INSERT INTO platform_gmail_connection(id,email,encrypted_refresh_token,status,connected_by) VALUES('shared','sender@gmail.com',$1,'connected','a')",[sealGmail('synthetic-refresh','refresh',env)]);
  let mime='';const gmailFetch=async(path,options)=>path.includes('/token')?{ok:true,json:async()=>({access_token:'fixture'})}:(mime=Buffer.from(JSON.parse(options.body).raw,'base64url').toString(),{ok:true,json:async()=>({id:'gmail-fixture'})});
  assert.equal((await sendNotificationChannel('email','client@example.test',message,env,gmailFetch,context)).status,'submitted');assert.match(htmlFromMime(mime),/Business a/);assert.match(mime,/Content-ID: <business-logo>/);assert.match(mime,/From: SelahFlow <sender@gmail.com>/);
 }finally{await pg.close();}
});
test('every business email producer passes canonical branding context and damaged uploads retain business identity',async()=>{
 for(const [file,pattern] of [['booking-receipts','businessId:item.business_id'],['membership-payment-emails','businessId:item.business_id'],['membership-invitations','businessId:r.business_id'],['booking-client-notifications','businessId:state.business_id'],['owner-form-notifications','businessId:row.business_id'],['notification-delivery','businessId:data.business_id']])assert.ok((await readFile(new URL('../server/'+file+'.mjs',import.meta.url),'utf8')).includes(pattern),file);
 assert.ok((await readFile(new URL('../lib/studio-handler.ts',import.meta.url),'utf8')).includes('{ownerId:owner}'));
 const {pg,db}=await fixture();try{await pg.query('INSERT INTO business_logos(business_id,mime_type,bytes) VALUES($1,$2,$3)',['biz-a','image/png',Buffer.from('damaged upload')]);const brand=await loadBusinessEmailBrand(db,{businessId:'biz-a'});assert.equal(brand.logo,null);assert.match(brandedEmailHtml({...message,emailBrand:brand}),/Business a/);}finally{await pg.close();}
});
