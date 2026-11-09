# Competitive Positioning & Primary Source Matrix (§10, §21.6)

## 1. Category Definition: Narrow Exception-Assurance Layer

**Landfall is NOT a replacement for global humanitarian suites.**

Mature platforms such as **UNICEF HOPE** and **RedRose ONEplatform** are comprehensive enterprise Cash and Voucher Assistance (CVA) systems covering beneficiary registration, biometric deduplication, programmatic targeting, complex case management, and multi-country payment orchestration.

**Landfall's narrow wedge:** A specialized exception-investigation, retry-prevention, and cryptographic assurance layer for community organizations utilizing PayPal Payouts to deliver disaster relief cash.

---

## 2. Primary Source Capability Matrix

Every competitor classification below is cited from official public documentation accessed on November 9, 2026.
Classifications:
- `CONFIRMED`: Public documentation explicitly verifies the capability.
- `NOT PUBLICLY EVIDENCED`: Public documentation does not mention or confirm the capability. (Does NOT imply absence, only lack of public evidence).
- `UNKNOWN`: Public evidence is ambiguous.

| Operational Capability | Landfall Implementation | UNICEF HOPE | RedRose ONEplatform | Technical Status & Qualification |
|---|---|---|---|---|
| **Beneficiary Registration & Biometrics** | Intentionally excluded (privacy-preserving pseudonyms only) | `CONFIRMED` ([UNICEF Innovation HOPE](https://www.unicef.org/innovation/hope)) | `CONFIRMED` ([RedRose ONEplatform](https://redrose.io/oneplatform/)) | Adjacent sector capability; Landfall links to existing external IDs. |
| **Multi-Provider Assistance Delivery** | Excluded; focused exclusively on PayPal rails | `CONFIRMED` (Banks, mobile money, cash agents) | `CONFIRMED` (Smartcards, e-vouchers, paper tokens) | Mature global platforms serve multi-rail enterprise needs. |
| **PayPal Payouts v1 Item Lifecycle** | `CONFIRMED` (`lib/recovery/engine.ts`, `tests/recovery/`) | `NOT PUBLICLY EVIDENCED` | `NOT PUBLICLY EVIDENCED` | Core Landfall focus: deep integration with PayPal Payouts v1 item states. |
| **Item State Linked to Relief Obligation** | `CONFIRMED` (`types.ts`, `PayPalMoneyPathExplorer.tsx`) | `UNKNOWN` (Batch reconciliation evidenced; item linkage unspecified) | `UNKNOWN` (Provider reports ingested; item linkage unspecified) | Landfall enforces 1:1 binding between PayPal item ID and relief obligation. |
| **Deterministic No-Reissue Escrow Lock** | `CONFIRMED` (`exception-taxonomy.ts`, 100% block in test) | `NOT PUBLICLY EVIDENCED` | `NOT PUBLICLY EVIDENCED` | Blocks duplicate reissuance while PayPal payout is `UNCLAIMED` (30d window). |
| **Read-Only AI Investigator with Citations** | `CONFIRMED` (`lib/ai/investigator/agent.ts`, Zod schema) | `NOT PUBLICLY EVIDENCED` | `NOT PUBLICLY EVIDENCED` | Specialized forensic agent with 8 read-only tools; $0 inference cost. |
| **Dual WebAuthn Passkeys Over Plan Hash** | `CONFIRMED` (`PasskeyApprovalModal.tsx`, SHA-256 hash) | `UNKNOWN` (Maker-checker workflows evidenced; WebAuthn unspecified) | `CONFIRMED` (Multi-level approval workflows) | Cryptographic binding to canonical plan hash before money moves. |
| **Cryptographic Recovery Proof Certificate** | `CONFIRMED` (5-pillar SHA-256 master root hash) | `NOT PUBLICLY EVIDENCED` | `NOT PUBLICLY EVIDENCED` | Versioned tamper-evident JSON certificate linking obligation to provider state. |
| **AG Studio Dynamic Workspace** | `CONFIRMED` (`war-room/page.tsx`, `ag-studio-react@3.1.0`) | N/A (Proprietary UI) | N/A (Proprietary UI) | AG Grid sponsor challenge integration with embedded analytics canvas. |

---

## 3. Disconfirmation Criteria (§21.7)

What would disprove Landfall's differentiation?
1. If PayPal releases a native relief-obligation tracking module that binds individual Payouts v1 items to donor grant agreements and blocks unclaimed duplicate payouts.
2. If UNICEF HOPE or RedRose provides a plug-and-play PayPal Business connector with automated read-only exception diagnostics for grassroots US nonprofits.

Until such capabilities are publicly evidenced, Landfall occupies a clear, narrow, high-value operational niche.

