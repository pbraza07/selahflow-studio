# v1.3.169 release handoff — Administrator waiver activation

Platform administrators manage template selection, legal-review records and activation through Platform Admin → business directory → Open owner workspace for support → Settings → Service catalog → Participation waivers. Ordinary owners cannot change category templates or either legal-review record. The settings transaction rechecks the actual authenticated account role against the persisted settings; forged browser flags and stale owner submissions do not grant approval authority. Existing signed records remain intact. Source implementation; deployment pending.

