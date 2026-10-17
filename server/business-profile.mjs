/** Called inside the authenticated business owner's existing transaction. */
export function saveBusinessProfile(client,{owner,name,description,city,region,brandPrimary,brandBackground,businessModel,googleLink}){
 return client.query('UPDATE businesses SET name=$1,description=$2,city=$3,region=$4,listing_requested=FALSE,is_listed=TRUE,brand_primary=COALESCE($6,brand_primary),brand_background=COALESCE($7,brand_background),business_model=COALESCE($8,business_model),google_listing_url=COALESCE($9,google_listing_url),updated_at=now() WHERE owner_id=$5',[name,description,city,region,owner,brandPrimary,brandBackground,businessModel,googleLink]);
}
