# Landfall — Cash Before the Storm

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI Status](https://github.com/Bharathadi01/landfall/actions/workflows/ci.yml/badge.svg)](https://github.com/Bharathadi01/landfall/actions)

> **"Mutual aid always arrives after landfall. Landfall makes it arrive before."**

**Golden rule:** *AI proposes. Rules check. A human approves. Only then does PayPal move money.*

---

## What is Landfall?

When severe storms and hurricanes hit, grassroots mutual-aid funds struggle with intake backlogs, frozen personal Venmo/PayPal accounts, and money that arrives weeks or months after the damage.

Research by the **World Food Programme** and **World Bank** (randomized controlled trial, Bangladesh floods) shows that unconditional cash transfers delivered **before** a disaster peaks produce significantly better household outcomes than identical assistance delivered afterward.

**Landfall gives anticipatory cash to any neighborhood mutual-aid fund, powered by PayPal:**
- **Calm weather:** Residents pre-enroll via multilingual AI chat with document verification and Log in with PayPal.
- **Storm warning:** Sentinel agent monitors live National Weather Service (NWS) alerts.
- **Planning:** Allocator agent drafts a payout plan within the fund's verified PayPal balance; an adversarial Auditor agent verifies safety.
- **Human in the Loop:** A coordinator approves the plan in an AG Studio war room.
- **Two-Key Money Movement:** The deterministic Treasurer dispatches a **PayPal Payouts** batch (PayPal or Venmo) before landfall.
- **Rescue:** Courier agent tracks webhooks and rescues unclaimed funds.

---

## Hackathon Highlights

- **Track:** PayPal AI Hackathon 2026
- **Core Integrations:**
  - **PayPal Sandbox**: Payouts API (batch disbursements), Orders v2 (donations), Log in with PayPal (identity verification), Webhooks, Reporting.
  - **AI & Agents**: Multi-agent pipeline with Gemini Flash & Pro, dual-model verification, least-privilege architecture.
  - **AG Studio**: Operational war room with custom MapLibre widget, AG Grid plan approval, and AG Charts payout funnel.
  - **Deterministic Rules**: 100% test-covered rules engine and two-key cryptographic authorization on money movement.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

