/** Platform-admin business management validation; never reuse this for public signup. */
export const BUSINESS_STATES=['active','pending','suspended','rejected','archived'];
export const NAME=/^[\s\S]{2,100}$/,SLUG=/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;
export function validateManagedBusiness(input,industries,states){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Enter a valid business profile.');
 const name=String(input.name||'').trim(),slug=String(input.slug||'').trim().toLowerCase();
 const industry=String(input.industry||'other'),description=String(input.description||'').trim();
 const city=String(input.city||'').trim(),region=String(input.region||'').trim();
 if(!NAME.test(name)||!/^[^<>\u0000-\u001f]{2,100}$/.test(name))throw Error('Business name must contain 2–100 valid characters.');
 if(!SLUG.test(slug))throw Error('Enter a valid booking URL slug (3–60 lowercase letters, numbers or hyphens).');
 if(!industries.includes(industry))throw Error('Choose a valid business category.');
 if(description.length>600||/[<>\u0000-\u001f]/.test(description))throw Error('Description must be 600 characters or fewer.');
 if(city.length>80||/[<>\u0000-\u001f]/.test(city))throw Error('Enter a valid city.');
 if(region.length>80||/[<>\u0000-\u001f]/.test(region))throw Error('Enter a valid state or region.');
 return {name,slug,industry,description,city,region};
}
export function canChangeManagedStatus(role,prior,next){
 if(!BUSINESS_STATES.includes(next))return false;
 if(prior===next)return true;
 if(prior==='archived')return next==='suspended'||next==='active';
 if(next==='archived')return false; // requires explicit archive with safety checks
 if(['pending','rejected'].includes(prior)&&next==='active')return role==='primary';
 if(next==='pending'||next==='rejected')return role==='primary';
 return true;
}
export function canArchiveBusiness({members=0,subscribed=false}){
 return Number(members)<=0&&subscribed!==true;
}

export function validateOwnerLoginEmail(input){
 if(typeof input!=='string')throw Error('Enter a valid owner login email.');
 const email=input.trim().toLowerCase();
 if(email.length<5||email.length>254||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||
    /[\u0000-\u001f\u007f]/.test(email))throw Error('Enter a valid owner login email.');
 return email;
}
export function validateEmailChangeConfirmation({confirmName,expectedEmail,newEmail},businessName,registeredEmail){
 if(confirmName!==businessName)throw Error('Confirm the exact business name before changing the owner login.');
 const current=validateOwnerLoginEmail(registeredEmail);
 if(typeof expectedEmail!=='string'||validateOwnerLoginEmail(expectedEmail)!==current)
  throw Error('Owner email has changed. Refresh the business directory before trying again.');
 const next=validateOwnerLoginEmail(newEmail);
 if(next===current)throw Error('The new login email must differ from the current email.');
 return {oldEmail:current,newEmail:next};
}
