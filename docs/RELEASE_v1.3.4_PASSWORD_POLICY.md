# SelahFlow v1.3.4 — Consistent Password Requirements

The minimum password length is **six characters** throughout the application.

- Business owner signup: six-character minimum, checked on client and server.
- Password changes under owner dashboard Security: six-character minimum, checked on client and server.
- Platform administrator invitations: six-character minimum, checked on client and server.
- Owner and administrator login: six-character minimum.
- Original Render ADMIN_PASSWORD validation: at least six characters (already in v1.3.3).
- All new-password forms accept up to 128 characters; login retains compatibility with older longer passwords.

Passwords are stored as salted scrypt hashes, never as plaintext. There are no automatic resets or database migrations in this patch. Existing staff, services, bookings and accounts remain unchanged.

Security guidance: Six characters is the allowed **minimum**; a longer, unique password with a password manager is strongly recommended. The primary administrator's password is not hardcoded.

Live deployment URL: https://selahflow.onrender.com
