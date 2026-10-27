# SelahFlow v1.3.11 — Device Push Notifications

## Who gets alerts?
Subscriptions are always tied to **business ID and reviewer**. When a business has booking approvals on and someone submits a new booking request, alerts target (1) that business's signed-in owner and (2) the currently designated staff reviewer, if any. Other business owners or staff cannot subscribe to those alerts.

## Owner setup
1. Navigate to the business owner dashboard `https://selahflow.onrender.com/studio/{slug}`.
2. Under **Settings → Booking requests**, enable booking approval notifications and click **Enable notifications on this device**. Choose whether to allow notification permission. This is separate from Email/SMS checkboxes.
3. Observe the top-bar bell. It shows unread pending requests; opening it marks visible new requests read. Choose *Open booking approval inbox* to accept/decline.
4. Repeat the setup on any other device you want to receive pushes. Each has a separate browser permission and server subscription.
5. Choose Disable to revoke this device's subscription from the business.

## Staff setup
1. Owner selects a staff reviewer and saves, then creates a private 30-day staff review link in Settings.
2. Staff member opens their private link on their own device and clicks **Enable notifications on this device**.
3. Staff notifications link to a 72-hour request-specific review page. Opening the notification itself never accepts or declines a request; explicit confirmation is required.
4. Revoking the staff link/reassigning reviewer immediately blocks team API access; notification sending queries only the current reviewer.

## iPhone
Requires **iOS/iPadOS 16.4 or later**. Open SelahFlow in Safari, Share → **Add to Home Screen**. Launch the newly installed SelahFlow app (not a normal Safari tab). Under Settings, click **Enable notifications on this device** and grant permission. Apple permits Web Push for installed Home Screen web apps; the application does not need App Store publication.

## Android / desktop
In Chrome, Firefox, Edge, or supported browsers: open the dashboard, enable device notifications, and allow notification permission when prompted. Browser push service availability, battery settings, OS notification permissions, and connectivity can affect actual display.

## Render environment configuration
Set **three secret variables** on the SelahFlow Render Web Service:
- `VAPID_PUBLIC_KEY`: base64url of an uncompressed P-256 public key (`04 || x || y`).
- `VAPID_PRIVATE_KEY`: base64url of corresponding P-256 private scalar.
- `VAPID_SUBJECT`: a contact URI (e.g., `mailto:pbraza@gmail.com`).

These must be a matched pair and must be preserved across service deployments. Do not put the private key in source control, public URLs, or notifications.

## Privacy and workflow safeguards
- Each browser subscription is stored per business and reviewer (maximum ten devices per reviewer).
- Subscription requests require authenticated owner cookie or valid staff review bearer token, plus same-origin POST. The backend only sends to known HTTPS vendor push endpoints, excluding local/private URLs.
- The service worker only opens same-origin safe business/review routes, never performs accept/decline operations.
- Push payload shows booking name/services/date but excludes customer email/phone to reduce sensitive details displayed on a lock screen. Full details require authorized access.
- Devices with expired push subscriptions (HTTP 404/410) are pruned automatically.
- Team notification links are individually issued and expire in 72 hours; no raw team credential is stored for push delivery.
- Push delivery is best-effort: browsers may delay/drop notifications due to permissions, OS policies or offline state. Existing dashboard inbox and optional email/SMS remain as backup.
- New notifications do not reserve calendar slots. Only an explicit acceptance creates a confirmed booking.
