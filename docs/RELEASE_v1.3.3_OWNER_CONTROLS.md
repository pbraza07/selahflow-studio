# SelahFlow v1.3.3 — Owner Controls
Live application: https://selahflow.onrender.com

## Function links
- Platform admin: https://selahflow.onrender.com/admin/platform
- Crawford owner dashboard: https://selahflow.onrender.com/studio/crawford
- Crawford public profile: https://selahflow.onrender.com/crawford
- Crawford booking: https://selahflow.onrender.com/book/crawford
- Owner profile: https://selahflow.onrender.com/business
- Owner **Branding**, **Security** and **Settings**: tabs within /studio/{slug}.
- New business signup: https://selahflow.onrender.com/signup

## New owner controls
Choose brand colors, upload a 300 KB PNG/JPEG/WebP logo, and describe the business model. Settings lets owners add/remove/edit service types and team members. The server enforces bookable team limits: Free 1, Professional 3, Business 10. Existing team members over the plan limit are grandfathered and not deleted; additional team members cannot be added. Subscription billing is not active, and owners cannot self-select paid plans.

## Passwords and platform administrators
Existing owner passwords can be changed from **Security**; each must supply the current password and a distinct new password with at least 6 characters. The startup process no longer overwrites manually changed passwords with ADMIN_PASSWORD. Avoid 123456 or other weak passwords. pbraza@gmail.com is the single configured primary platform administrator. Primary may create other platform administrator accounts with unique emails and separate hashed passwords, and may revoke their access. Invited admins may view platform data and update their own password, but cannot invite other admins.

Legacy platform_admins rows are inactive unless explicitly assigned. Platform endpoints and the platform dashboard itself verify a server-side active session and the database administrator role.

## Safe deployment
Keep the existing Render web service and PostgreSQL database, and back up your records first. After successful GitHub Actions checks, merge into main. Render deploys automatically. Migration 004 is additive and does not modify original Crawford bookings or staff. Confirm /api/health says 1.3.3, test Crawford booking, tenant isolation, admin login, team limits, logo, colors and password changes.
