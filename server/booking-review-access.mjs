/** Workspace approvals follow the assigned team member; legacy links retain their reviewer scope. */
export async function assertRequestReviewer(db,row,reviewer,teamAccountId=/** @type {string|null} */ (null)){
 if(teamAccountId){
  if(row.staff_id!==reviewer)throw Error('This booking is assigned to another team member.');
  const account=(await db.query("SELECT a.id,s.data AS settings_data FROM team_accounts a JOIN businesses b ON b.id=a.business_id JOIN settings s ON s.owner=b.owner_id WHERE a.id=$1 AND a.staff_id=$2 AND a.business_id=$3 AND b.owner_id=$4 AND b.status='active' AND a.active=true AND a.must_change_password=false",[teamAccountId,reviewer,row.business_id,row.owner_id])).rows[0];
  if(!account||!JSON.parse(account.settings_data||'{}').staff?.some(s=>s.id===reviewer))throw Error('Team access changed. Sign in again.');
  return;
 }
 if(reviewer!=='owner'&&row.reviewer!==reviewer)throw Error('This request is assigned to another reviewer.');
}
