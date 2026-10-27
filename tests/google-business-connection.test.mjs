import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {googleBusinessConfigured,googleBusinessSeal,googleBusinessOpen,beginGoogleBusiness,completeGoogleBusiness,googleBusinessStatus,googleBusinessLocations,selectGoogleLocation,saveGoogleDisplay,disconnectGoogleBusiness,GOOGLE_BUSINESS_SCOPE} from '../server/google-business-connection.mjs';
import {googleGalleryForBusiness,safeGoogleLink} from '../server/google-business-gallery.mjs';
const env={GOOGLE_BUSINESS_CLIENT_ID:'client-test',GOOGLE_BUSINESS_CLIENT_SECRET:'secret-test',GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY:'a'.repeat(64)},session='b'.repeat(64);
const response=data=>({ok:true,json:async()=>data});
async function fixture(){const db=new PGlite();await db.exec("CREATE TABLE users(id text PRIMARY KEY); INSERT INTO users VALUES('owner-a'),('owner-b'); CREATE TABLE businesses(id text PRIMARY KEY,owner_id text,name text,slug text,city text,region text,status text); INSERT INTO businesses VALUES('a','owner-a','Business A','business-a','Tampa','FL','active'),('b','owner-b','Business B','business-b','Miami','FL','active');");await db.exec(await readFile(new URL('../migrations/062_google_business_profiles.sql',import.meta.url),'utf8'));return db;}
test('Google Business tokens use authenticated business/purpose encryption and never share the Gmail OAuth client',()=>{
 const value=googleBusinessSeal('private-refresh','a','refresh',env);assert.ok(!value.includes('private-refresh'));assert.equal(googleBusinessOpen(value,'a','refresh',env),'private-refresh');
 for(const [b,p] of [['b','refresh'],['a','verifier']])assert.throws(()=>googleBusinessOpen(value,b,p,env));
 assert.equal(googleBusinessConfigured({GMAIL_CLIENT_ID:'existing',GMAIL_CLIENT_SECRET:'secret',GMAIL_TOKEN_ENCRYPTION_KEY:'c'.repeat(64)}),false);
 assert.throws(()=>googleBusinessOpen(value,'a','refresh',{...env,GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY:'d'.repeat(64)}));
});
test('OAuth state is expiring, session/owner/business bound, PKCE protected and consumed once; status never exposes tokens',async()=>{
 const db=await fixture();try{
 const start=await beginGoogleBusiness(db,{owner:'owner-a',session,origin:'https://selahflow.onrender.com'},env),u=new URL(start.authorizationUrl),state=u.searchParams.get('state');
 assert.equal(u.hostname,'accounts.google.com');assert.equal(u.searchParams.get('redirect_uri'),'https://selahflow.onrender.com/api/business/google/callback');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.ok(u.searchParams.get('scope').includes(GOOGLE_BUSINESS_SCOPE));assert.ok(!u.searchParams.get('scope').includes('gmail'));
 let calls=0;const provider=async(url,options)=>{calls++;if(url.includes('/token')){assert.ok(new URLSearchParams(options.body).get('code_verifier'));return response({access_token:'access',refresh_token:'private-refresh',scope:GOOGLE_BUSINESS_SCOPE});}return response({email:'business@example.test',email_verified:true});};
 for(const input of [{owner:'owner-b',session},{owner:'owner-a',session:'c'.repeat(64)}])await assert.rejects(()=>completeGoogleBusiness(db,{...input,state,code:'synthetic'},env,provider));assert.equal(calls,0);
 await db.query("UPDATE business_google_oauth_states SET expires_at=now()-interval '1 second'");await assert.rejects(()=>completeGoogleBusiness(db,{owner:'owner-a',session,state,code:'synthetic'},env,provider));assert.equal(calls,0);
 await db.query("UPDATE business_google_oauth_states SET expires_at=now()+interval '1 minute'");assert.equal((await completeGoogleBusiness(db,{owner:'owner-a',session,state,code:'synthetic'},env,provider)).slug,'business-a');
 await assert.rejects(()=>completeGoogleBusiness(db,{owner:'owner-a',session,state,code:'synthetic'},env,provider));assert.equal(calls,2);
 const status=await googleBusinessStatus(db,'owner-a',env);assert.equal(status.connected,true);assert.equal(status.accountEmail,'business@example.test');assert.ok(!JSON.stringify(status).includes('refresh'));assert.equal((await googleBusinessStatus(db,'owner-b',env)).connected,false);
 const stored=(await db.query('SELECT encrypted_refresh_token FROM business_google_profiles')).rows[0];assert.ok(!stored.encrypted_refresh_token.includes('private-refresh'));
 }finally{await db.close();}
});
test('location publication requires the connected account list; display changes and disconnect stay in the authenticated tenant',async()=>{
 const db=await fixture();try{
 await db.query("INSERT INTO business_google_profiles(business_id,encrypted_refresh_token,connection_status) VALUES('a',$1,'connected')",[googleBusinessSeal('refresh-a','a','refresh',env)]);
 const provider=async(url,options)=>{
 if(url.includes('/token')){assert.equal(new URLSearchParams(options.body).get('refresh_token'),'refresh-a');return response({access_token:'access-a'});}
 assert.equal(options.headers.Authorization,'Bearer access-a');
 if(url.includes('accountmanagement'))return response({accounts:[{name:'accounts/account-a'}]});
 assert.ok(url.includes('accounts/account-a/locations'));return response({locations:[{name:'locations/location-a',title:'Business A',storefrontAddress:{addressLines:['123 Test St']},metadata:{placeId:'ChIJbusinessA'}}]});};
 assert.equal((await googleBusinessLocations(db,'owner-a',env,provider)).locations[0].placeId,'ChIJbusinessA');
 await assert.rejects(()=>selectGoogleLocation(db,'owner-a','accounts/foreign/locations/foreign',env,provider));
 await selectGoogleLocation(db,'owner-a','accounts/account-a/locations/location-a',env,provider);
 await saveGoogleDisplay(db,'owner-b',{placeId:'ChIJbusinessB',showReviews:false,showPhotos:true});
 assert.equal((await googleBusinessStatus(db,'owner-a',env)).placeId,'ChIJbusinessA');assert.equal((await googleBusinessStatus(db,'owner-b',env)).placeId,'ChIJbusinessB');
 await assert.rejects(()=>saveGoogleDisplay(db,'owner-a',{placeId:'https://evil.test',showReviews:true,showPhotos:true}));
 await assert.rejects(()=>saveGoogleDisplay(db,'owner-a',{placeId:'ChIJbusinessA',showReviews:'true',showPhotos:true}));
 await disconnectGoogleBusiness(db,'owner-a');const a=await googleBusinessStatus(db,'owner-a',env);assert.equal(a.connected,false);assert.equal(a.placeId,'');assert.equal(a.showPhotos,false);assert.equal(a.showReviews,false);assert.equal((await googleBusinessStatus(db,'owner-b',env)).placeId,'ChIJbusinessB');
 assert.equal((await db.query("SELECT encrypted_refresh_token FROM business_google_profiles WHERE business_id='a'")).rows[0].encrypted_refresh_token,null);
 await db.query("UPDATE businesses SET status='archived' WHERE id='a'");await assert.rejects(()=>saveGoogleDisplay(db,'owner-a',{placeId:'ChIJbusinessA',showReviews:true,showPhotos:true}));
 }finally{await db.close();}
});
test('Google review display uses an exact Place ID, original text, safe attributions and no-store; summary omits review text requests',async()=>{
 const business={name:'Business A',google_place_id:'ChIJbusinessA'},text='Original review <script>not executable</script> '+ 'x'.repeat(12500);let calls=[];
 const provider=async(url,opts)=>{calls.push({url,opts});return response({id:'ChIJbusinessA',displayName:{text:'Exact business'},googleMapsUri:'https://maps.google.com/?cid=123',rating:4.7,userRatingCount:13,reviews:[{rating:2,originalText:{text,languageCode:'en'},authorAttribution:{displayName:'Reviewer',uri:'javascript:bad',photoUri:'https://evil.test/avatar'},googleMapsUri:'https://www.google.com/maps/reviews/123',relativePublishTimeDescription:'A week ago'}],photos:[{name:'places/ChIJbusinessA/photos/PhotoResource123',authorAttributions:[{displayName:'Photographer',uri:'https://maps.google.com/contrib/123'}]}]});};
 const d=await googleGalleryForBusiness(business,{GOOGLE_PLACES_API_KEY:'server-secret'},provider);assert.equal(d.rating,4.7);assert.equal(d.reviewCount,13);assert.equal(d.reviews[0].text,text);assert.equal(d.reviews[0].rating,2);assert.equal(d.reviews[0].authorUrl,'');assert.equal(d.reviews[0].authorPhoto,'');assert.equal(d.photos.length,1);assert.equal(calls[0].opts.method,'GET');assert.equal(calls[0].opts.cache,'no-store');assert.ok(calls[0].url.endsWith('/places/ChIJbusinessA'));assert.ok(!JSON.stringify(d).includes('server-secret'));
 await googleGalleryForBusiness({...business,google_reviews_summary:true},{GOOGLE_PLACES_API_KEY:'key'},provider);assert.ok(!calls[1].opts.headers['X-Goog-FieldMask'].includes(',reviews'));
 const hidden=await googleGalleryForBusiness({...business,google_show_reviews:false,google_show_photos:false},{GOOGLE_PLACES_API_KEY:'key'},()=>{throw Error('Must not fetch');});assert.equal(hidden.link,'');
 const mismatch=await googleGalleryForBusiness(business,{GOOGLE_PLACES_API_KEY:'key'},async()=>response({id:'ChIJanotherBusiness',reviews:[{text:{text:'Wrong business'}}]}));assert.equal(mismatch.photos.length,0);assert.equal(mismatch.reviews,undefined);
 assert.equal(safeGoogleLink('https://www.google.com.evil.test/maps'),'');assert.equal(safeGoogleLink('https://secret@www.google.com/maps'),'');
});
test('missing provider config and provider outages do not create content or guess reviews for legacy name searches',async()=>{
 const b={name:'Business A',google_listing_url:'https://maps.app.goo.gl/example'};
 const off=await googleGalleryForBusiness(b,{},()=>{throw Error('No request expected');});assert.equal(off.enabled,false);
 const legacy=await googleGalleryForBusiness(b,{GOOGLE_PLACES_API_KEY:'key'},async()=>response({places:[{id:'ChIJbusinessA',displayName:{text:'Business A'},rating:5,reviews:[{text:{text:'Not confirmed'}}]}]}));assert.deepEqual(legacy.reviews,[]);assert.equal(legacy.rating,null);
 await assert.rejects(()=>googleGalleryForBusiness({...b,google_place_id:'ChIJbusinessA'},{GOOGLE_PLACES_API_KEY:'key'},async()=>({ok:false,status:403})));
});
test('rendered Google review cards escape provider text, preserve low ratings and link the individual source',async()=>{
 const {createRequire}=await import('node:module'),ts=(await import('typescript')).default,React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),require=createRequire(import.meta.url);
 const source=await readFile(new URL('../app/components/google-business-gallery.tsx',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};
 new Function('require','module','exports',js)(require,m,m.exports);
 const html=renderToStaticMarkup(React.createElement(m.exports.GoogleReviewCard,{review:{author:'<img onerror=bad>',authorUrl:'https://www.google.com/maps/contrib/123',authorPhoto:'',rating:1,text:'<script>bad()</script> Original criticism',language:'en',time:'Yesterday',url:'https://www.google.com/maps/reviews/123'}}));
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt; Original criticism'));assert.ok(html.includes('1 / 5'));assert.ok(html.includes('https://www.google.com/maps/reviews/123'));assert.ok(html.includes('https://www.google.com/maps/contrib/123'));
});
test('Google owner routes reject anonymous callers and foreign-origin mutations before database/provider access',async()=>{
 const ts=(await import('typescript')).default,security=await import('../server/security.mjs');let queries=0,ownerCalls=0;
 const source=await readFile(new URL('../app/api/business/google/route.ts',import.meta.url),'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};
 new Function('require','module','exports',js)(path=>{
 if(path.includes('database'))return {getPool:()=>{queries++;throw Error('Must not access DB');}};
 if(path.includes('/auth'))return {requireOwner:async()=>{ownerCalls++;throw Error('AUTH_REQUIRED');}};
 if(path.includes('security'))return security;
 if(path.includes('google-business-connection'))return {};
 throw Error('Unexpected dependency '+path);
 },m,m.exports);
 const url='https://selahflow.onrender.com/api/business/google';assert.equal((await m.exports.GET(new Request(url))).status,401);
 assert.equal((await m.exports.POST(new Request(url,{method:'POST',headers:{Origin:'https://foreign.test'},body:'{"action":"disconnect"}'}))).status,403);
 const before=ownerCalls;assert.equal((await m.exports.POST(new Request(url,{method:'POST',headers:{Origin:security.trustedOrigin(new Request(url))},body:'{"action":"display","owner":"owner-b"}'}))).status,401);assert.equal(ownerCalls,before+1);assert.equal(queries,0);
});
