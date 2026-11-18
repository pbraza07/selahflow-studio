import {recordsSheet} from './export-records.mjs';
import {loadMembershipReportPayments,reportSaleEvents,reconcileStripeBookingReceipts} from './report-payments.mjs';
import {visibleReportPayments} from './report-reset.mjs';
const parse=value=>typeof value==='string'?JSON.parse(value||'{}'):value||{};
/** Owner and business come exclusively from the authenticated server context.
 * No UI pagination limit: export includes every record in the selected business. */
export async function businessExportSheets(db,owner,business,settings){
 const definitions=[
  ['Membership plans','SELECT * FROM membership_plans WHERE business_id=$1 ORDER BY created_at,id',[business.id]],
  ['Memberships and packages','SELECT * FROM customer_memberships WHERE business_id=$1 ORDER BY created_at,id',[business.id]],
  ['Membership credits','SELECT * FROM membership_session_ledger WHERE business_id=$1 ORDER BY created_at,id',[business.id]],
  ['Coupons','SELECT * FROM business_coupons WHERE business_id=$1 ORDER BY created_at,id',[business.id]],
  ['Products','SELECT id,name,description,price_cents,tax_code,archived,created_at,updated_at,(image IS NOT NULL) AS has_image FROM business_products WHERE business_id=$1 ORDER BY created_at,id',[business.id]],
  ['Product orders','SELECT * FROM product_orders WHERE business_id=$1 AND submitted_at IS NOT NULL ORDER BY created_at,id',[business.id]],
  ['Booking requests','SELECT id,date,staff_id,start_minute,duration,details,status,created_at,reviewed_at,appointment_id FROM booking_requests WHERE owner_id=$1 ORDER BY created_at,id',[owner]],
  ['Appointments','SELECT id,date,start,duration,staff,status,data FROM appointments WHERE owner=$1 ORDER BY date,start,id',[owner]],
  ['Payments',"SELECT id,created,kind,data FROM events WHERE owner=$1 AND kind IN ('cash_sale','membership_payment') ORDER BY created,id",[owner]],
  ['Commissions','SELECT * FROM first_customer_commissions WHERE business_id=$1 ORDER BY created_at,id',[business.id]],
  ['Waivers','SELECT * FROM participation_waivers WHERE business_id=$1 AND deleted_at IS NULL ORDER BY signed_at,id',[business.id]],
  ['Service enrollments','SELECT * FROM service_enrollments WHERE business_id=$1 ORDER BY created_at,id',[business.id]],
  ['Service payment audit','SELECT * FROM service_payment_audit WHERE business_id=$1 ORDER BY created_at,id',[business.id]]
 ];
 const sheets=[];
 for(const [name,sql,params] of definitions){
  let rows=(await db.query(sql,params)).rows.map(row=>{
   const {data,details,...rest}=row;
   return {...rest,...(data?{details:parse(data)}:{}),...(details?{details:parse(details)}:{})};
  });
  if(name==='Payments'){
   const sales=rows.filter(r=>r.kind==='cash_sale').map(({details,...r})=>({...details,...r}));
   const receipts=await reconcileStripeBookingReceipts(db,owner,sales);
   const members=await loadMembershipReportPayments(db,owner);
   rows=await visibleReportPayments(db,owner,[...reportSaleEvents([...sales,...receipts],settings.services||[]),...members]);
  }
  sheets.push(recordsSheet(name,rows,['Id']));
 }
 for(const [name,key] of [['Services','services'],['Bookable sessions','bookableSessions'],['Team members','staff'],['Booking questions','bookingCustomFields'],['Time off','teamTimeOff'],['Blockouts','blockouts']])
  sheets.push(recordsSheet(name,settings[key]||[],['Id']));
 return sheets;
}
