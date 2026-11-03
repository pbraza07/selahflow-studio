import {createHash} from 'node:crypto';
export const commissionIdentityDigest=(salt,business,key)=>createHash('sha256').update(salt+'|'+business+'|'+key).digest('hex');
export function commissionEmail(value){const s=String(value||'').trim().toLowerCase();return s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:'';}
export function commissionPhone(value){
 let s=String(value||'').trim();if(s.length>50||!/^[+0-9().\s-]+$/.test(s))return '';
 s=s.replace(/[().\s-]/g,'');if(s.startsWith('00'))s='+'+s.slice(2);
 if(/^\d{10}$/.test(s))s='+1'+s;else if(/^1\d{10}$/.test(s))s='+'+s;
 return /^\+[1-9]\d{7,14}$/.test(s)?s:'';
}
const nameKey=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/’/g,"'").trim().replace(/\s+/g,' ');
const birth=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))?String(s):'';
const contacts=r=>[['email',commissionEmail(r.email)],['phone',commissionPhone(r.phone)]].filter(([,v])=>v);

/** Called in the payment transaction. Supporting contacts never establish a new identity by themselves. */
export async function commissionContactEvidence(db,{businessId,memberNumber,identityKey,policy}){
 const digest=commissionIdentityDigest(policy.identity_salt,businessId,identityKey);
 const expand=async seeds=>(await db.query('WITH RECURSIVE linked(digest) AS (SELECT unnest($2::text[]) UNION SELECT l.target_digest FROM commission_identity_links l JOIN linked x ON x.digest=l.identity_digest WHERE l.business_id=$1) SELECT digest FROM linked ORDER BY digest',[businessId,seeds])).rows.map(r=>r.digest);
 const result={digests:await expand([digest]),memberNumbers:[memberNumber]};
 const rows=(await db.query(`SELECT p.name,p.email,p.phone,p.date_of_birth::text AS dob,0 AS priority FROM business_client_profiles p JOIN businesses b ON b.owner_id=p.owner WHERE b.id=$1 AND p.member_number=$2 AND p.deleted_at IS NULL
 UNION ALL SELECT first_name||' '||last_name,email,phone,date_of_birth::text,1 FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2
 UNION ALL SELECT customer_name,customer_email,customer_phone,date_of_birth::text,2 FROM customer_memberships WHERE business_id=$1 AND member_number=$2 ORDER BY priority`,[businessId,memberNumber])).rows;
 if(!rows.length)return result;
 const name=nameKey(rows[0].name),dob=birth(rows[0].dob);if(!name)return result;
 const hash=(kind,value)=>createHash('sha256').update(policy.identity_salt+'|'+businessId+'|contact-evidence|'+kind+'|'+value).digest('hex');
 const current=rows.filter(r=>nameKey(r.name)===name&&(!dob||!birth(r.dob)||dob===birth(r.dob)));
 const pairs=[...new Map(current.flatMap(contacts).map(pair=>[pair.join('|'),pair])).values()];if(!pairs.length)return result;
 const nameDigest=hash('name',name),birthDigest=dob?hash('birth',dob):'';
 // Serialize alternative IDs using the same corroborated contact. Sorted locks avoid alias-order deadlocks.
 const keys=pairs.map(([kind,value])=>hash(kind,value)).sort();
 for(const key of keys)await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[businessId+':commission-contact:'+nameDigest+':'+key]);
 const emails=pairs.filter(([k])=>k==='email').map(([,v])=>v),phones=pairs.filter(([k])=>k==='phone').flatMap(([,v])=>{const digits=v.slice(1);return v.startsWith('+1')?[digits,digits.slice(1),'00'+digits]:[digits,'00'+digits];});
 const candidates=(await db.query(`SELECT r.member_number,r.identity_key,p.name,p.email,p.phone,p.date_of_birth::text AS dob FROM business_client_profiles p JOIN businesses b ON b.owner_id=p.owner JOIN business_member_ids r ON r.business_id=b.id AND r.member_number=p.member_number AND r.retired_at IS NULL WHERE b.id=$1 AND p.deleted_at IS NULL AND (lower(btrim(p.email))=ANY($2::text[]) OR regexp_replace(p.phone,'[^0-9]','','g')=ANY($3::text[]))
 UNION ALL SELECT r.member_number,r.identity_key,c.first_name||' '||c.last_name,c.email,c.phone,c.date_of_birth::text FROM customer_booking_ids c JOIN business_member_ids r ON r.business_id=c.business_id AND r.member_number=c.member_number AND r.retired_at IS NULL WHERE c.business_id=$1 AND (lower(btrim(c.email))=ANY($2::text[]) OR regexp_replace(c.phone,'[^0-9]','','g')=ANY($3::text[]))
 UNION ALL SELECT r.member_number,r.identity_key,m.customer_name,m.customer_email,m.customer_phone,m.date_of_birth::text FROM customer_memberships m JOIN business_member_ids r ON r.business_id=m.business_id AND r.member_number=m.member_number AND r.retired_at IS NULL WHERE m.business_id=$1 AND (lower(btrim(m.customer_email))=ANY($2::text[]) OR regexp_replace(m.customer_phone,'[^0-9]','','g')=ANY($3::text[]))`,[businessId,emails,phones])).rows.filter(r=>nameKey(r.name)===name&&contacts(r).some(([k,v])=>pairs.some(([ck,cv])=>k===ck&&v===cv))&&(!dob||!birth(r.dob)||dob===birth(r.dob)));
 const saved=(await db.query('SELECT identity_digest,birth_digest FROM commission_contact_evidence WHERE business_id=$1 AND name_digest=$2 AND contact_digest=ANY($3::text[])',[businessId,nameDigest,keys])).rows.filter(r=>!dob||!r.birth_digest||r.birth_digest===birthDigest);
 const candidateDigests=[...new Set([...candidates.map(r=>commissionIdentityDigest(policy.identity_salt,businessId,r.identity_key)),...saved.map(r=>r.identity_digest)])];
 const retainedBirths=(await db.query("SELECT DISTINCT identity_digest,birth_digest FROM commission_contact_evidence WHERE business_id=$1 AND identity_digest=ANY($2::text[]) AND birth_digest<>''",[businessId,candidateDigests])).rows;
 const compatibleCandidates=candidates.filter(r=>!dob||!retainedBirths.some(p=>p.identity_digest===commissionIdentityDigest(policy.identity_salt,businessId,r.identity_key)&&p.birth_digest!==birthDigest));
 const compatibleSaved=saved.filter(r=>!dob||!retainedBirths.some(p=>p.identity_digest===r.identity_digest&&p.birth_digest!==birthDigest));
 // A missing birth date cannot choose between multiple known people with the same name/contact.
 const knownBirths=new Set([...compatibleCandidates.filter(r=>birth(r.dob)).map(r=>hash('birth',birth(r.dob))),...retainedBirths.map(r=>r.birth_digest),...saved.map(r=>r.birth_digest).filter(Boolean)]);
 if(!dob&&knownBirths.size>1){result.ambiguous=true;return result;}
 result.digests=await expand([...new Set([...result.digests,...compatibleCandidates.map(r=>commissionIdentityDigest(policy.identity_salt,businessId,r.identity_key)),...compatibleSaved.map(r=>r.identity_digest)])]);
 result.memberNumbers=[...new Set([memberNumber,...compatibleCandidates.map(r=>r.member_number)])];
 // Retain only business-salted hashes for future duplicate-fee checks, never raw contact data.
 const recordedBirth=birthDigest||(knownBirths.size===1?[...knownBirths][0]:'');
 for(const [kind,value] of pairs)await db.query('INSERT INTO commission_contact_evidence(business_id,identity_digest,contact_type,contact_digest,name_digest,birth_digest) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[businessId,digest,kind,hash(kind,value),nameDigest,recordedBirth]);
 // Preserve established links when this client later updates their contact details.
 for(const target of result.digests.filter(d=>d!==digest))await db.query('INSERT INTO commission_identity_links(business_id,identity_digest,target_digest) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[businessId,digest,target]);
 return result;
}
