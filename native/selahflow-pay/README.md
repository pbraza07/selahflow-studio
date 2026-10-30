# SelahFlow Pay native companion

This is the appointment-bound Stripe Terminal React Native app. It is not an installed or signed app yet. Expo Go and a web browser cannot use phone NFC for Tap to Pay.

## Prepare a distributable build

1. Use Node 22.13+ or 24, install dependencies with `npm ci` in this directory, and run `npm run typecheck`. The lockfile pins the Expo 58 / React Native 0.88.1 / Stripe Terminal beta.34 dependency graph.
2. The platform owner must control Apple Developer and Google Play/Expo signing accounts. Confirm ownership/availability of `com.selahflow.pay`, provision a real Expo EAS project (`eas init`), then use `eas build --profile development --platform ios` or Android. No credentials, signing keys or API keys belong in this repository. Do not publish an unsigned or unreviewed app.
3. Request Apple Tap to Pay development and distribution entitlements for this bundle ID. `app.json` declares `com.apple.developer.proximity-reader.payment.acceptance`; a declaration does not grant Apple approval. Create a provisioning profile with the approved entitlement. iPhone distribution also requires Apple review. Follow current Stripe device/OS/country requirements.
4. `npm run prebuild` generates iOS/Android sources. The Stripe Expo plugin injects the Android Terminal application delegate and Tap to Pay process guard, plus permission declarations. Generated platform directories are ignored; regenerate from committed configuration. Linux cannot compile/sign the iOS app. Use Xcode/macOS for iOS and the Android SDK/JDK for Android.
5. The backend's existing **connected-account webhook destination** must subscribe to `payment_intent.succeeded`, in addition to existing Checkout, invoice, account and refund events. Keep the existing signing secret. The phone's Check payment and dashboard's Check payment also retrieve Stripe's current state and reconcile if webhook delivery is delayed. Do not create live payment resources for QA.
6. In each business's connected Stripe account, create a Terminal location, then select it in SelahFlow Settings → Payment setup → Tap to Pay. No location or legal consent is created automatically.
7. Install the signed development/internal app on a supported physical phone. Open an approved unpaid appointment → Pay on Site → Open SelahFlow Pay. Owner authorizes only that appointment in the system browser. Confirm business/client/amount on the phone; Set up phone invokes the Stripe SDK account linking/terms/permissions UI. The business owner must complete that interaction. Staging always uses a simulated reader and test credentials; production never requests simulated collection.
8. Validate sandbox success, decline, cancellation, disconnection and repeated verification on physical devices. Verify one receipt, one financial sale, appointment paid status and one confirmation email. Then complete Stripe/Apple activation and a separately authorized live acceptance test. No physical device, NFC payment, signing, Apple approval or store distribution was performed by the coding agent.

## Flow and guarantees

The native app accepts only the fixed production and staging HTTPS origins. Deep links carry an appointment UUID, never login credentials or payment secrets. PKCE/S256 and random state bind a two-minute, single-use browser authorization code to the phone; a hashed one-hour bearer grant is limited to one active business/appointment and rechecks the original owner session on every request. Support impersonation cannot issue a grant. Password rotation/logout/session expiry revoke access. The bearer stays in app memory; restart requires authorization again. Disconnect explicitly revokes it. No passwords or Stripe secret keys enter the app.

The server computes amount/lines from the saved approved appointment and respects per-service onsite choices, waiver, coverage, active business and connected-account checks. Online Checkout is verified/expired before Terminal creation. Active native collection blocks online Checkout and linked cash recording. Processing payments cannot be replaced. Cancellation requires a verified Stripe response. The same first-customer commission policy applies, including application fees and existing refund handling. Appointment deletion/client reset are blocked while onsite collection is pending.

SDK success is not a receipt. The webhook or authenticated Check payment retrieves the connected-account PaymentIntent and verifies saved attempt, booking/business metadata, USD amount/amount_received, succeeded status and a paid card-present charge. Receipt, revenue event, appointment paid marker, commission and confirmation queue commit together and replay without duplicates. The existing reports consume that financial event. Pay on Site preference alone never marks paid.

## Verification limits

TypeScript, Expo configuration, prebuild and iOS/Android JavaScript bundle exports can be checked in the Linux workspace. These do not prove native compilation, NFC hardware, entitlements, signing, store approval, device activation, provider configuration or real money collection. Keep the public setup page's pending distribution wording until a signed installation is actually available.

References: https://docs.stripe.com/terminal/payments/setup-integration?terminal-sdk-platform=react-native and https://docs.stripe.com/terminal/payments/setup-reader/tap-to-pay?platform=ios
