# SelahFlow v1.3.1 — branding-only update

Baseline: `pbraza07/SalonFlow`, commit `b3071898b828c441992d91a0f48505676d27557d` (v1.3). This release changes platform identity and presentation only. It does not extend or reorder the v1.3 development roadmap.

## Identity and files

- SelahFlow — Your bookings flow. You breathe.
- Descriptor: Smart booking & AI receptionist. This is brand copy; existing feature availability remains as documented in the v1.3 roadmap.
- `app/globals.css`: shared palette tokens, existing theme aliases, platform surfaces, controls, focus and semantic states.
- `app/platform-pages.module.css`: matching colors for onboarding, directory, pricing, business and platform pages.
- `app/layout.tsx`: platform title and description; versioned teal favicon URL.
- Page presentation in `app/page.tsx`, `app/login/page.tsx`, `app/book/page.tsx`, `app/signup/page.tsx`, `app/business/page.tsx`, `app/discover/page.tsx`, `app/pricing/page.tsx`, `app/admin/platform/page.tsx`: platform names, logos and attribution. Individual business names/logos still come from the existing business configuration.
- `public/brand/logo.svg`, `logo-mono.svg`, `logo-reversed.svg`: transparent horizontal logos.
- `public/brand/symbol.svg`, `symbol-mono.svg`, `symbol-reversed.svg`: compact standalone symbols.
- `public/brand/app-icon.svg` and `public/favicon.svg`: rounded-square icon. The flowing S and two separate pause bars remain separate shapes. Compact assets contain no tagline.
- README, deployment guide, changelog and roadmap title: display-brand documentation updates. VERSION and package versions advance to 1.3.1 / 1.3.1; package name remains `salonflow-studio`.

## Palette

| Token | Color | Use |
|---|---|---|
| Primary | #123F3A | Navigation, buttons, headings |
| Secondary | #91AA96 | Sage accents |
| Background | #F7F4EC | Warm ivory pages |
| Gold | #C6A66A | Decorative policy accent |
| Surface | #FFFFFF | Cards and inputs |
| Ink | #252A31 | Body text |
| Readable sage | #526D58 | Flow wordmark and small sage text |

Calculated WCAG contrast: teal/white 11.68:1; dark sage/ivory 5.18:1; charcoal/ivory 13.14:1; sage/teal 4.67:1; muted text/ivory 5.78:1. Semantic error, success, booking and check-in colors remain distinct. Keyboard focus has explicit contrasting rings. Existing layout structure and responsive breakpoints remain in place.

## Preservation

The API, authentication, business logic, defaults, migrations, scripts, environment-variable names and deployment configuration are unchanged from the baseline. There are no new migrations, reseeds, replacement businesses or database writes. Existing default business names/greetings containing SalonFlow are deliberately retained as business configuration, rather than renamed as platform branding. There are no implemented outbound notification templates to rebrand in this baseline.

Keep the same GitHub repository, Render service, database and environment settings. Do not provision a replacement service or database. The application URLs remain:

- https://selahflow.onrender.com
- https://selahflow.onrender.com/book/crawford

The branding and favicon changes are deployed to the existing service, now named `selahflow-studio`. This patch corrects release labels to 1.3.1. The v1.4 security/billing milestone remains planned. Existing startup behavior is unchanged.

## Validation and limits

- `npm ci --no-audit --no-fund`, `npm run typecheck`, `npm test`, `npm run build`: passed.
- All 8 existing fixture tests passed, including authentication/session handling, tenant isolation, additive migration protections, reserved Crawford preservation and booking conflict/stale quote protections.
- `git diff --check`: passed. Protected backend/config directories show no changes against the baseline.
- Local production HTTP smoke check: `/login`, `/book/crawford`, `/signup`, `/pricing`, logo and favicon return 200; protected studio and platform APIs return 401 without credentials. The Crawford response verifies route rendering only, not database-backed appointment creation.
- Horizontal logo and app icon at 16, 24, 48 and 96 pixels rasterized and visually inspected; wordmark clipping corrected. Palette contrast calculated from sRGB colors.
- Live customer/owner/team/admin sign-in, real database contents, service/team edits and an end-to-end booking were not exercised: no production credentials or connected test database were used. No appointments, notifications or payments were triggered.
- Desktop/mobile browser visual and interaction checks could not be completed because the test browser download failed. Full page rendering and keyboard interactions still require browser QA before deployment. No claim is made that production data was independently audited; source preservation and fixture checks establish the scope of this update.
