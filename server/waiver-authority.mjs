import {supportActor} from './platform-support.mjs';
import {getPlatformRole} from './platform-roles.mjs';
export async function canReviewWaivers(pool,req){
 try{const actor=await supportActor(pool,req);return !!await getPlatformRole(pool,actor.id);}catch{return false;}
}
export async function assertWaiverAuthority(pool,req,previous,next){
 const changed=['categoryWaiver','waiverLegalReview'].some(key=>JSON.stringify(previous[key]??null)!==JSON.stringify(next[key]??null));
 if(changed&&!await canReviewWaivers(pool,req))throw Error('Only a platform administrator can change waiver templates, record legal review or activate them.');
}
