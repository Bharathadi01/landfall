# Landfall AG Studio Custom Widget Evidence Report

**Audit Date:** October 2024 / November 2026 Audit Run  
**Specification Reference:** `LANDFALL_AG_GRID_STUDIO_PRIZE_MASTER_SPEC.md` (§5, §10)  
**Registered Custom Widgets:**
1. Reserve Guardrail Widget (`landfall-reserve-guardrail`)
2. Payout Lifecycle Widget (`landfall-payout-lifecycle`)
3. Recovery Evidence Chain Widget (`landfall-recovery-evidence-chain`)
**Evidentiary Screenshots:**
- `09_ag_reserve_guardrail_widget.png`
- `10_ag_payout_lifecycle_widget.png`
- `11_ag_recovery_evidence_chain_widget.png`

---

## 1. Architectural Registration in AG Studio

All three custom widgets are registered via the `createWidgets` extension point in [`components/studio/StudioCanvas.tsx`](file:///Users/bharathadithya/landfall/components/studio/StudioCanvas.tsx) under the dedicated menu group `"Landfall Relief Intelligence"`. Each widget declares its supported roles, data mapping cardinality, AI assistant discovery metadata, and React component renderer.

```typescript
const widgetsConfig = (defaults: any) =>
  createWidgets({
    additionalTypes: [
      { id: RESERVE_GUARDRAIL_WIDGET_TYPE, label: "Reserve Guardrail", comp: ReserveGuardrailWidget, ... },
      { id: PAYOUT_LIFECYCLE_WIDGET_TYPE, label: "Payout Lifecycle", comp: PayoutLifecycleWidget, ... },
      { id: EVIDENCE_CHAIN_WIDGET_TYPE, label: "Recovery Evidence Chain", comp: RecoveryEvidenceChainWidget, ... },
      { id: SOLVENCY_WIDGET_TYPE, label: "Relief Solvency", comp: SolvencyWidget, ... },
    ],
    menu: [
      ...(defaults?.menu ?? []),
      {
        label: "Landfall Relief Intelligence",
        widgetIds: [
          RESERVE_GUARDRAIL_WIDGET_TYPE,
          PAYOUT_LIFECYCLE_WIDGET_TYPE,
          EVIDENCE_CHAIN_WIDGET_TYPE,
          SOLVENCY_WIDGET_TYPE,
        ],
      },
    ],
  });
```

---

## 2. Widget A: Reserve Guardrail Widget

### File Implementation
[`components/studio/widgets/ReserveGuardrailWidget.tsx`](file:///Users/bharathadithya/landfall/components/studio/widgets/ReserveGuardrailWidget.tsx)

### Primary Operational Purpose
Provides CFOs and board members with immediate visual proof that the organization's **statutory 30.0% disaster reserve floor** is intact. It guarantees that incoming donor relief funds cannot be overcommitted, even in catastrophic surge conditions.

### Visual Components & Metrics
- **Current Eligible Balance:** \$14,250.00
- **Statutory Reserve Floor (30.0%):** \$4,275.00
- **Actual Protected Reserve:** \$5,000.00 (35.1% of total)
- **Reserve Headroom:** **+\$725.00** above the statutory minimum
- **Compliance Status Badge:** `● DETERMINISTIC CODE GOVERNANCE · FULLY COMPLIANT` (Green tone)
- **Calculation Timestamp:** `Last calculation: 18:30:00 UTC (Replay)`
- **Interactive Solvency Meter:** Dual-layer visual bar featuring:
  - Base track representing 100% total funding
  - Striped reserve segment representing current protected reserve (35.1%)
  - High-contrast statutory marker needle at exactly 30.0%
  - Headroom callout pin indicating +$725 surplus

### Financial Invariants & Safety Verification
1. **Read-Only Invariant:** Component strictly consumes read-only props from `solvency` and `treasury` analytical datasets. It contains zero state-mutating functions or payment execution triggers.
2. **Deterministic Calculation:**
   $$\text{floor} = \text{total} \times 0.30 = \$14,250.00 \times 0.30 = \$4,275.00$$
   $$\text{headroom} = \text{reserve} - \text{floor} = \$5,000.00 - \$4,275.00 = +\$725.00$$
3. **Screenshot Reference:** `09_ag_reserve_guardrail_widget.png`

---

## 3. Widget B: Payout Lifecycle Widget

### File Implementation
[`components/studio/widgets/PayoutLifecycleWidget.tsx`](file:///Users/bharathadithya/landfall/components/studio/widgets/PayoutLifecycleWidget.tsx)

### Primary Operational Purpose
Visualizes the end-to-end chronological lifecycle of a single relief payout item through every verification, execution, provider observation, and reconciliation step. Eliminates caseworker guesswork by displaying actual event timestamps and linking directly to immutable audit evidence.

### Chronological Stages Rendered
```
[1. Obligation Approved] ──> [2. Dual-Passkey Auth] ──> [3. Batch Dispatched] ──> 
[4. Provider Submission] ──> [5. Provider Webhook] ──> [6. Ledger Reconciled] ──> [7. Recovery Proof]
```

1. **Stage 1: Obligation Approved**
   - Timestamp: `18:00:15 UTC`
   - Details: Relief entitlement confirmed for household `hh_tbw_002` (Tier 2 Elderly Alone).
2. **Stage 2: Dual-Passkey Authorization**
   - Timestamp: `18:12:04 UTC`
   - Details: Authorized by Incident Commander & Finance Director via FIDO2 WebAuthn.
3. **Stage 3: Batch Dispatched**
   - Timestamp: `18:14:22 UTC`
   - Details: Internal batch `batch_milton_001` packaged with SHA-256 idempotency key.
4. **Stage 4: Provider Submission**
   - Timestamp: `18:15:02 UTC`
   - Details: HTTP POST to PayPal Payouts v1 API; returned PayPal Batch ID `7Y5GP4ETNLCUQ`.
5. **Stage 5: Provider Webhook Observation** (Highlighted in Screenshot)
   - Timestamp: `18:15:30 UTC`
   - Status: `PAYMENT.PAYOUTS-ITEM.UNCLAIMED`
   - Raw Observation: PayPal notified recipient via SMS; funds remain claimable in escrow.
6. **Stage 6: Ledger Reconciled**
   - Timestamp: `18:16:00 UTC`
   - Details: Double-entry debit to Disaster Relief Expense; credit to Cash in PayPal (0¢ variance).
7. **Stage 7: Recovery Proof Anchored**
   - Timestamp: `18:18:45 UTC`
   - Details: Cryptographic Merkle tree receipt `prf_milton_t1_2024` committed.

### Interactive Inspection Feature
Clicking any stage tile opens an inline audit drawer displaying the raw JSON event payload, certificate signature, or provider status code.
- **Screenshot Reference:** `10_ag_payout_lifecycle_widget.png` (demonstrates Stage 5 Provider Observation detail drawer open).

---

## 4. Widget C: Recovery Evidence Chain Widget

### File Implementation
[`components/studio/widgets/RecoveryEvidenceChainWidget.tsx`](file:///Users/bharathadithya/landfall/components/studio/widgets/RecoveryEvidenceChainWidget.tsx)

### Primary Operational Purpose
Provides cryptographic proof of auditability by connecting every relief disbursement to an unbroken chain of authorization, banking receipts, and cryptographic proofs. Crucially, it makes a clear distinction between **what is cryptographically verified** and **what is externally reported** by third parties.

### Evidence Nodes & Verification Taxonomy

| Node ID | Stage Description | Evidence Hash / Identifier | Verification Authority | Authority Type |
|---|---|---|---|---|
| **Node 1** | Hurricane Relief Obligation | `obl_tbw_2024_002` | Policy Engine Evaluation | Cryptographically Verified |
| **Node 2** | Dual-Passkey Authorization | `sig_webauthn_es256_ic_fd` | FIDO2 Hardware Credentials (ES256) | Cryptographically Verified |
| **Node 3** | PayPal Payout Batch | `batch_7Y5GP4ETNLCUQ` | PayPal Payouts v1 REST API | Externally Reported |
| **Node 4** | Payout Transaction Item | `item_09472190472` | PayPal Transaction Network | Externally Reported |
| **Node 5** | Authoritative Status Webhook | `PAYMENT.PAYOUTS-ITEM.UNCLAIMED` | PayPal Webhook Signature (SHA256withRSA) | Externally Reported & Verified |
| **Node 6** | Double-Entry Ledger Entry | `tx_gld_2024_08912` | Landfall Double-Entry General Ledger | Cryptographically Verified |
| **Node 7** | Immutable Recovery Proof | `prf_milton_t1_2024` | SHA-256 Merkle Root Certificate | Cryptographically Verified |

### Cryptographic Honesty & Verification Boundary
> [!NOTE]
> Landfall explicitly distinguishes internal cryptographic verification from external provider attestations.
> - **Internal Proofs:** Dual-passkey signatures, Merkle root receipts, and general ledger journal entries are cryptographically signed and independently verifiable.
> - **External Observations:** Statements returned by PayPal (e.g. `SUCCESS`, `UNCLAIMED`) represent external bank communications. A cryptographic hash verifies the **integrity of the recorded message**, but does not turn an external provider claim into mathematical ground truth.

### Screenshot Reference
- `11_ag_recovery_evidence_chain_widget.png` (demonstrates Node 2 Dual-Passkey inspection active).

