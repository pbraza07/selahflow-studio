# Administrator setup: Google Places UI Kit Essentials

Owners do not need Google OAuth or a Finder ID. An administrator searches for the exact public listing and SelahFlow saves its returned ID. A business still needs a Google listing; zero matches cannot create Google reviews/photos.

1. Open Google Cloud Console and select the SelahFlow production project with billing enabled.
2. Under APIs & Services → Library, enable **Places UI Kit** and **Maps JavaScript API**. Keep **Places API (New)** enabled for administrator searches.
3. Under APIs & Services → Credentials, create a **separate API key** named SelahFlow UI Kit browser key. Do not use the existing server/IP-restricted key in browser code.
4. Edit this new key. Application restrictions: **Websites (HTTP referrers)**. Allow `https://selahflow.onrender.com/*` and any explicitly deployed production custom domains. API restrictions: restrict it to **Places UI Kit** and **Maps JavaScript API**, as available in the console. Save. Keep the search server key restricted to Places API (New) and the service's outbound IP ranges.
5. In Render → selahflow → Environment, add `GOOGLE_PLACES_UI_KIT_BROWSER_KEY` with the new website-restricted browser key. Save and deploy. This key is intentionally visible to website visitors; its website/API restrictions are required. Never put a server key in this variable. Existing Gmail, Stripe and Google Business OAuth settings are unchanged.
6. Sign into SelahFlow as the **primary platform administrator**. Open `/admin/platform`, then **Google listings, reviews & photos**.
7. Select a business, search its name and city/address, inspect the returned listings and open Check on Google Maps. Select only the matching listing. Service-area businesses without storefronts are included. Confirm the match, choose photo/review display and click **Save Google listing & display**. No owner steps or manual Place ID entry.
8. Open Discover and the business's public, booking and membership pages. Cards use the standard compact component with photo/rating; full pages can show review text. Google controls available content. Widgets load when visible. The implementation uses Essentials components, without a dynamic map or Advanced/Pro elements.
9. If lookup finds nothing, try the listing's exact public name and service city. If Google has no published listing, use a Google Maps link or business-supplied image until one exists. A Maps URL alone does not manufacture an ID or reviews.
10. In Google Cloud billing, set budget alerts and inspect API quotas. Budgets are alerts, not hard spending caps. Essentials currently has a shared monthly free allowance; it is not per business or per visitor. Each displayed component may trigger a request, and administrator Text Search is billed separately under Places API. Refer to the current official pricing page rather than assuming all traffic is free.
11. Use a separate Google Cloud project and browser key for staging, restricted to `https://selahflow-staging.onrender.com/*`. Add the staging key only to the staging service, then deploy and verify there.

Without the dedicated browser key, SelahFlow retains its existing Places API display, including its existing billing behavior. A configured key is not proof that provider APIs/restrictions work; test the real widget. UI Kit errors fall back to a Google Maps link rather than automatically invoking more paid server requests.

References:
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/get-started
- https://developers.google.com/maps/documentation/javascript/places-ui-kit/place-details
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/billing-and-pricing/pricing
