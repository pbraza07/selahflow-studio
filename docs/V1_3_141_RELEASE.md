# v1.3.141 release handoff — verified LIVE in staging and production

Business Settings → Stripe payments retains the stable Account Links API verified against existing connected accounts. Complete Stripe setup reuses the saved account ID and requests a fresh single-use link. Both server and browser validate the HTTPS Stripe destination; the browser retains a Continue to Stripe link when automatic navigation does not occur. No migration, credential, environment or customer-record changes.

Application commit `e466be5639cc875c25e6e11cc5881215ec79ff08`. Final staging `dep-dbdp5h5g1s2s73ajq780` LIVE October 23, 2026 at 1:07:42 p.m. EDT; production `dep-dbdp93uq1p3s73esk2v0` LIVE at 1:10:17 p.m. EDT. Local tests/typecheck/build passed. Final GitHub CI run 39991473859 / job 120544026938 and Render staging passed all 367 tests, typecheck and build; production build passed. Both live health endpoints report 1.3.141; read-only booking/payment/protected-owner checks passed. Actual runtime preflights confirm dedicated staging/production databases/users, schema CREATE true and zero unowned tables. No error-level startup entries observed in the final check.

The actual updated staging Complete Stripe setup button reached Stripe-hosted sandbox onboarding/sign-in using its existing account. Production owner settings show the active first-connection button and current version. No production financial account was created, onboarding details/terms submitted or payment made for QA. First-time live account creation remains owner acceptance; a new post-activation production error was not reproduced. The original v1.3.140 staging button also redirected successfully. A v2 Account Link configuration experiment failed real provider validation in an earlier staging-only build and was reverted before production; the final code retains the verified stable API. Saved branch `fix/stripe-onboarding-redirect`; PR #67 merged. Documentation-only [skip render] commits may follow the LIVE application SHA.

## Regression coverage

Stable onboarding request and new-account risk model; existing-account link renewal without account creation; unsafe URL rejection; provider errors; staging live-key blocking; real component click handler with simulated navigation and continuation-link retention.

## Owner steps

Reload SelahFlow, then open Settings → Stripe payments. Select Connect Stripe payments for the first connection, or Complete Stripe setup for an existing connection. The app requests a fresh link and opens Stripe. If automatic navigation does not occur, use Continue to Stripe. Complete the remaining business account prompts on Stripe, return, then select Verify Stripe. Platform activation and each business’s connected-account onboarding are separate steps.
