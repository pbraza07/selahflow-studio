# Shared Gmail email delivery

Staging uses a shared Gmail or Google Workspace sender for each business's transactional notifications. One primary administrator connects it; customers and business owners do not create Google API accounts. Existing tenant-scoped recipients, message queues, Stripe sandbox checks and SMS delivery are unchanged. This is a server Gmail API integration, independent of ChatGPT's Gmail connector.

## Google application setup (once per environment)

1. In Google Cloud Console, select or create a project for SelahFlow staging. Enable the **Gmail API**.
2. In **Google Auth Platform**, configure Branding, Audience and Data Access. Use External for a consumer Gmail sender. During Testing, add the chosen sending account as a test user. Request `openid`, `email` and `https://www.googleapis.com/auth/gmail.send`. No inbox-reading or deletion permission is needed.
3. Create an OAuth client with application type **Web application**. Add this exact authorized redirect URI:

   `https://selahflow-staging.onrender.com/api/platform/gmail/callback`

4. In the Render staging service's **Environment**, securely enter:

   - `EMAIL_PROVIDER=gmail`
   - `GMAIL_CLIENT_ID`: the Web application's client ID
   - `GMAIL_CLIENT_SECRET`: its client secret
   - `GMAIL_TOKEN_ENCRYPTION_KEY`: a unique, cryptographically random 32-byte key encoded as 64 hexadecimal characters. Retain it across deployments; replacing it requires reconnecting Gmail. Never copy a production key to staging.

   If an encryption key is already configured, retain it and add only the missing OAuth client values. The platform connection panel lists missing variable names without exposing any values. Never paste credentials, authorization codes or refresh tokens into chat, commits, screenshots or documentation. Use Render's protected configuration. Save and deploy the environment changes.

5. Sign into SelahFlow staging as the primary platform administrator. Open **Platform Admin → Shared Gmail sender → Connect Gmail**. Choose the sending Google account and review Google's sending permission. Authorizing it stores an encrypted offline refresh token in staging; Google passwords are never collected by SelahFlow.
6. For external staging delivery, set `STAGING_NOTIFICATIONS_ENABLED=true` and explicitly add only approved test email addresses to `STAGING_NOTIFICATION_EMAILS`. Keep SMS destinations separately restricted. Enabling the flag alone does not allow unlisted recipients.
7. Submit a synthetic payable request using an allowlisted email. Approve it, check the payment-link message in that inbox, pay with a published Stripe sandbox test card, and confirm the receipt email arrives. Check owner delivery status. **Submitted** means Google accepted the email; inspect the recipient inbox to establish delivery. Do not test against real customer records.

The API transport uses HTTPS because Render Free blocks outbound SMTP ports 25/465/587. Gmail has account sending limits; this does not provide unlimited bulk email. Google apps in External/Testing with Gmail permission receive refresh tokens that generally expire after seven days. For sustained operation, complete Google's applicable publishing/verification requirements; never bypass a Google warning or assume Testing is permanent.

## Permissions and recovery

- Shared-sender status, connect and disconnect endpoints require a current primary platform-admin session, including on the callback. Ordinary owners, team reviewers and other platform administrators cannot replace the sender.
- OAuth state is one-time, expires in ten minutes, binds to that administrator's session and uses PKCE. The callback returns no credentials to the browser. Gmail credentials use AES-256-GCM with an environment-only key.
- Expired/revoked refresh authorization marks the connection as needing reconnection. Queued client emails remain visible. A send with an ambiguous outcome is not automatically repeated; Gmail does not offer the Resend idempotency-key guarantee. Check Gmail before attempting manual recovery.
- **Disconnect Gmail** removes local authorization and attempts Google token revocation. Google account Security → Third-party connections is the independent place to revoke access if needed.
- Gmail becomes the default when no legacy Resend key exists. Explicit `EMAIL_PROVIDER=gmail` selects Gmail even if old Resend credentials are retained; it never silently falls back after a Gmail error.
- Production remains separate. Do not promote code, credentials, test allowlists or a connected Gmail account to production without explicit authorization and an environment-specific setup.

## Reference documentation

- Google web-server OAuth: https://developers.google.com/identity/protocols/oauth2/web-server
- Gmail scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
- Gmail sending: https://developers.google.com/workspace/gmail/api/guides/sending
- Refresh-token expiry: https://developers.google.com/identity/protocols/oauth2
- Render free-service SMTP restrictions: https://render.com/docs/free
