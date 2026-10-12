import {PALETTES} from './themes.mjs';
const groups={
 beauty:['barber','hair','nails','lashes','brows','makeup','skin-care','spa','massage','wellness','tattoo','piercing','tanning','waxing'],
 pets:['pet-grooming','pet-sitting','dog-training','veterinary'],
 fitness:['fitness','yoga','sports-coaching','dance','martial-arts','swimming'],
 health:['medical','dental','mental-health','physical-therapy','chiropractic','nutrition'],
 education:['tutoring','music-lessons','art-lessons','language-lessons','test-prep','career-coaching'],
 events:['photography','videography','event-planning','wedding-services','florist','catering','personal-chef'],
 home:['cleaning','housekeeping','landscaping','handyman','plumbing','electrical','hvac','painting','pest-control','pool-service','home-organizing','moving'],
 automotive:['auto-detailing','auto-repair','car-wash','mobile-mechanic','bike-repair'],
 professional:['accounting','tax-preparation','financial-planning','legal','notary','insurance','real-estate','property-management','consulting','it-support','cybersecurity','marketing','web-design','graphic-design','virtual-assistant','translation','travel-planning'],
 community:['rentals','subscription-services','nonprofit','religious']
};
const palette={beauty:4,pets:7,fitness:18,health:13,education:9,events:10,home:15,automotive:1,professional:0,community:12,other:0};
const examples={
 barber:['Haircut','Beard trim','Cut and beard','Styling pomade','Beard oil','Barbering session'],
 hair:['Haircut and style','Color consultation','Blowout','Shampoo','Conditioner','Styling workshop'],
 nails:['Manicure','Pedicure','Nail art','Cuticle oil','Hand cream','Nail care class'],
 'pet-grooming':['Bath and brush','Full grooming','Nail trim','Pet shampoo','Coat brush','Grooming session'],
 'auto-detailing':['Exterior detail','Interior detail','Full detail','Car care kit','Microfiber towels','Detailing workshop'],
 fitness:['Personal training','Fitness assessment','Group training','Water bottle','Training towel','Fitness class'],
 yoga:['Yoga session','Private instruction','Stretching class','Yoga mat','Yoga block','Group yoga'],
 tutoring:['Tutoring session','Study assessment','Exam preparation','Workbook','Study materials','Study group'],
 photography:['Portrait session','Event photography','Consultation','Print package','Photo album','Photography workshop'],
 cleaning:['Standard cleaning','Deep cleaning','Move-out cleaning','Cleaning kit','Microfiber cloth','Cleaning workshop'],
 consulting:['Consultation','Strategy session','Follow-up meeting','Guide','Resource kit','Group consultation'],
 medical:['Initial consultation','Follow-up visit','Assessment','Care guide','Resource kit','Education session'],
 'pet-sitting':['Pet sitting','Overnight care','Meet and greet','Pet care kit','Treat pack','Pet care session']
};
const copyByGroup={
 beauty:{bookingEyebrow:'BOOK YOUR NEXT VISIT',bookingHeadline:'Find your next appointment.',bookingDescription:'Choose a treatment, specialist, and time that works for you.',bookingOwnerLoginLabel:'Business owner sign in',bookingMembershipTitle:'Interested in a care plan?'},
 pets:{bookingEyebrow:'CARE FOR YOUR PET',bookingHeadline:'Book your pet’s next visit.',bookingDescription:'Choose your pet care service, caregiver, and appointment time.',bookingOwnerLoginLabel:'Pet care owner sign in',bookingMembershipTitle:'Explore ongoing pet care'},
 fitness:{bookingEyebrow:'FIND YOUR NEXT SESSION',bookingHeadline:'Reserve your next class or session.',bookingDescription:'Choose a class or coaching session, instructor, and available time.',bookingOwnerLoginLabel:'Fitness business sign in',bookingMembershipTitle:'Explore training memberships'},
 health:{bookingEyebrow:'SCHEDULE A VISIT',bookingHeadline:'Find an available appointment.',bookingDescription:'Select the appointment type, provider, and available time.',bookingOwnerLoginLabel:'Practice owner sign in',bookingMembershipTitle:'Explore care programs'},
 education:{bookingEyebrow:'BOOK A LESSON',bookingHeadline:'Schedule your next lesson.',bookingDescription:'Choose a lesson, educator, and available time.',bookingOwnerLoginLabel:'Education business sign in',bookingMembershipTitle:'Explore learning plans'},
 events:{bookingEyebrow:'PLAN YOUR NEXT EVENT',bookingHeadline:'Reserve a consultation or service.',bookingDescription:'Choose your event service, specialist, and available date.',bookingOwnerLoginLabel:'Event business sign in',bookingMembershipTitle:'Explore service packages'},
 home:{bookingEyebrow:'SCHEDULE A SERVICE',bookingHeadline:'Book your next home service.',bookingDescription:'Choose a service, available professional, and appointment time.',bookingOwnerLoginLabel:'Service business sign in',bookingMembershipTitle:'Explore maintenance plans'},
 automotive:{bookingEyebrow:'BOOK VEHICLE CARE',bookingHeadline:'Schedule your vehicle service.',bookingDescription:'Choose your vehicle service, technician, and available time.',bookingOwnerLoginLabel:'Automotive business sign in',bookingMembershipTitle:'Explore vehicle care plans'},
 professional:{bookingEyebrow:'SCHEDULE A CONSULTATION',bookingHeadline:'Book a professional appointment.',bookingDescription:'Choose a consultation or service, advisor, and available time.',bookingOwnerLoginLabel:'Business owner sign in',bookingMembershipTitle:'Explore service plans'},
 community:{bookingEyebrow:'JOIN AN UPCOMING SESSION',bookingHeadline:'Reserve your next session.',bookingDescription:'Choose an activity, facilitator, and available date.',bookingOwnerLoginLabel:'Organization sign in',bookingMembershipTitle:'Explore ongoing programs'},
 other:{bookingEyebrow:'BOOK YOUR NEXT VISIT',bookingHeadline:'Find your next opening.',bookingDescription:'Choose a service, team member, and available time.',bookingOwnerLoginLabel:'Business owner sign in',bookingMembershipTitle:'Explore memberships'}
};
export function onboardingPreset(industry){
 const group=Object.entries(groups).find(([,ids])=>ids.includes(industry))?.[0]||'other';
 const labels=examples[industry]||({
  beauty:['Consultation','Standard service','Premium service','Care product','Accessory','Group session'],
  pets:['Consultation','Standard pet service','Extended pet service','Pet care item','Accessory','Group session'],
  fitness:['Private session','Assessment','Group class','Equipment','Accessory','Training session'],
  health:['Initial appointment','Follow-up','Consultation','Care resource','Supplies','Educational session'],
  education:['Introductory lesson','Private lesson','Group lesson','Workbook','Learning kit','Workshop'],
  events:['Consultation','Standard package','Premium package','Sample product','Accessory','Workshop'],
  home:['Estimate','Standard service','Extended service','Supply kit','Accessory','Group workshop'],
  automotive:['Inspection','Standard service','Premium service','Care kit','Accessory','Workshop'],
  professional:['Consultation','Standard appointment','Extended appointment','Resource guide','Template kit','Workshop'],
  community:['Introductory meeting','Standard session','Group session','Resource guide','Community kit','Group event'],
  other:['Service example 1','Service example 2','Service example 3','Product example 1','Product example 2','Session example']
 })[group];
 const serviceNames=labels.slice(0,3),productNames=labels.slice(3,5);
 const services=serviceNames.map((name,i)=>({id:'sample-service-'+(i+1),name,category:'Example — edit before publishing',description:'Sample service: update details, duration and price before accepting bookings.',duration:30,price:0,maxSlots:1,requiresApproval:false}));
 const products=productNames.map((name,i)=>({id:'sample-product-'+(i+1),name,price:0,cost:0,stock:0}));
 const staff=[{id:'sample-team-1',name:'Team member 1 (placeholder)',role:'Team member',initials:'TM',color:'blue',services:services.map(s=>s.id),notificationEmail:'',notificationPhone:''}];
 const categoryList=groups[group]||[];
 const categoryPosition=categoryList.indexOf(industry);
 const p=PALETTES[(palette[group]+Math.max(0,categoryPosition)%4)%PALETTES.length];
 return {...copyByGroup[group],services,products,staff,sessionTemplateSuggestions:[labels[5]+' (example — configure before publishing)'],theme:{palette:p.id,bodyFont:'dm',headingFont:'manrope',colors:{...p.colors}},brandPrimary:p.colors.button,brandBackground:p.colors.page};
}
