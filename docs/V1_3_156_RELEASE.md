# v1.3.156 release handoff — Google business connection, reviews and photos

Adds tenant-scoped Google Business Profile OAuth under Branding → Google reviews & photos. Owners connect their own account, refresh managed locations, select the exact Google Place ID, control public reviews/photos and disconnect. Dedicated OAuth client configuration keeps platform Gmail authorization separate; encrypted tokens bind to business/purpose, state binds owner/business/session with PKCE and expiry. API actions only read Google data; publication settings affect SelahFlow.

Public Google Places displays exact-listing ratings/review counts, up to five original reviews with reviewer/source attribution, and up to ten photos. Discovery cards lazy-load rating/photo summaries; business, booking and membership pages share the complete display. No persistent Google review/photo cache. Legacy listing-link photo behavior remains, but reviews require explicit Place ID selection. New additive migration 062 stores only connection/publication configuration. Existing booking, payment, email and customer data are preserved. Old Render service remains suspended with auto-deploy off.

External setup remains required: Google Places API (New) and server key with billing, a dedicated Google Business OAuth client with business.manage scope, approved Business Profile API access, and Account Management / Business Information APIs. Production callback https://selahflow.onrender.com/api/business/google/callback; staging callback https://selahflow-staging.onrender.com/api/business/google/callback. Google Cloud Console remains unavailable to this browser; real owner authorization and real Google content are not yet verified. See docs/GOOGLE_BUSINESS_SETUP.md.

Validation/deployment pending; no real Google connection, public listing selection, charge or email is created for QA.

