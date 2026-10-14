export const MEMBERSHIP_BADGE_ICONS=[['badge','Badge'],['star','Star'],['crown','Crown'],['medal','Medal'],['gem','Gem'],['shield','Shield'],['graduation','Graduation cap'],['heart','Heart'],['trophy','Trophy'],['users','Group']];
export function validateMembershipBadge(value){
 if(value===undefined||value===null)return null;
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['label','color','icon','shape'].includes(k)))throw Error('Choose valid membership badge settings.');
 const label=typeof value.label==='string'?value.label.trim():'';
 if(typeof value.label!=='string'||label.length>60||/[\u0000-\u001f<>]/.test(label)||typeof value.color!=='string'||!/^#[0-9a-f]{6}$/i.test(value.color)||!MEMBERSHIP_BADGE_ICONS.some(([id])=>id===value.icon)||!['pill','rounded'].includes(value.shape))throw Error('Enter a badge label up to 60 characters and choose a valid color, icon and shape.');
 return {label,color:value.color.toUpperCase(),icon:value.icon,shape:value.shape};
}
export function resolveMembershipBadge(planBadge,typeBadge){
 for(const badge of [planBadge,typeBadge]){try{const valid=validateMembershipBadge(badge);if(valid)return valid;}catch{}}
 return null;
}
