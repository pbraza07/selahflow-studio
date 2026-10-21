# Waiver lifecycle verification — 2026-10-21

Both environments are LIVE on v1.3.116, application commit c5d7a9090c1318fe35b52d905229e7627f962862. Production deployment dep-dbc2r98n74is73f5v9sg; staging deployment dep-dbc2e4lg1s2s73bjh4t0. Both public health endpoints returned ok/version 1.3.116.

Production Arcila public configuration confirms requiresWaiver=true for all four current services. Staging public configuration confirms false for all four; activation remains pending authenticated owner access. Browser credential protection blocked staging navigation and requires manual handoff. Do not report staging activation as complete.

Ten focused tests passed (zero failures), including a new integrated synthetic lifecycle test: first signature saved, reused across required services, retained and owner-scoped after deletion, same six-character ID immediately reissued to the same client, stale original record insertion rejected, new registration requires new consent and subsequently reuses it. Existing waiver and ID implementation required no runtime changes. New regression is feature-branch only; no additional application deployment was required or triggered. No real client was deleted or signed for. Production signed-waiver owner retrieval UI is implemented; no actual customer document was opened during this verification.

Run: node --test tests/participation-waivers.test.mjs tests/permanent-client-deletion.test.mjs tests/member-id-policy.test.mjs tests/optional-membership-identity.test.mjs

Owner retrieval: Settings > Service catalog > View signed waivers. New service waiver requirements remain an explicit checkbox. A released ID can be reallocated on fresh registration (leave requested ID blank); allocation depends on configured ID policy and availability. Reclaimed numbers never inherit detached consent from a deleted identity.
