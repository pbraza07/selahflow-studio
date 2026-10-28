import {canReviewWaivers,assertWaiverAuthority} from '../server/waiver-authority.mjs';
import {acceptedWaiverVersions,WAIVER_VERSION,LEGACY_WAIVER_VERSION} from '../server/waiver-content.mjs';
import {cleanRemovedBookableSessions} from '../server/remove-bookable-session.mjs';
import {isBlocked} from '../server/booking-blockouts.mjs';
import * as teamPolicy from '../server/team-booking-policy.mjs';
import {bookingDiscount} from '../server/booking-discounts.mjs';
import {sessionIsFull,SESSION_FULL_MESSAGE} from '../server/session-capacity.mjs';
import {queueBookingReceipt} from '../server/booking-receipts.mjs';
import {validateCategoryWaiverSettings,ensureParticipationWaiver,assertBookingWaiver,publicWaiverDocument} from '../server/participation-waivers.mjs';

import {paymentConfigured} from '../server/membership-payments.mjs';
import {issueMemberId} from '../server/member-id-policy.mjs';
import {registrationQuestions,customRegistrationFields,validateStandardRegistration,publicRegistrationSettings} from '../server/registration-questions.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {readFile,readdir} from 'node:fs/promises';import ts from 'typescript';import {PGlite} from '@electric-sql/pglite';import {postgresSQL,executeBatch} from '../server/database.mjs';import {validOrigin,tokenHash,trustedOrigin} from '../server/security.mjs';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
test('public booking creates protected owner records; exposes catalog only; rejects conflicts and stale quotes',async()=>{
 const pg=new PGlite();const old=process.env.APP_URL;process.env.APP_URL='https://studio.example';
 try{
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 await pg.query("INSERT INTO users(id,email,password_hash) VALUES('owner','private@example.com','secret-hash')");
 await pg.query("INSERT INTO businesses(id,owner_id,slug,name,industry) VALUES('crawford-biz','owner','crawford','Crawford','barber')");
 let queue=Promise.resolve();const pool={query:(s,v)=>pg.query(s,v),async connect(){const prev=queue;let release;queue=new Promise(r=>release=r);await prev;return {query:(s,v)=>pg.query(s,v),release};}};
 const db=()=>({prepare(sql){return {sql:postgresSQL(sql),values:[],bind(...values){this.values=values;return this;},async first(){return (await pg.query(this.sql,this.values)).rows[0]||null;},async all(){return {results:(await pg.query(this.sql,this.values)).rows};}};},batch:s=>executeBatch(pool,s)});
 const defaults=await import(moduleURL(compile(await readFile(new URL('../lib/defaults.ts',import.meta.url),'utf8'))));
 const terms=await import(moduleURL(compile(await readFile(new URL('../lib/service-terms.ts',import.meta.url),'utf8'))));
 const helpers=await import('../server/booking-approvals.mjs');
 const review=await import('../server/booking-review.mjs');
 const customFields=await import('../server/booking-custom-fields.mjs');
 const scheduling=await import('../server/session-scheduling.mjs');
 const confirmBooking=async options=>{if(options.submissionOrigin)return helpers.confirmBooking({...options,pool});const {owner,services,staff,date,start,duration,buffer,id,data}=options;const stm=[db().prepare("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES(?,?,?,?,?,?,?,'Confirmed')").bind(id,owner,date,staff,start,duration,JSON.stringify(data))];for(let minute=start;minute<start+duration+buffer;minute+=15)stm.push(db().prepare('INSERT INTO slots(owner,date,staff,minute,appointment) VALUES(?,?,?,?,?)').bind(owner,date,staff,minute,id));await db().batch(stm);return {id};};
 globalThis.__bookingTest={canReviewWaivers,assertWaiverAuthority,acceptedWaiverVersions,WAIVER_VERSION,LEGACY_WAIVER_VERSION,...await import('../server/registration-questions.mjs'),cleanRemovedBookableSessions,...await import('../server/themes.mjs'),...await import('../server/page-content.mjs'),...await import('../server/booking-approval-display.mjs'),...await import('../server/plan-entitlements.mjs'),...await import('../server/team-seat-policy.mjs'),...await import('../server/booking-blockouts.mjs'),...teamPolicy,isBlocked,bookingDiscount,sessionIsFull,SESSION_FULL_MESSAGE,queueBookingReceipt,pushBookingRequest:async()=>{},notifyBookingRequest:async()=>({}),validateCategoryWaiverSettings,ensureParticipationWaiver,assertBookingWaiver,publicWaiverDocument,paymentConfigured,issueMemberId,registrationQuestions,customRegistrationFields,validateStandardRegistration,publicRegistrationSettings,getPool:()=>pool,randomBytes,db,requireOwner:async req=>{if(req.headers.get('x-test-owner')==='owner')return 'owner';throw Error('AUTH_REQUIRED');},validOrigin,tokenHash,trustedOrigin,...defaults,validDuration:terms.validDuration,isCalendarUnit:terms.isCalendarUnit,validSlotCapacity:helpers.validSlotCapacity,serviceCapacityOpen:helpers.serviceCapacityOpen,confirmBooking,requiresBookingApproval:review.requiresBookingApproval,approvalSettings:review.approvalSettings,bookingRequestDetail:review.bookingRequestDetail,...customFields,...scheduling};
 let source=await readFile(new URL('../lib/studio-handler.ts',import.meta.url),'utf8');source=source.replace(/^import .*;$/gm,'');source='const {canReviewWaivers,assertWaiverAuthority,acceptedWaiverVersions,WAIVER_VERSION,LEGACY_WAIVER_VERSION,validateBookableSessions,validateExistingSessionReservations,appointmentData,overlaps,validateRegistrationQuestions,cleanRemovedBookableSessions,themeIsValid,resolveTheme,validatePageContent,validateApprovalVisibleFields,checkSubscriptionLimits,planEntitlements,bookableTeamLimit,validateBlockouts,publicTeamMembers,publicSessionTeam,publicBookingStaff,sessionTeamDefaults,validateTeamBookingPolicy,sessionsForDate,sessionRemaining,isBlocked,bookingDiscount,sessionIsFull,SESSION_FULL_MESSAGE,queueBookingReceipt,pushBookingRequest,notifyBookingRequest,validateCategoryWaiverSettings,ensureParticipationWaiver,assertBookingWaiver,publicWaiverDocument,paymentConfigured,issueMemberId,registrationQuestions,customRegistrationFields,validateStandardRegistration,publicRegistrationSettings,getPool,randomBytes,db,requireOwner,validOrigin,tokenHash,trustedOrigin,defaultSettings,today,validDuration,isCalendarUnit,validSlotCapacity,serviceCapacityOpen,confirmBooking,requiresBookingApproval,approvalSettings,bookingRequestDetail,validateBookingFields,sanitizeBookingAnswers,bookingDateRange,computeDayAvailability,selectedSession,easternClock}=globalThis.__bookingTest;\n'+source;
 const handler=await import(moduleURL(compile(source)));
 const req=body=>new Request('https://studio.example/api/booking',{method:'POST',headers:{origin:'https://studio.example','content-type':'application/json','x-forwarded-for':'198.51.100.25'},body:JSON.stringify(body)});
 const catalog=await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json();
 assert.ok(catalog.config.services.length);assert.equal(catalog.config.products,undefined);assert.equal(catalog.appointments,undefined);assert.doesNotMatch(JSON.stringify(catalog),/private@example|secret-hash/);
 assert.equal((await handler.ownerGet(new Request('https://studio.example/api/studio'))).status,401);
 assert.equal((await handler.studioPost(req({action:'settings',config:{}}),true)).status,403);
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const selection={services:['barber'],staff:'james',date};
 const slots=await (await handler.studioPost(req({action:'availability',...selection}),true)).json();assert.ok(slots.slots.length);
 const savedConfig={...defaults.defaultSettings,bookingApprovalEnabled:true};await pg.query("INSERT INTO settings(owner,data) VALUES('owner',$1) ON CONFLICT(owner) DO UPDATE SET data=excluded.data",[JSON.stringify(savedConfig)]);
 const booking={action:'book',...selection,start:slots.slots[0],expectedPrice:35,expectedDuration:30,name:'Public Customer',firstName:'Public',lastName:'Customer',dateOfBirth:'2000-01-02',notMember:true,email:'client@example.com',key:crypto.randomUUID(),policyAccepted:true};
 // A client registering online can already have a copied, archived directory
 // record with an older ID. Reuse it without rewriting identity/history.
 await pg.exec("INSERT INTO legacy_business_member_numbers(business_id,member_number) VALUES('crawford-biz','PC0102'); INSERT INTO business_client_profiles(id,owner,name,email,date_of_birth,member_number,archived) VALUES('legacy-profile','owner','Public Customer','client@example.com','2000-01-02','PC0102',TRUE)");
 assert.equal((await handler.studioPost(req({...booking,policyAccepted:false}),true)).status,400);
 assert.equal((await handler.studioPost(req({...booking,expectedPrice:1}),true)).status,409);
 await pg.exec("INSERT INTO business_coupons(business_id,code,kind,value) VALUES('crawford-biz','SERVICE10','percent',10)");
 const quote=await handler.studioPost(req({action:'quote_booking_coupon',services:selection.services,couponCode:'SERVICE10',price:1}),true);assert.equal(quote.status,200);assert.equal((await quote.json()).totalCents,3150);
 booking.couponCode='SERVICE10';
 let response=await handler.studioPost(req(booking),true);assert.equal(response.status,200,response.status===200?undefined:await response.text());const first=await response.json();assert.ok(first.id);
 assert.equal(first.chargedPrice,31.5);const discountedDetails=JSON.parse((await pg.query('SELECT details FROM booking_requests WHERE id=$1',[first.id])).rows[0].details);assert.equal(discountedDetails.coupon.code,'SERVICE10');
 assert.equal(first.memberNumber,'PC0102');
 assert.equal(first.pending,true,'all public services wait for explicit owner approval');
 assert.equal((await pg.query('SELECT * FROM appointments')).rows.length,0);
 const profile=(await pg.query("SELECT id,member_number,archived FROM business_client_profiles WHERE id='legacy-profile'")).rows[0];
 assert.deepEqual(profile,{id:'legacy-profile',member_number:'PC0102',archived:false});
 response=await handler.studioPost(req(booking),true);assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).id,first.id);
 await helpers.confirmBooking({pool,owner:'owner',services:savedConfig.services.filter(s=>s.id==='barber'),staff:'james',date,start:booking.start,duration:30,buffer:savedConfig.buffer,id:first.id,pendingId:first.id,expectedReviewer:'owner',data:{name:booking.name,email:booking.email,services:['Barber'],serviceIds:['barber'],price:first.chargedPrice,paymentLines:discountedDetails.paymentLines,coupon:discountedDetails.coupon,memberNumber:first.memberNumber,channel:'Online booking',reviewedBy:'owner'}});
 response=await handler.studioPost(req({...booking,key:crypto.randomUUID(),email:'second@example.com'}),true);assert.equal(response.status,409);
 const rows=(await pg.query('SELECT * FROM appointments')).rows;assert.equal(rows.length,1);assert.equal(rows[0].owner,'owner');assert.equal(JSON.parse(rows[0].data).channel,'Online booking');
 const after=await (await handler.studioPost(req({action:'availability',...selection}),true)).json();assert.ok(!after.slots.includes(booking.start));
 // Existing and new catalog services can require a waiver without changing approval or pricing.
 const waivedConfig={...savedConfig,services:savedConfig.services.map(s=>s.id==='barber'?{...s,requiresWaiver:true}:s)};
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(waivedConfig)]);
 const waived={...booking,start:after.slots[0],key:crypto.randomUUID(),email:'waiver@example.test',name:'Jane Doe',firstName:'Jane',lastName:'Doe',dateOfBirth:'1990-01-01'};
 const missing=await handler.studioPost(req(waived),true);assert.equal(missing.status,400);assert.match((await missing.json()).error,/waiver/i);
 assert.equal((await pg.query("SELECT * FROM customer_booking_ids WHERE first_name='Jane'")).rows.length,0,'Failed signing rolls back new identity and profile');
 assert.equal((await handler.studioPost(req({action:'waiver_records'}),true)).status,403,'Public callers cannot read signed documents');
 const doc=(await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json()).config.waiver;
 const signedInput={signature:'Jane Doe',role:'self',date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),accepted:true,version:doc.version,documentHash:doc.hash};
 const signedResponse=await handler.studioPost(req({...waived,waiver:signedInput}),true);assert.equal(signedResponse.status,200,await signedResponse.clone().text());
 const signedBooking=await signedResponse.json();assert.ok(signedBooking.memberNumber);
 const check=await handler.studioPost(req({action:'waiver_status',firstName:'Jane',lastName:'Doe',dateOfBirth:'1990-01-01',memberNumber:signedBooking.memberNumber}),true);assert.equal((await check.json()).signed,true);
 const wrong=await handler.studioPost(req({action:'waiver_status',firstName:'Jane',lastName:'Doe',dateOfBirth:'1991-01-01',memberNumber:signedBooking.memberNumber}),true);assert.equal((await wrong.json()).signed,false);
 const nextSlots=(await (await handler.studioPost(req({action:'availability',...selection}),true)).json()).slots;
 const repeat=await handler.studioPost(req({...waived,key:crypto.randomUUID(),start:nextSlots[0],memberNumber:signedBooking.memberNumber,notMember:false}),true);assert.equal(repeat.status,200,await repeat.clone().text());
 assert.equal((await pg.query('SELECT * FROM participation_waivers')).rows.length,1,'Repeat booking requires no second signature');
 // Exercise category activation, status and signing through the actual public handler.
 const categoryConfig={...waivedConfig,categoryWaiver:{enabled:true,category:'beauty_wellness',additionalTerms:'Disclose product sensitivities.',serviceTerms:{barber:'Agree service scope before treatment.'}}};
 categoryConfig.categoryWaiver.review={hash:publicWaiverDocument(categoryConfig).hash,reference:'Fixture review only',reviewedAt:'2026-10-01'};
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(categoryConfig)]);
 const identityLookup={action:'waiver_status',firstName:'Jane',lastName:'Doe',dateOfBirth:'1990-01-01',memberNumber:signedBooking.memberNumber};
 assert.equal((await (await handler.studioPost(req(identityLookup),true)).json()).signed,false,'Legacy signature cannot authorize category content');
 const categoryDoc=(await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json()).config.waiver;
 assert.equal(categoryDoc.category,'beauty_wellness');assert.equal(categoryDoc.acceptingSignatures,true);
 const categoryBooking={...waived,key:crypto.randomUUID(),start:nextSlots.at(-1),memberNumber:signedBooking.memberNumber,notMember:false};
 const noCategorySignature=await handler.studioPost(req(categoryBooking),true);assert.equal(noCategorySignature.status,400);
 const withCategorySignature=await handler.studioPost(req({...categoryBooking,waiver:{...signedInput,version:categoryDoc.version,documentHash:categoryDoc.hash}}),true);
 assert.equal(withCategorySignature.status,200,await withCategorySignature.clone().text());
 assert.equal((await (await handler.studioPost(req(identityLookup),true)).json()).signed,true);
 assert.equal((await pg.query('SELECT * FROM participation_waivers')).rows.length,2,'Prior signature remains retained');
 const staleCategory={...categoryConfig,categoryWaiver:{...categoryConfig.categoryWaiver,additionalTerms:'Revised service precautions.'}};
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(staleCategory)]);
 const stalePublic=(await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json()).config.waiver;
 assert.equal(stalePublic.acceptingSignatures,false);
 assert.equal((await (await handler.studioPost(req(identityLookup),true)).json()).signed,false);
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(waivedConfig)]);

 assert.equal((await handler.studioPost(new Request('https://studio.example/api/booking',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify(booking)}),true)).status,403);
 // A hidden host is absent from catalog choices yet bookable through its exact assigned occurrence.
 const privateDate=new Date(Date.now()+8*86400000).toISOString().slice(0,10);
 const privateConfig={...savedConfig,staff:[...savedConfig.staff,{id:'privatehost',name:'Owner Only Secret Host',role:'Coach',initials:'PH',services:['barber'],bookingVisible:false}],bookableSessions:[{id:'private-session',date:privateDate,service:'barber',staff:'privatehost',start:660,capacity:5,autoAssignStaff:true,defaultTeamIds:['james']}]};
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(privateConfig)]);
 const hiddenCatalog=await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json();
 assert.equal(hiddenCatalog.config.staff.some(s=>s.id==='privatehost'),false);assert.doesNotMatch(JSON.stringify(hiddenCatalog),/Owner Only Secret Host/);assert.equal(hiddenCatalog.config.bookableSessions[0].defaultTeamIds,undefined);
 const sessionCalendar=await (await handler.studioPost(req({action:'session_calendar',date:privateDate,view:'day'}),true)).json();
 assert.equal(sessionCalendar.days[0].sessions[0].staffVisible,false);assert.equal(sessionCalendar.days[0].sessions[0].staffName,'');assert.equal(sessionCalendar.days[0].sessions[0].autoAssignStaff,true);
 assert.equal((await handler.studioPost(req({action:'availability',services:['barber'],date:privateDate,staff:'privatehost'}),true)).status,400);
 const assigned=await (await handler.studioPost(req({action:'availability',services:['barber'],date:privateDate,sessionId:'private-session'}),true)).json();assert.deepEqual(assigned.slots,[660]);
 assert.equal((await handler.studioPost(req({action:'availability',services:['barber'],date:privateDate,staff:'james',sessionId:'private-session'}),true)).status,400);
 const privateBooking=await handler.studioPost(req({...booking,key:crypto.randomUUID(),date:privateDate,start:660,staff:undefined,sessionId:'private-session'}),true);assert.equal(privateBooking.status,200,await privateBooking.clone().text());const privateResult=await privateBooking.json();assert.equal(privateResult.bookingReceipt.staff,'Session team');
 const stored=(await pg.query('SELECT staff_id,details FROM booking_requests WHERE id=$1',[privateResult.id])).rows[0];assert.equal(stored.staff_id,'privatehost');assert.deepEqual(JSON.parse(stored.details).hostTeamIds,['privatehost','james']);
 const serviceDefaultConfig={...privateConfig,services:privateConfig.services.map(s=>s.id==='barber'?{...s,defaultStaffId:'privatehost'}:s),bookableSessions:privateConfig.bookableSessions.map(s=>({...s,onlyScheduledTime:false}))};
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(serviceDefaultConfig)]);
 const defaultCatalog=await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json();assert.equal(defaultCatalog.config.services.find(s=>s.id==='barber').defaultStaffId,'privatehost');assert.equal(defaultCatalog.config.staff.some(s=>s.id==='privatehost'),false);
 const serviceDate=new Date(Date.now()+9*86400000).toISOString().slice(0,10);
 const serviceSlotsResponse=await handler.studioPost(req({action:'availability',services:['barber'],date:serviceDate}),true);assert.equal(serviceSlotsResponse.status,200,await serviceSlotsResponse.clone().text());const serviceSlots=await serviceSlotsResponse.json();assert.ok(serviceSlots.slots.length);
 const defaultBooking=await handler.studioPost(req({...booking,key:crypto.randomUUID(),date:serviceDate,start:serviceSlots.slots[0],staff:undefined}),true);assert.equal(defaultBooking.status,200,await defaultBooking.clone().text());assert.equal((await defaultBooking.json()).bookingReceipt.staff,'Session team');
 // Reproduce the actual Settings save from a client that removes a series
 // but still submits its saved reschedule and question targeting.
 const deletionConfig={...serviceDefaultConfig,bookingCustomFields:[...(serviceDefaultConfig.bookingCustomFields||[]),{id:'sessionOnly',label:'Session question',type:'text',required:false,showInNotification:false,forms:['booking'],sessionIds:['private-session']}],bookableSessions:[{...serviceDefaultConfig.bookableSessions[0],repeat:{frequency:'weekly',every:1,until:new Date(Date.parse(privateDate)+7*86400000).toISOString().slice(0,10)}}],sessionOverrides:[{id:'private-session',seriesId:'private-session',originalDate:privateDate,date:privateDate,start:900,service:'barber',staff:'privatehost',capacity:5}]};
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify(deletionConfig)]);
 await pg.query("INSERT INTO appointments(id,owner,date,staff,start,duration,data,status) VALUES('retained-session','owner',$1,'privatehost',900,30,$2,'Confirmed')",[privateDate,JSON.stringify({name:'Retained Client',sessionId:'private-session',services:['Barber'],serviceIds:['barber'],price:31.5,customAnswers:{sessionOnly:'Historical answer'},paymentStatus:'paid'})]);
 const beforeAppointments=(await pg.query('SELECT * FROM appointments ORDER BY id')).rows,beforeRequests=(await pg.query('SELECT * FROM booking_requests ORDER BY id')).rows;
 const ownerRequest=new Request('https://studio.example/api/studio',{method:'POST',headers:{origin:'https://studio.example','Content-Type':'application/json','x-test-owner':'owner'},body:JSON.stringify({action:'settings',config:{...deletionConfig,bookableSessions:[]}})});
 const removed=await handler.studioPost(ownerRequest,false);assert.equal(removed.status,200,await removed.clone().text());
 const saved=JSON.parse((await pg.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data);assert.deepEqual(saved.bookableSessions,[]);assert.deepEqual(saved.sessionOverrides,[]);assert.equal(saved.bookingCustomFields.some(f=>f.id==='sessionOnly'),false);
 assert.deepEqual((await pg.query('SELECT * FROM appointments ORDER BY id')).rows,beforeAppointments);assert.deepEqual((await pg.query('SELECT * FROM booking_requests ORDER BY id')).rows,beforeRequests);
 const removedCatalog=await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json();assert.deepEqual(removedCatalog.config.bookableSessions,[]);
 const removedCalendar=await (await handler.studioPost(req({action:'session_calendar',date:privateDate,view:'day'}),true)).json();assert.deepEqual(removedCalendar.days[0].sessions,[]);
 assert.equal((await handler.studioPost(req({...booking,key:crypto.randomUUID(),date:privateDate,start:900,staff:undefined,sessionId:'private-session'}),true)).status,400,'Stale clients cannot book a removed session');

 // Owner unchecking approval must survive settings save, public catalog and
 // the actual locked confirmation/payment queues. No customer network sends.
 const optionalConfig={...saved,socialLinks:{instagram:'https://instagram.com/fixture-business'},business_model:'A fixture business story',homeServicesTitle:'Fixture services',services:saved.services.map(s=>({...s,requiresApproval:false,requiresWaiver:false})),bookingStandardFields:{firstName:{required:false},lastName:{required:false},dateOfBirth:{required:false}}};
 const saveOptional=await handler.studioPost(new Request('https://studio.example/api/studio',{method:'POST',headers:{origin:'https://studio.example','Content-Type':'application/json','x-test-owner':'owner'},body:JSON.stringify({action:'settings',config:optionalConfig})}),false);
 assert.equal(saveOptional.status,200,await saveOptional.clone().text());
 const brandingSaved=JSON.parse((await pg.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data);assert.equal(brandingSaved.socialLinks.instagram,'https://instagram.com/fixture-business');assert.equal((await pg.query("SELECT business_model FROM businesses WHERE owner_id='owner'")).rows[0].business_model,'A fixture business story');
 const invalidSocial=await handler.studioPost(new Request('https://studio.example/api/studio',{method:'POST',headers:{origin:'https://studio.example','Content-Type':'application/json','x-test-owner':'owner'},body:JSON.stringify({action:'settings',config:{...optionalConfig,socialLinks:{instagram:'javascript:alert(1)'}}})}),false);assert.equal(invalidSocial.status,400);assert.equal(JSON.parse((await pg.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data).socialLinks.instagram,'https://instagram.com/fixture-business');
 assert.equal(JSON.parse((await pg.query("SELECT data FROM settings WHERE owner='owner'")).rows[0].data).services[0].requiresApproval,false);
 const optionalCatalog=(await (await handler.publicGet(new Request('https://studio.example/api/booking'))).json()).config;
 assert.equal(optionalCatalog.services.find(s=>s.id==='barber').requiresApproval,false);
 await pg.exec('DELETE FROM public_limits'); // separate synthetic request budget for this scenario
 const directDate=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
 const directSlots=(await (await handler.studioPost(req({action:'availability',services:['barber'],date:directDate}),true)).json()).slots;
 const directInput={...booking,email:'direct@example.test',key:crypto.randomUUID(),date:directDate,start:directSlots[0],staff:undefined};
 const direct=await handler.studioPost(req(directInput),true);assert.equal(direct.status,200,await direct.clone().text());
 const directResult=await direct.json();assert.equal(directResult.pending,false);assert.equal(directResult.chargedPrice,31.5);assert.equal(directResult.bookingReceipt.pending,false);
 assert.equal((await pg.query('SELECT * FROM booking_requests WHERE id=$1',[directResult.id])).rows.length,0);
 const confirmedData=JSON.parse((await pg.query('SELECT data FROM appointments WHERE id=$1',[directResult.id])).rows[0].data);assert.equal(confirmedData.coupon.code,'SERVICE10');
 assert.equal((await pg.query("SELECT * FROM booking_client_messages WHERE booking_id=$1 AND channel='email'",[directResult.id])).rows.length,1,'secure payment invitation queued');
 assert.equal((await handler.studioPost(req(directInput),true)).status,200,'retry reuses original booking');
 assert.equal((await pg.query("SELECT * FROM booking_client_messages WHERE booking_id=$1 AND channel='email'",[directResult.id])).rows.length,1,'retry cannot duplicate payment email');
 assert.equal((await handler.studioPost(req({...directInput,key:crypto.randomUUID()}),true)).status,409,'capacity still enforced');
 const optionalSlots=(await (await handler.studioPost(req({action:'availability',services:['barber'],date:directDate}),true)).json()).slots;
 const incomplete=await handler.studioPost(req({...directInput,key:crypto.randomUUID(),start:optionalSlots[0],firstName:'',lastName:'',name:'',dateOfBirth:''}),true);
 assert.equal(incomplete.status,200,await incomplete.clone().text());assert.equal((await incomplete.json()).memberNumber,'','optional incomplete identity never fabricates an ID');
 assert.deepEqual((await pg.query('SELECT * FROM booking_requests ORDER BY id')).rows,beforeRequests,'existing pending requests remain pending');
 const racedId=crypto.randomUUID();
 await pg.query("UPDATE settings SET data=$1 WHERE owner='owner'",[JSON.stringify({...optionalConfig,services:optionalConfig.services.map(s=>({...s,requiresApproval:true}))})]);
 await assert.rejects(helpers.confirmBooking({pool,owner:'owner',services:optionalConfig.services.filter(s=>s.id==='barber'),staff:'privatehost',date:directDate,start:optionalSlots.at(-1),duration:30,buffer:optionalConfig.buffer,id:racedId,data:{...confirmedData},submissionOrigin:'https://studio.example'}),/Approval settings changed/);
 assert.equal((await pg.query('SELECT * FROM appointments WHERE id=$1',[racedId])).rows.length,0,'a concurrent owner approval change cannot be bypassed');
 }finally{delete globalThis.__bookingTest;if(old===undefined)delete process.env.APP_URL;else process.env.APP_URL=old;await pg.close();}
});
