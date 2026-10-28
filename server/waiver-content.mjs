import {categoryWaiverContent} from './waiver-category-templates.mjs';
import {resolveTheme} from './themes.mjs';
export const WAIVER_VERSION='participation-2';
export function requiresWaiver(services=[]){return services.some(service=>service.requiresWaiver===true);}
export const LEGACY_WAIVER_VERSION='participation-1';
export function acceptedWaiverVersions(config={}){if(config.categoryWaiver?.enabled===true)return ['category-1'];return waiverDocument(config).version===LEGACY_WAIVER_VERSION?[LEGACY_WAIVER_VERSION]:[WAIVER_VERSION,LEGACY_WAIVER_VERSION];}
export function waiverDocument(config={},primary,background){
 if(config.categoryWaiver?.enabled===true)return {...categoryWaiverContent(config),colors:resolveTheme(config.theme,primary,background).colors};
 // Keep the already reviewed wording active until the owner records review of v2.
 const version=config.waiverLegalReview?.version===LEGACY_WAIVER_VERSION?LEGACY_WAIVER_VERSION:WAIVER_VERSION;
 const name=String(config.name||'Business').trim();
 const activities=`${name} training sessions, coaching and camps at the facility or outdoors, birthday parties and celebrations, indoor soccer and pick-up games, and other activities hosted or organized by ${name}`;
 const document={mediaRelease:"Optional media release: I authorize this business to photograph or record the participant during activities and use their image, voice and likeness in business publicity, websites and social media without compensation. I may withdraw permission for future use by contacting the business. Declining does not affect participation. A parent or guardian provides permission for a minor.",version,businessName:name,colors:resolveTheme(config.theme,primary,background).colors,title:'Participation Waiver',sections:[
 ['Understand the risks','I understand participation in training, outdoor camps, birthday parties, indoor soccer, pick-up games and other hosted activities may involve strenuous exercise, contact, falls, equipment, weather, outdoor surfaces and other participants. These risks can cause illness, property damage, serious injury, permanent disability, or death. I voluntarily accept the inherent risks of the activity.'],
 ['Participate safely','I will follow instructions and safety rules, use equipment properly, and stop and notify staff if I feel unwell or see a hazard. I am responsible for deciding whether I can participate safely and for seeking medical advice when needed.'],
 ['Release of claims',`To the fullest extent permitted by applicable law, I release ${name} and its owners, employees, and instructors from claims arising from the inherent risks of my voluntary participation. This does not release gross negligence, reckless or intentional misconduct, or any claim or right that cannot legally be waived.`],
 ['Emergency care','If I cannot give consent in an emergency, I authorize staff to seek emergency assistance. I understand that I remain responsible for medical costs to the extent required by law.'],
 ['Parent or guardian (if participant is a minor)',"I confirm that I am the participant's parent or legal guardian and consent to participation. I acknowledge the risks described above. Any release of a minor's claims applies only to the extent permitted by law."],
 ['Read and agree',`I have read and understand this waiver, had the opportunity to ask questions, and sign voluntarily. My typed name is intended as my electronic signature. This waiver covers ${activities}. It is retained for my unique client ID within this business.`]
 ]};
 if(version===WAIVER_VERSION){
  const statement="I authorize the business to photograph or record the participant during activities and use their image, voice and likeness in business publicity, websites and social media without compensation. I may withdraw permission for future use by contacting the business. For a minor, I confirm that I am the parent or legal guardian providing this permission.";
  document.sections.splice(5,0,['Media release',statement]);
  document.mediaRelease=statement;
  document.mediaReleaseIncluded=true;
 }
 return document;
}
export function waiverToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function waiverMinor(dob,date=waiverToday()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dob||'')||Number.isNaN(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>date)throw Error('Enter a valid participant birth date before signing.');
 const [y,m,d]=dob.split('-').map(Number),[cy,cm,cd]=date.split('-').map(Number);
 return cy-y-(cm<m||cm===m&&cd<d?1:0)<18;
}
export function validateWaiverSignature(input,{dateOfBirth,participantName,version=WAIVER_VERSION,now=new Date()}){
 const date=waiverToday(now),minor=waiverMinor(dateOfBirth,date);
 if(!input||input.accepted!==true||input.version!==version)throw Error('Read and sign the current participation waiver before booking.');
 if(typeof input.signature!=='string'||input.signature.trim().length<2||input.signature.trim().length>100||/[<>\u0000-\u001f]/.test(input.signature))throw Error('Type your full name as your electronic signature.');
 if(!['self','parent','guardian'].includes(input.role)||minor&&input.role==='self')throw Error('A parent or legal guardian must sign for a participant under 18.');
 if(input.role==='self'&&input.signature.trim().replace(/\s+/g,' ').toLowerCase()!==participantName.trim().replace(/\s+/g,' ').toLowerCase())throw Error('The participant signature must match the participant full name.');
 if(input.date!==date)throw Error('Use today\'s date for your waiver signature.');
 return {signerName:input.signature.trim(),signerRole:input.role,signedDate:date};
}
