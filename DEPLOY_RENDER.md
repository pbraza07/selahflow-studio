# SelahFlow v1.3.2

Deploy the main branch to the new selahflow Render service (srv-dbgbiu0n74is73cglveg; migration cutover still pending) at https://selahflow.onrender.com. Preserve the existing DATABASE_URL, administrator credentials and PostgreSQL database. No new migrations are needed. After the build, check /api/health, /, /crawford, /studio/crawford, and /book/crawford.

# Deploy SelahFlow version 1.3.1 with GitHub + Render

## 1. Extract and upload to GitHub
1. Download `SelahFlow_Studio_v1.2.zip` and extract it.
2. Open the extracted `salonflow-v1.2` folder. It contains `package.json`, `package-lock.json`, `render.yaml`, `app`, `server`, and the other source files.
3. In GitHub, create a **private repository**, for example `salonflow-studio`.
4. Upload the **contents** of `salonflow-v1.2` into the repository root, not the enclosing folder. `package.json` and `render.yaml` must be visible immediately when opening the repository.
5. Commit the files. Include `.gitignore`, `.node-version`, and `.env.example` if using GitHub Desktop or Git. Do not upload `.env.local`.

For Git command-line users, run these inside the extracted folder, replacing YOUR_USERNAME:

```bash
git init
git add .
git commit -m "SelahFlow version 1.3.1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/salonflow-studio.git
git push -u origin main
```

## 2. Create the Render services
1. Sign in to Render and connect your GitHub account.
2. Choose **New > Blueprint** and select the repository.
3. Use the `main` branch and the root `render.yaml`.
4. Review both resources: the Node web service and PostgreSQL database. **The included Blueprint specifies paid plans. Review Render's displayed price before creating them.** No services have been purchased or deployed by this ZIP.
5. Provide the required values when Render prompts:

| Variable | Value |
|---|---|
| ADMIN_EMAIL | Your owner email address |
| ADMIN_PASSWORD | Your unique password, at least 6 characters; store it securely |

6. Deploy the Blueprint. `DATABASE_URL` is populated automatically from the database's internal connection string. Render also supplies `RENDER_EXTERNAL_URL`.
7. Wait for the web service to report healthy, then open its `.onrender.com` URL.
8. Sign in using ADMIN_EMAIL and ADMIN_PASSWORD. No ChatGPT account is involved.

The first startup applies migrations and creates the owner. Later deployments reuse existing data. Changing the configured owner password and restarting invalidates older sessions.

## 3. Configure the salon
1. Open **Settings**.
2. Set the business name, address, phone, daily hours, cleanup buffer and policy.
3. Edit services, durations/prices, staff names and the applicable checkout tax rate.
4. Save changes.
5. Create a test appointment. Refresh to confirm persistence.
6. Try the same time in another signed-in browser session to verify overlap rejection.

The initial sample appointments are clearly labeled and are not database records. Customers can now book without login at `/book`. Share your full app URL with `/book` appended, or use **Copy customer link** in the owner sidebar.

## 4. Custom domain (optional)
1. In the web service's Settings, add your custom domain.
2. Follow Render's DNS instructions at your domain registrar and wait for HTTPS verification.
3. Add the environment variable `APP_URL` with the full HTTPS origin, for example `https://booking.yoursalon.com`.
4. Redeploy and use that address for login and normal operations. Once APP_URL is set, the original Render URL will not accept state-changing requests because origin protection only trusts the configured domain.

## 5. Future releases
The current release is 1.3.1. Future patches and approved feature milestones will arrive as new ZIPs. Replace the source files in the same GitHub repository and commit the update. Keep the new selahflow Render service (srv-dbgbiu0n74is73cglveg; migration cutover still pending)s, environment settings, and PostgreSQL database. Trigger a deployment or use your configured GitHub automatic deployment setting.

## Troubleshooting
- **Build cannot find package.json:** move the ZIP's inner files to the repository root or set the correct Render root directory.
- **Database unavailable/startup failure:** inspect server logs and verify DATABASE_URL and database status. Use the internal connection string for colocated Render resources.
- **Owner setup failed:** ADMIN_PASSWORD must have at least 6 characters; ADMIN_EMAIL must be valid.
- **Incorrect credentials:** use the exact configured email/password; update Render's environment values and restart to reset credentials.
- **Too many login attempts:** wait 15 minutes.
- **Invalid request origin:** verify APP_URL matches the exact HTTPS address in your browser. Leave APP_URL unset when using the default Render URL.
- **Cannot connect to the database from your laptop:** the Blueprint intentionally allows only private-network connections. Use Render's approved connection and access controls if external administration is necessary.

## Official references
Verified October 8, 2026:
- https://render.com/docs/deploy-nextjs-app
- https://render.com/docs/blueprint-spec
- https://render.com/docs/postgresql-creating-connecting
- https://render.com/docs/custom-domains

## Upgrade an existing 1.1 installation to 1.2
1. Replace the repository source with the contents of `salonflow-v1.2` and commit.
2. Deploy the latest commit to the same web service. Keep DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD and your existing PostgreSQL database. The password minimum remains 6 characters.
3. Startup applies the additive `002_public_booking.sql` migration automatically; it adds request-limit storage and does not remove existing appointments.
4. Open **Customer booking** or **Copy customer link** in the dashboard. Test the link in a private/incognito browser window without signing in.
5. Submit a test appointment and verify it appears on the owner dashboard. Dashboard refresh occurs every 30 seconds outside Settings.
6. If using a custom domain, keep APP_URL set to that exact HTTPS origin. The public booking and owner dashboard should use the same domain.
