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
 'pet-sitting':['Pet sitting','Overnight care','Meet and greet','Pet care kit','Treat pack','Pet care session'],
 'lashes':["Classic lash extensions","Lash refill","Lash removal","Lash cleanser","Lash brush","Lash styling workshop"],
 'brows':["Brow shaping","Brow tint","Brow lamination","Brow serum","Brow brush","Brow artistry workshop"],
 'makeup':["Event makeup","Bridal makeup trial","Makeup lesson","Setting spray","Makeup brush kit","Makeup masterclass"],
 'skin-care':["Signature facial","Acne consultation","Hydrating treatment","Facial cleanser","Moisturizer","Skin care workshop"],
 'spa':["Spa day package","Body scrub","Relaxation treatment","Bath salts","Body lotion","Wellness retreat"],
 'massage':["Swedish massage","Deep tissue massage","Sports massage","Massage oil","Aromatherapy balm","Stretching clinic"],
 'wellness':["Wellness consultation","Mindfulness session","Holistic coaching","Wellness journal","Aromatherapy kit","Mindfulness circle"],
 'tattoo':["Tattoo consultation","Small tattoo","Tattoo touch-up","Aftercare balm","Skin cleanser","Tattoo design workshop"],
 'piercing':["Ear piercing","Nose piercing","Jewelry change","Aftercare spray","Piercing jewelry","Piercing care class"],
 'tanning':["Spray tan","Tan touch-up","Tanning consultation","Tan extender","Exfoliating mitt","Tanning care workshop"],
 'waxing':["Eyebrow wax","Leg waxing","Full body wax","Post-wax lotion","Exfoliating scrub","Waxing care class"],
 'dog-training':["Puppy obedience","Behavior consultation","Private dog training","Training clicker","Training leash","Puppy socialization class"],
 'veterinary':["Wellness exam","Vaccination visit","Follow-up examination","Pet care guide","Pet first aid kit","Pet wellness seminar"],
 'sports-coaching':["Skills assessment","Private sports coaching","Team training","Training cones","Sports water bottle","Skills development camp"],
 'dance':["Private dance lesson","Beginner dance class","Dance choreography","Dance shoes","Practice accessories","Dance workshop"],
 'martial-arts':["Introductory martial arts class","Private martial arts lesson","Belt skills practice","Training uniform","Practice pads","Self-defense seminar"],
 'swimming':["Swim assessment","Private swim lesson","Group swim lesson","Swim goggles","Swim cap","Water safety workshop"],
 'dental':["Dental consultation","Cleaning appointment","Follow-up dental visit","Dental care kit","Floss pack","Oral hygiene education"],
 'mental-health':["Initial counseling session","Individual therapy","Follow-up counseling","Wellbeing workbook","Reflection journal","Wellness education group"],
 'physical-therapy':["Physical therapy evaluation","Rehabilitation session","Mobility assessment","Resistance band","Exercise guide","Mobility class"],
 'chiropractic':["Chiropractic consultation","Adjustment appointment","Posture evaluation","Posture guide","Foam roller","Posture education workshop"],
 'nutrition':["Nutrition consultation","Meal planning session","Nutrition follow-up","Meal planner","Recipe guide","Nutrition education class"],
 'music-lessons':["Instrument introduction","Private music lesson","Music theory session","Sheet music","Practice notebook","Music ensemble workshop"],
 'art-lessons':["Drawing lesson","Painting lesson","Portfolio review","Sketchbook","Art supplies","Group art workshop"],
 'language-lessons':["Language assessment","Conversation lesson","Grammar lesson","Vocabulary workbook","Flashcard set","Conversation club"],
 'test-prep':["Practice test review","Exam coaching","Study strategy session","Practice exam booklet","Study planner","Exam preparation workshop"],
 'career-coaching':["Career consultation","Resume review","Interview coaching","Career workbook","Resume template kit","Career development workshop"],
 'videography':["Video project consultation","Event filming","Video editing session","Video storyboard","Production checklist","Videography workshop"],
 'event-planning':["Event planning consultation","Vendor coordination","Event timeline review","Planning workbook","Event checklist","Event planning workshop"],
 'wedding-services':["Wedding consultation","Ceremony planning","Wedding day coordination","Wedding planner","Ceremony checklist","Wedding planning workshop"],
 'florist':["Custom bouquet consultation","Floral arrangement","Event floral design","Flower care kit","Decorative vase","Floral design workshop"],
 'catering':["Catering consultation","Menu tasting","Event catering planning","Menu guide","Serving kit","Catering workshop"],
 'personal-chef':["Private chef consultation","Meal preparation","Dinner party service","Recipe collection","Meal prep kit","Cooking class"],
 'housekeeping':["Routine housekeeping","Deep housekeeping","Laundry service","Household supply kit","Cleaning cloths","Household care workshop"],
 'landscaping':["Lawn maintenance","Landscape consultation","Garden installation","Gardening gloves","Plant care kit","Gardening workshop"],
 'handyman':["Home repair assessment","Fixture installation","General repair visit","Repair materials kit","Basic tool kit","Home maintenance workshop"],
 'plumbing':["Plumbing inspection","Leak repair","Fixture replacement","Drain care kit","Plumbing maintenance guide","Home plumbing workshop"],
 'electrical':["Electrical inspection","Outlet installation","Lighting repair","Electrical safety guide","Cable organizer","Electrical safety seminar"],
 'hvac':["HVAC inspection","AC maintenance","Heating repair","Air filter","Thermostat guide","HVAC maintenance workshop"],
 'painting':["Painting estimate","Interior painting","Exterior painting","Paint sample kit","Painter tape","Painting workshop"],
 'pest-control':["Pest inspection","Pest treatment","Preventive pest visit","Prevention guide","Sealing kit","Pest prevention seminar"],
 'pool-service':["Pool cleaning","Water quality test","Pool equipment inspection","Pool test strips","Pool care guide","Pool maintenance workshop"],
 'home-organizing':["Home organization consultation","Closet organization","Garage organization","Storage bins","Label set","Organization workshop"],
 'moving':["Moving estimate","Packing service","Moving assistance","Moving boxes","Packing tape","Moving preparation workshop"],
 'auto-repair':["Vehicle diagnostic","Oil change","Brake inspection","Car maintenance guide","Wiper blades","Auto care workshop"],
 'car-wash':["Exterior car wash","Interior cleaning","Premium car wash","Car shampoo","Drying towel","Car wash care workshop"],
 'mobile-mechanic':["Mobile vehicle diagnostic","On-site oil change","Mobile brake inspection","Emergency car kit","Maintenance guide","Vehicle care workshop"],
 'bike-repair':["Bike tune-up","Brake adjustment","Flat tire repair","Bike lubricant","Tire repair kit","Bike maintenance workshop"],
 'accounting':["Bookkeeping consultation","Monthly bookkeeping","Financial statement review","Ledger template","Accounting guide","Bookkeeping workshop"],
 'tax-preparation':["Tax intake appointment","Tax return preparation","Tax planning consultation","Tax checklist","Tax organizer","Tax preparation workshop"],
 'financial-planning':["Financial planning consultation","Retirement planning session","Budget review","Budget template","Planning workbook","Financial education seminar"],
 'legal':["Legal consultation","Document review","Case strategy session","Document organizer","Legal information guide","Legal education seminar"],
 'notary':["Document notarization","Mobile notary visit","Multiple document signing","Document folder","Signing checklist","Notary information session"],
 'insurance':["Insurance consultation","Policy review","Coverage comparison","Coverage checklist","Policy organizer","Insurance education workshop"],
 'real-estate':["Buyer consultation","Seller consultation","Property tour","Homebuyer guide","Property checklist","Homebuyer workshop"],
 'property-management':["Rental consultation","Property inspection","Tenant onboarding","Inspection checklist","Tenant welcome kit","Property management workshop"],
 'it-support':["Computer diagnostics","Remote IT support","Network setup","Computer care guide","Cable kit","Technology basics workshop"],
 'cybersecurity':["Security assessment","Security consultation","Awareness training","Security checklist","Incident response template","Cybersecurity awareness workshop"],
 'marketing':["Marketing consultation","Campaign planning","Brand strategy session","Content calendar","Campaign template","Marketing workshop"],
 'web-design':["Website consultation","Website design","Site maintenance","Website planning guide","Design template","Website design workshop"],
 'graphic-design':["Logo consultation","Brand design","Print design","Brand style guide","Design template kit","Graphic design workshop"],
 'virtual-assistant':["Administrative consultation","Calendar management","Inbox organization","Task planner","Workflow template","Productivity workshop"],
 'translation':["Translation consultation","Document translation","Interpretation session","Language glossary","Document checklist","Language services workshop"],
 'travel-planning':["Travel consultation","Itinerary planning","Group travel planning","Travel checklist","Itinerary template","Travel planning workshop"],
 'rentals':["Rental consultation","Equipment reservation","Venue reservation","Rental checklist","Care instructions","Rental orientation session"],
 'subscription-services':["Membership consultation","Subscription setup","Member support appointment","Member welcome guide","Subscription planner","Member orientation"],
 'nonprofit':["Volunteer orientation","Community consultation","Program registration","Volunteer guide","Resource kit","Community workshop"],
 'religious':["Pastoral consultation","Community gathering","Spiritual guidance session","Reflection journal","Study guide","Community fellowship"]
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
 const displayName=industry.replace(/-/g,' ');
 const bookingLabels={...copyByGroup[group],bookingHeadline:'Book your '+displayName+' appointment.',bookingDescription:'Choose from '+serviceNames.map(x=>x.toLowerCase()).join(', ')+' and select an available time.',bookingMembershipTitle:'Explore '+displayName+' plans'};
 const allCategories=Object.values(groups).flat();
 const uniquePaletteIndex=allCategories.indexOf(industry);

 const services=serviceNames.map((name,i)=>({id:'sample-service-'+(i+1),name,category:'Example — edit before publishing',description:'Sample service: update details, duration and price before accepting bookings.',duration:30,price:0,maxSlots:1,requiresApproval:false}));
 const products=productNames.map((name,i)=>({id:'sample-product-'+(i+1),name,price:0,cost:0,stock:0}));
 const staff=[{id:'sample-team-1',name:'Team member 1 (placeholder)',role:'Team member',initials:'TM',color:'blue',services:services.map(s=>s.id),notificationEmail:'',notificationPhone:''}];
 const categoryList=groups[group]||[];
 const categoryPosition=categoryList.indexOf(industry);
 const p=PALETTES[uniquePaletteIndex<0?0:uniquePaletteIndex%PALETTES.length];
 return {...bookingLabels,services,products,staff,sessionTemplateSuggestions:[labels[5]+' (example — configure before publishing)'],theme:{palette:p.id,bodyFont:'dm',headingFont:'manrope',colors:{...p.colors}},brandPrimary:p.colors.button,brandBackground:p.colors.page};
}
