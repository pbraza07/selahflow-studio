import {publicClientGuide,clientGuideIntent} from './client-guides.mjs';
import {membershipUsageSummary} from './membership-weekly.mjs';
import {groupAssistantDocuments} from './assistant-sections.mjs';
import {PAGE_CONTENT_FIELDS} from './page-content.mjs';
import {registrationQuestions} from './registration-questions.mjs';
import {publicTeamMembers} from './team-booking-policy.mjs';
import {sessionsForDate} from './session-scheduling.mjs';
import {membershipEligibilitySummary} from './membership-eligibility.mjs';
import {waiverDocument} from './waiver-content.mjs';

export const validKnowledgeSlug=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(value);
const text=value=>typeof value==='string'?value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,6000):'';
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const clock=n=>Number.isFinite(Number(n))?`${Math.floor(Number(n)/60)%12||12}:${String(Number(n)%60).padStart(2,'0')} ${Number(n)<720?'AM':'PM'}`:'';
const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const tokens=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[];
const stop=new Set('a an the is are do does can could i me my you your it its this that have has be to for of at in on and or with tell about what which how much please there any we our should would will want know get give some all also available find explain'.split(' '));
const families=[['price','prices','cost','costs','fee','fees','pricing','preco'],['child','children','kid','kids','youth','age','ages','minimum','old'],['soccer','football','futsal'],['hour','hours','open','opening','close','closing','horario'],['membership','memberships','member','credits','credit','plan','plans'],['schedule','scheduled','session','sessions','calendar','upcoming','when','date','dates','time','times'],['location','address','where','directions','located'],['contact','phone','call','human','help'],['policy','policies','cancel','cancellation','reschedule','refund'],['waiver','waivers','guardian','consent','media','photo','photos','release'],['booking','book','appointment','appointments','register','registration','signup','questions','required'],['pay','payment','payments','approve','approval','approved']];
const keywords=value=>{const words=new Set(tokens(value).filter(w=>!stop.has(w)));for(const family of families)if(family.some(w=>words.has(w)))for(const w of family)words.add(w);for(const w of [...words]){if(w.endsWith('ies'))words.add(w.slice(0,-3)+'y');else if(w.endsWith('s'))words.add(w.slice(0,-1));else{words.add(w+'s');if(w.endsWith('y'))words.add(w.slice(0,-1)+'ies');}}return words;};

