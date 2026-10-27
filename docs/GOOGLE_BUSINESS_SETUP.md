# Google business reviews and photos — setup

## Platform administrator: one-time setup

1. In Google Cloud, select the SelahFlow project and enable billing and **Places API (New)**. Create a **server API key**, restrict it to Places API (New), and apply appropriate server/IP restrictions. Never put this key in client JavaScript. Add it to Render as `GOOGLE_PLACES_API_KEY` (existing `GOOGLE_MAPS_API_KEY` is also supported). Set quotas/budgets appropriate to expected traffic; details, reviews and photo calls can be billable.
2. Request Google Business Profile API access for the platform project using Google's official prerequisites workflow. Approval is separate from Gmail OAuth and can take time. Enable **My Business Account Management API** and **My Business Business Information API**. SelahFlow reads account/location metadata, then uses the Place ID with public Places content. It does not need the legacy reviews API.
3. Create a dedicated **Web application** OAuth client for business connections. Configure the consent screen and `https://www.googleapis.com/auth/business.manage`, `openid` and `email` scopes. Complete Google's verification/production requirements. During OAuth testing only explicitly listed test users can authorize; testing-mode refresh tokens can expire. Each business owner must authorize their own managed account.
4. Add exact authorized redirects (keep unrelated Gmail callbacks):
   - `https://selahflow.onrender.com/api/business/google/callback`
   - `https://selahflow-staging.onrender.com/api/business/google/callback`
5. Configure both Render environments separately:
   - `GOOGLE_BUSINESS_CLIENT_ID`
   - `GOOGLE_BUSINESS_CLIENT_SECRET`
   - `GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY`: a securely generated 64-character hexadecimal key. The existing Gmail encryption key is a supported fallback, with distinct business-bound authenticated encryption; a separate key is recommended. Never rotate a key without reauthorizing affected connections.
6. Deploy configuration changes and open owner Branding → Google reviews & photos. Both provider setup indicators must be ready. Configure staging without live customer account authorization first. Do not resume the retired Render service.

## Business owner

1. Sign in to your SelahFlow owner dashboard and open **Branding → Google reviews & photos**.
2. Choose **Connect Google account**, sign in to the account that owns or manages your Google Business Profile, review Google's permissions and approve. SelahFlow only reads locations; it does not edit listings or reply to reviews.
3. On return, select **Load / refresh my Google locations**. Choose your exact business and address, then **Use this Google location**. Only locations with a published Maps Place ID appear. Do not choose a similarly named branch.
4. Alternatively, enter your exact public Google Place ID using Google's official Place ID finder. This supports public display without Business Profile account authorization, but still requires the platform Places key. Saving a Place ID does not prove Google account ownership.
5. Choose **Show Google rating and reviews** and/or **Show Google business photos**, then **Save Google display**.
6. Open your public page, booking page, membership page and Discover results. Google selects the available content (up to five relevant reviews and ten photos). Full review history is linked on Google. Content refreshes on page views and is not stored in SelahFlow's database.
7. **Disconnect Google** removes this business's local token/selected listing and disables its Google display, without affecting other businesses, bookings, payments or platform Gmail. To revoke the dedicated app's Google grant as well, use Google Account → third-party connections; that can affect other business connections authorized through the same Google account/client.

## Troubleshooting

- Missing setup: platform provider credentials/API key have not been configured. The feature does not fabricate reviews/photos.
- `redirect_uri_mismatch`: add the exact callback for the environment where the owner starts authorization.
- No locations / access unavailable: confirm the selected account is a verified profile owner/manager, the project has Business Profile API approval and APIs are enabled. Large account/location sets are bounded in the picker; use the public Place ID option if a location is outside the fetched pages.
- Google authorization expiry/revocation: reconnect the owner's account. Existing Gmail sending credentials are independent.
- Blank content: check Places API enablement, key restrictions, billing, quotas, exact Place ID and whether Google returns public content. Booking remains available when Google is unavailable.

## Primary references

- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/content/implement-oauth
- https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list
- https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations/list
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/policies
