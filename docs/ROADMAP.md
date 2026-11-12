# Roadmap

> **Proposals, not promises.** This page lists what would be needed to move Landfall from a Sandbox demonstration toward something a real fund could consider. It is derived from [LIMITATIONS.md](LIMITATIONS.md), [SECURITY.md](../SECURITY.md) and [THREAT_MODEL.md](THREAT_MODEL.md). No dates, owners or commitments exist; ordering is by what blocks real use.

## 0. Before any real person's data or real money

| Item | Why |
|---|---|
| Real operator authentication with role assignment (and MFA); remove persona sign-in for non-demo deployments | Today anyone can be the coordinator or finance director on the demo |
| Passkey-only approvals; delete the demo PIN path outside Sandbox | The PIN is public |
| Mandatory `PII_ENCRYPTION_KEY`; refuse to boot in production without it; encrypt payment receivers and coordinates | Fallback key is in the source; receivers are clear text |
| Ownership checks on subscription cancel and pledge revoke; remove the `viewer` role from resident writes | Public state-changing routes |
| Persistent, shared rate limiting and lockouts; persist complaints | In-memory state |
| Database migrations, backups and a tested restore; a production database tier | None exist |
| Independent security review and a pilot with a real fund's written consent | None done |

## 1. Close the gap between what the product says and what it does

* Send the messages Landfall only drafts today (email/SMS) and complete email verification.
* Either finish storm pledges (UI, activation trigger, charge flow, reconciliation) or remove them.
* Persist Log in with PayPal results and verify `state`.
* Wire in or delete unused code: the 11 unused tables, the three unwired AI modules, the eight unmounted widgets, unused dependencies.
* Make the landing "Relief board" live or label it as replay.
* Unify the two treasury computations; read fee reserve from the ledger in the Watch Officer check.
* Fix the Money trail layout at 1440 px.

## 2. Evidence and quality

* Browser tests (the existing audit scripts into CI), accessibility audit, performance budget.
* A real evaluation set for the Watch Officer and Case Officer, and an independent red-team of prompt injection.
* Webhook freshness window; a replay test against recorded PayPal payloads.
* Dependency vulnerability scanning in CI.

## 3. Product ideas (not started)

* A second model provider as fallback.
* Resident voice reporting (the data model already has the channel).
* Multi-fund support and per-fund policy editing.
* An accountability export for donors and auditors (the access table already reserves `/api/export/*`).
* Offline-tolerant resident flows for low connectivity.
