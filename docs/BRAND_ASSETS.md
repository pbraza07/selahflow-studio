# SelahFlow identity assets — v1.3.99

The owner supplied the SelahFlow brand sheet featuring a ribbon S, sage accent and gold pause bars, plus a screenshot circling the previous simplified header mark. Existing business-owned logos and themes are preserved.

Prepared using the built-in image skill with the supplied brand sheet as the edit reference. These are reference-derived raster assets, not original editable vector masters. PNG optimization and SVG compatibility wrappers preserve the prepared artwork at existing application asset paths.

Primary logo prompt: Extract only the top horizontal SelahFlow logo, including the ribbon S, internal gold pause bars, forest/sage wordmark and exact tagline “Your bookings flow. You breathe.” Preserve the supplied identity and proportions. Remove the cream background and other variants; output a tightly framed transparent logo without redesign.

App icon prompt: Extract only the lower middle square app icon. Preserve the cream/sage ribbon S, internal gold pause bars and forest rounded-square background. Output one square icon without wordmark, other variants or redesign.

| Asset | Use |
| --- | --- |
| public/brand/wordmark.png | Primary transparent logo |
| public/brand/logo.svg | Existing shared header/logo URL |
| public/brand/logo-reversed.svg | Cream monochrome rendering for dark sidebar |
| public/brand/logo-mono.svg | Forest monochrome rendering |
| public/brand/app-icon.png | Compact brand signature, app and push icon |
| public/brand/apple-touch-icon.png | iOS home screen icon |
| public/brand/email-logo.png | Inline PNG in Gmail and Resend emails |
| public/brand/symbol*.svg, app-icon.svg, public/favicon.svg | Existing compact-art URL compatibility |

Emails use a shared server-rendered HTML layout, inline Content-ID logo and original plain-text alternative. Client values are escaped. The same branded wrapper applies at send time to approval, membership, verification, payment-link and payment-confirmation messages, including previously queued plain-text messages. No mailbox reconnection is needed for template changes. SMS content and staging recipient restrictions remain unchanged. Branding tests use simulated delivery, not actual client email.
