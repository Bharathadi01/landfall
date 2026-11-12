# User journeys

> Four journeys through the product as it exists at commit `f8f21a7`. Each step says what actually happens and whether it is real (PayPal **Sandbox**), simulated, or replayed. No journey describes an outcome for a real person: none exists. Screens are in [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md); the API calls behind them in [API.md](API.md).

## 1. Donor

**Goal:** give once, or monthly, and be able to trust where it went.

1. Opens the landing page: sees the purpose, the live globe, and the Safety section.
2. Scrolls to **Give** (`#give`). PayPal's Smart Buttons load from PayPal (the button iframe is PayPal's, not Landfall's).
3. Chooses an amount and pays with the Sandbox test card from `/judges` (**no real money**). The browser asks `POST /api/donations/orders`, approves in PayPal's own window, then `POST /api/donations/capture`.
4. Landfall refuses to record anything PayPal did not complete (`409 capture_incomplete`). On success it stores the order (email only as a hash).
5. PayPal's verified `PAYMENT.CAPTURE.COMPLETED` webhook then posts the money to the ledger as `paypal_available`. A donation whose webhook never arrives is stored but not in the ledger.
6. *Monthly:* the $25 sustainer button creates a subscription; the donor approves in PayPal; Landfall asks PayPal for the truth before recording it as active; each `PAYMENT.SALE.COMPLETED` posts to the ledger.

What a donor does **not** get today: a receipt or email from Landfall (none is sent), a way to see where their own gift went, or a self-service way to manage the subscription (the cancel endpoint exists but has no ownership check, [SECURITY.md](../SECURITY.md)).

## 2. Relief coordinator

**Goal:** get money to the right households fast, and know within hours whether it landed.

1. **Sign in** at `/signin` as Dana Ortiz (a fictional coordinator persona; real sign-in does not exist yet).
2. **Command Center** opens: either "Every payment has an answer." or a count of payments that still need one, with the next action for each.
3. **Storm Desk**: official warnings over enrolled households; exposure is decided by point-in-polygon, not AI.
4. **Storm Drill**: rehearses the response on a past hurricane. Nothing is paid.
5. **Guided Response**: eight steps from warning to payout with a simulated PayPal sender.
6. **Propose**: from a case, create a proposal (new payout, cancel an unclaimed item, or re-issue). The server builds the plan, checks caps and duplicates, and stores the hash. No money moves.
7. **Approvals**: approves as the first key with a passkey or the labelled demo PIN. A different person with the Finance role must approve second (journey 3).
8. **Payments**: every PayPal payment in an AG Grid, grouped and filterable, with its evidence.
9. **Case page → Investigate**: the AI Case Officer reads the evidence and recommends *a human action from the permitted list*; the coordinator decides whether to propose it.
10. **Households**: reviews enrolments, appeals and the four verification chips.

Boundaries the coordinator will meet: they cannot approve their own proposal alone; they cannot resend a payment that is still claimable; missing paperwork routes to review instead of lowering priority.

## 3. Financial operations (Finance director)

**Goal:** release money only when it is safe, and keep the books equal to PayPal.

1. Signs in as Sam Patel (Finance persona).
2. **Approvals**: opens a pending proposal, reviews what it would pay, and approves second. The Treasurer then re-checks: payload hash unchanged, no household already in flight, emergency stop off, funds sufficient with the reserve intact; if all pass it sends one batch to PayPal Payouts (**Sandbox**) with an idempotency key.
3. **Payments**: the status of each item arrives from PayPal's verified webhooks (or **Refresh from PayPal**, a read-only call). A payment stays "unclaimed" until the recipient claims it or PayPal returns it; Landfall holds that money in its own ledger account.
4. **Money trail** (Payments tab): the waterfall, the settlement-integrity bridge and the path of one payment from donor to proof.
5. **Reconcile** (`/api/treasury/reconcile`): compares the ledger with PayPal's reporting balance and explains any difference; fresh payments often show as a timing difference first.
6. **AI Watch Officer**: asks "can we afford the first tranche?"; the answer's figures are enforced to match the ledger.
7. **Analytics Studio**: explores the (synthetic replay) relief data or asks it a question.

## 4. Resident

**Goal:** know whether the payment arrived and tell someone if it did not.

1. A coordinator gives the household a case reference and a six-digit code (on the demo: `/judges`).
2. At `/r/enroll`, **Check Status & Payments** (English, Spanish, Haitian Creole, Vietnamese or Chinese), the resident enters the reference and code. Wrong codes lock that household for 15 minutes; the error is the same whether the case exists or not.
3. They see a plain-language status of their payment (for example sent, waiting for them to claim it, credited, returned, or needs help).
4. They can say **"I received it"** or **"I can't access it"** (with a reason such as no PayPal account). The report is stored and shown to the coordinator as *recipient-reported*; it never changes PayPal's status.
5. They can appeal a decision (24-hour review target) or file a complaint (`/r/complaints`; complaints are in memory only and lost on restart).
6. Enrolment (`Enroll Household` tab) is a separate path: consents are recorded one by one; a household enrolled this way is stored, but does not itself receive a case code until it has a payment case.

What residents do **not** get today: any email or SMS from Landfall (none is sent), voice reporting (not wired), or a payment unless a coordinator, a second approver and PayPal have all acted.
