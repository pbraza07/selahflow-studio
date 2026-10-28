# Shared language and navigation audit — v1.3.166

The review covers the public homepage/discovery and audience pages, sign-in/sign-up, business landing pages, booking/service/time/review and receipt flows, membership registration/payment and status, client booking details, owner dashboard/schedule/clients/services/memberships/sales/reports/history/settings/branding/assistant/security, shared forms and page editors, generic fallback configuration, onboarding instructions and shared server-facing error messages.

| Surface | Issue addressed | Result |
| --- | --- | --- |
| Fallback catalogs, demo content and onboarding chrome | Salon, haircut, stylist and barber assumptions; barber selected by default | Generic business/service/team examples and an Other default; selected-industry catalog examples remain meaningful |
| Shared client/owner forms and errors | Players, coaches, studio and cleanup assumptions | Clients, team members, business/workspace and preparation time |
| Returning-client registration | Membership ID wording implied a membership was needed to book or check status | Client ID, with membership-ID alias explained; optional for a first booking; identity rules and customized question labels retained |
| Status results | Clients without memberships were shown a zero-session balance | Booking details remain visible without inventing a membership balance |
| Public navigation | Client booking and owner sign-in were mixed; desktop/mobile menus differed | Shared destinations for discovery/help and clearly named business access/plans; privacy remains on both menus and footer |
| Individual-business navigation | Vague Overview/session/registration wording | Business home, Book a service, Memberships, Booking & membership status, discovery and visibly separate owner sign-in |
| Status navigation | A hash link could fail from a later booking step | Explicit status view returns to the status checker, including repeated navigation |
| Owner workspace | Catalog, configuration and reports mixed under broad labels | Four task groups, twelve preserved destinations, clear display labels and familiar search aliases |
| Owner shortcuts | Edit catalog opened generic Settings; profile shortcut left the support workspace | Edit services opens the catalog category; profile editing stays in the current workspace |
| Booking-details recovery | No selected booking could leave an indefinite loading state | Clear empty state and business-discovery recovery path |
| Payment and booking instructions | Physical-location assumptions and blanket “not connected” wording | Payment arrangement/status guidance and explicit distinction between cash recording and Stripe setup |
| Responsive navigation | More descriptive labels need space | Tablet/mobile menu breakpoints, wrapped business headers, current-page indicators and touch-size controls retained |

## Content and behavior retained

- Saved business names, branding, service catalogs, question overrides, page wording, industry classifications, industry-selected service examples and business-specific PDFs remain owned by each business. This release does not bulk-rewrite customer/business records.
- Existing route/API names, field IDs, statuses, authentication/session behavior, tenant checks, billing rules, consent requirements and data history remain intact. In particular, internal `/studio/` routes and legacy catalog IDs are compatibility identifiers, not visible terminology to rename.
- “Professional” remains a subscription plan name, and industry names remain available as search/filter choices. Provider names such as Stripe identify actual payment services.
- A client ID still follows the existing identity rules. This wording pass does not change required date-of-birth fields or redesign identity/payment verification.

## Verification and limits

React-rendered tests check actual public desktop/mobile link parity, privacy access, tenant routes, custom booking labels, generic defaults and preserved question overrides. Status render checks distinguish bookings from memberships. Existing workspace, privacy, booking, membership, payment and tenant-isolation tests remain required. Runtime/source validation and live evidence are recorded in V1_3_166_RELEASE.md.

A language/structure review cannot prove that every user will find every flow intuitive. Actual private owner-browser and physical-phone acceptance require authenticated/device sessions; do not claim those solely from passing automated tests. No real customer submission, payment, email or destructive operation is needed for QA.