/** Explicitly project published fields. Never stringify settings or customer records. */
export function buildBusinessKnowledge(business,config={},plans=[],now=new Date()){
 const slug=business.slug,home='/'+slug,book='/book/'+slug,membership='/membership/'+slug,documents=[];
 const add=(kind,title,body,href=book)=>{const value=(Array.isArray(body)?body:[body]).map(text).filter(Boolean).join('\n');if(value)documents.push({id:kind+'-'+documents.length,kind,title:text(title),text:value,href});};
 const guide=publicClientGuide(slug);
 if(guide)add('guide',guide.title,'Step-by-step instructions with current Arcila Training screenshots: choose services and available times; register a booking; understand approval and payment; join and pay for a membership; recognize SelahFlow confirmation emails; restore saved details with a Membership ID; and check membership or latest booking status. Open the 20-page PDF guide. A booking request is not proof of payment, and membership registration without payment does not activate credits. Status checks need only the ID; opening booking payment from the checker additionally verifies the registration birth date.',guide.href);
 add('overview',business.name,[business.name,business.industry?.replaceAll('-',' '),business.business_model,business.description,config.tagline],home);
 add('contact','Location and contact',[config.address||[business.city,business.region].filter(Boolean).join(', '),config.phone?'Phone: '+config.phone:''],home);
 if(Number.isFinite(config.open)&&Number.isFinite(config.close))add('hours','Opening hours',`${clock(config.open*60)}–${clock(config.close*60)} America/New_York (Eastern time). Check the booking calendar for date-specific availability.`,book);
 const services=Array.isArray(config.services)?config.services:[];
 for(const s of services){
  if(!s||!text(s.name))continue;
  const unit=s.durationUnit||'minutes',duration=s.durationValue??s.duration;
  add('service',s.name,[s.description,s.category,Number.isFinite(s.price)?'Price: '+money(s.price):'',Number.isFinite(duration)?`Duration: ${duration} ${unit}`:'',`Booking approval: ${s.requiresApproval!==false?'required; payment instructions follow approval':'confirms immediately'}.`,s.requiresWaiver===true?'Participation waiver required before booking.':'',s.membershipCreditAllowed===false?'Membership credits are not accepted for this service.':'Membership credit eligibility depends on your plan.']);
 }
 add('policy','Booking and cancellation policy',config.policy);
 add('payment','Booking, approval and payment','Choose a service and use the booking calendar to check live availability. Each service states whether approval is required. Participation is conditional on completing any payment due. Approved bookings receive payment instructions by email; eligible memberships may cover the session. The assistant can show limited membership and latest booking status using your unique ID. Detailed personal records and payment access require separate verification. It cannot make a booking, take payment or guarantee an available seat.');
 for(const [key,label] of Object.entries(PAGE_CONTENT_FIELDS))add(key.startsWith('membership')?'membership-wording':'wording',label,config.pageContent?.[key],key.startsWith('membership')?membership:book);
 for(const key of ['bookingEyebrow','bookingHeadline','bookingDescription','bookingHeaderNote','bookingPolicyTitle','bookingPaymentNote','bookingMembershipTitle','bookingMembershipDescription','bookingMembershipButton','bookingOwnerLoginLabel'])add('wording',key.replace(/([A-Z])/g,' $1'),config[key]);
 for(const p of plans)add('membership',p.name,[p.description,`Price: ${money(Number(p.price_cents)/100)} every ${p.interval_count||1} ${p.interval_unit}(s).`,Number.isInteger(p.sessions_included)?(p.weekly_sessions?membershipUsageSummary(p.weekly_sessions,p.sessions_included):`Included sessions: ${p.sessions_included}.`):'',membershipEligibilitySummary(p.credit_eligibility,config)],membership);
 if(plans.length)add('membership-rules','Membership renewal and credits','Membership payments recur according to the plan’s billing interval and start date. Monthly session allowances reset from the paid membership start date; unused monthly sessions do not roll over. The business can adjust a member’s billing anchor. Ask the assistant for membership status and sessions remaining using only your unique ID. Detailed personal records require separate verification.',membership);
 for(const member of publicTeamMembers(config))add('team',member.name,[member.role,(member.services||[]).map(id=>services.find(s=>s.id===id)?.name).filter(Boolean).join(', ')]);
 for(const form of ['booking','membership'])for(const field of registrationQuestions(config,form))add('question',`${form==='booking'?'Booking':'Membership'} question: ${field.label}`,[field.required?'Required by default; selected service/session overrides may apply.':'Optional by default; selected service/session overrides may apply.',...(field.type==='select'?field.options||[]:[])],form==='membership'?membership:book);
 if(services.some(s=>s.requiresWaiver===true)){
  add('waiver','Participation waiver and returning clients','A waiver is required for services marked waiver-required. Existing valid consent is reused for the same verified business/client identity. A parent or legal guardian signs for a minor. Review the actual document in the booking form.');
  const waiver=waiverDocument(config),review=config.waiverLegalReview;
  if(review?.version===waiver.version&&text(review.reference)&&Number.isFinite(Date.parse(review.reviewedAt||'')))for(const [title,body] of waiver.sections)add('waiver',title,body);
 }
 const start=day(now),localClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number),currentMinute=localClock[0]*60+localClock[1];
 for(let n=0;n<31;n++){
  const date=new Date(Date.parse(start+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  for(const session of sessionsForDate(config,date)){
   if(date===start&&session.start<=currentMinute)continue;
   const service=services.find(s=>s.id===session.service);if(!service)continue;
   add('session',`${service.name} · ${date}`,`${date} · ${clock(session.start)} Eastern time. ${text(service.description)} Configured capacity: ${session.capacity??session.maxSlots??service.maxSlots??1}. Check booking for live remaining seats; this schedule is not a seat reservation.`);
  }
 }
 return {name:text(business.name),slug,updatedAt:now.toISOString(),documents,links:[{label:'Business overview',href:home},{label:'Book a session / live availability',href:book},{label:'Memberships',href:membership}]};
}
export async function loadBusinessKnowledge(pool,slug,now=new Date()){
 if(!validKnowledgeSlug(slug))return null;
 const business=(await pool.query("SELECT b.id,b.name,b.slug,b.industry,b.description,b.business_model,b.city,b.region,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.slug=$1 AND b.status='active' LIMIT 1",[slug])).rows[0];
 if(!business)return null;
 let config={};try{config=typeof business.data==='string'?JSON.parse(business.data):business.data||{};}catch{}
 const plans=(await pool.query('SELECT name,description,price_cents,interval_unit,interval_count,sessions_included,weekly_sessions,credit_eligibility FROM membership_plans WHERE business_id=$1 AND active=true ORDER BY display_order,created_at DESC,name',[business.id])).rows;
 return buildBusinessKnowledge(business,config,plans,now);
}
export function answerBusinessQuestion(knowledge,question){
 const input=text(question).slice(0,1000),query=keywords(input),exact=tokens(input).filter(w=>!stop.has(w));
 const waiverIntent=/\b(waivers?|media|guardian|consent|release|risks?|safety|emergency)\b/i.test(input);
 const isoDate=input.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const monthDay=input.toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/);
 const scheduleIntent=!!(isoDate||monthDay)||families[5].filter(w=>!['session','sessions'].includes(w)).some(w=>exact.includes(w));
 const matchingServices=knowledge.documents.filter(d=>d.kind==='service'&&tokens(d.title).some(w=>exact.includes(w)&&!['service','services','session','sessions','training'].includes(w)));
 const matchesSession=d=>(!isoDate||d.title.includes(isoDate))&&(!monthDay||d.title.includes('-'+String(months.indexOf(monthDay[1])+1).padStart(2,'0')+'-'+monthDay[2].padStart(2,'0')))&&(!matchingServices.length||matchingServices.some(s=>d.title.startsWith(s.title+' · ')));
 let ranked=knowledge.documents.map(d=>{
  const words=new Set(tokens(d.title+' '+d.text)),title=new Set(tokens(d.title));
  let score=0;for(const w of query)if(words.has(w))score+=exact.includes(w)?3:1;
  for(const w of exact)if(title.has(w))score+=7;
  const covered=exact.filter(w=>words.has(w)||[...keywords(w)].some(k=>words.has(k))).length;
  if(exact.length&&covered/exact.length<0.6&&!exact.some(w=>title.has(w)))score=0;
  if(d.kind==='waiver'&&!waiverIntent)score=0;
  if(d.kind==='session'&&(!scheduleIntent||!matchesSession(d)))score=0;
  return {d,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 const wantsAll=/\b(everything|all information|overview|offer|offers|about this business)\b|^what do you do\??$/i.test(input);
 if(wantsAll)ranked=knowledge.documents.filter(d=>['overview','contact','hours','service','membership','policy'].includes(d.kind)).map(d=>({d,score:1}));
 const selected=ranked.slice(0,8).map(x=>x.d);
 // Topic queries should include the factual category even when generic words
 // such as "booking" appear in many unrelated descriptions.
 const desired=[];
 if(/\b(hours?|open|opening|close|closing)\b/i.test(input))desired.push('hours');
 if(/\b(address|location|directions|phone|contact|human)\b/i.test(input))desired.push('contact');
 if(/\b(memberships?|credits?|plans?)\b/i.test(input))desired.push('membership','membership-rules','membership-wording');
 if(waiverIntent)desired.push('waiver');
 if(scheduleIntent)desired.push('session');
 if(/\b(prices?|cost|pricing)\b/i.test(input)&&(!/\b(memberships?|plans?)\b/i.test(input)||matchingServices.length||/\bservices?\b/i.test(input)))desired.push('service');
 const docs=desired.length?knowledge.documents.filter(d=>desired.includes(d.kind)&&(d.kind!=='session'||matchesSession(d))&&(d.kind!=='service'||!matchingServices.length||matchingServices.includes(d))).slice(0,50):selected;

 const instructions=clientGuideIntent(input)?knowledge.documents.filter(d=>d.kind==='guide'):[];
 let size=0;const unique=[...new Map([...instructions,...docs].map(d=>[d.id,d])).values()].filter(d=>{size+=d.title.length+d.text.length+3;return size<=18000;});
 return {sections:groupAssistantDocuments(unique),businessName:knowledge.name,answer:unique.length?unique.map(d=>d.title+'\n'+d.text).join('\n\n'):`I couldn’t find a published answer to that question for ${knowledge.name}. Please contact the business or check its booking page. I can help with services, prices, schedules, memberships, policies, waivers and registration questions.`,sources:unique.map(d=>({title:d.title,href:d.href})),links:instructions.length?[{label:'Open step-by-step client guide (PDF)',href:instructions[0].href},...knowledge.links]:knowledge.links,updatedAt:knowledge.updatedAt};
}
