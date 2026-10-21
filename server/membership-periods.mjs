/** Month arithmetic clamps short months without drifting the original anniversary day. */
export function anniversary(anchor,offset){const d=new Date(anchor);if(!Number.isFinite(d.getTime()))throw Error('Invalid membership start date.');const y=d.getUTCFullYear(),m=d.getUTCMonth()+offset,day=d.getUTCDate();const r=new Date(Date.UTC(y,m,1,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()));r.setUTCDate(Math.min(day,new Date(Date.UTC(r.getUTCFullYear(),r.getUTCMonth()+1,0)).getUTCDate()));return r;}
export function monthlyPeriod(anchor,at=new Date()){
 const a=new Date(anchor),now=new Date(at);let n=Math.max(0,(now.getUTCFullYear()-a.getUTCFullYear())*12+now.getUTCMonth()-a.getUTCMonth());if(anniversary(a,n)>now)n=Math.max(0,n-1);return {start:anniversary(a,n),end:anniversary(a,n+1)};
}
export async function refreshMemberPeriod(db,member,at=new Date()){
 if(!member.initial_paid_at||!member.credit_period_end)return member;
 const now=new Date(at);
 if(member.paid_through&&new Date(member.paid_through)<=now){await db.query("UPDATE customer_memberships SET status='expired',updated_at=now() WHERE id=$1 AND business_id=$2 AND status='active'",[member.id,member.business_id]);return {...member,status:member.status==='active'?'expired':member.status};}
 if(member.status!=='active'||new Date(member.credit_period_end)>now)return member;
 const anchor=member.billing_start_override?new Date((member.billing_start_override instanceof Date?member.billing_start_override.toISOString():String(member.billing_start_override)).slice(0,10)+'T12:00:00Z'):member.initial_paid_at;
 const period=monthlyPeriod(anchor,now),credits=Number(member.monthly_sessions??member.stripe_sessions_per_period??0);
 await db.query('INSERT INTO membership_credit_periods(business_id,membership_id,period_start,period_end,sessions_included,sessions_used) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[member.business_id,member.id,member.credit_period_start,member.credit_period_end,member.sessions_included,member.sessions_used]);
 await db.query('UPDATE customer_memberships SET sessions_included=$1,sessions_used=0,credit_period_start=$2,credit_period_end=$3,updated_at=now() WHERE id=$4 AND business_id=$5',[credits,period.start.toISOString(),period.end.toISOString(),member.id,member.business_id]);
 return {...member,sessions_included:credits,sessions_used:0,credit_period_start:period.start,credit_period_end:period.end};
}
export async function refreshMembershipPeriods(pool){const db=await pool.connect();try{await db.query('BEGIN');const rows=(await db.query("SELECT * FROM customer_memberships WHERE status='active' AND initial_paid_at IS NOT NULL AND (credit_period_end<=now() OR paid_through<=now()) FOR UPDATE SKIP LOCKED LIMIT 100")).rows;for(const m of rows)await refreshMemberPeriod(db,m);await db.query('COMMIT');return rows.length;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
