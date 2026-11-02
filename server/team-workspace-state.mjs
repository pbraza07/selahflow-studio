export function workspaceAllowed(a,now=Date.now()){
 return !Number(a.workspace_fee_cents||0)||(!a.workspace_risk_hold&&new Date(a.workspace_paid_through||0).getTime()>now);
}
export function workspaceSummary(a){return {feeCents:Number(a.workspace_fee_cents||0),interval:a.workspace_interval||'month',version:a.workspace_price_version||1,status:a.workspace_billing_status||'free',paidThrough:a.workspace_paid_through||null,allowed:workspaceAllowed(a),riskHold:!!a.workspace_risk_hold,hasSubscription:!!a.workspace_subscription_id,canCreateSessions:a.can_create_sessions!==false};}
export function assertWorkspace(a){if(!workspaceAllowed(a))throw Object.assign(Error('Workspace payment is due. Open your workspace to pay or contact the business owner.'),{status:402});}
