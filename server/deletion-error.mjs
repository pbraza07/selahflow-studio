/** Safe explanation for the known free-membership receipt retention failure. */
export function deletionErrorMessage(error){
 if(error?.constraint==='stripe_payment_receipts_amount_cents_check'||String(error?.message||'').includes('stripe_payment_receipts_amount_cents_check'))
  return 'Deletion was blocked while retaining a $0 membership receipt. No local records were deleted. The database update must finish before retrying.';
 return null;
}
