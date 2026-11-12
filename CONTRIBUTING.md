# Contributing to Landfall

Thank you for considering a contribution. Landfall is a hackathon-stage project that handles (in Sandbox) the movement of relief money, so changes are judged first on whether they keep that safe and honest. This page separates **what the repository already enforces** from **what is only proposed guidance**: the maintainer has not formally adopted a contribution process, so the second list is a suggestion, not a rule.

## Established practice (enforced by the repository today)

| Practice | How it is enforced |
|---|---|
| TypeScript strict; no type errors | `pnpm exec tsc --noEmit` in CI |
| Lint clean | `pnpm lint` |
| Tests pass, including database-backed suites | `pnpm test` / CI runs them against a Postgres container ([docs/TESTING.md](docs/TESTING.md)) |
| `lib/rules` and `lib/treasurer` stay at 100 % coverage | thresholds in `vitest.config.ts`; CI runs coverage |
| **Money moves only through `lib/treasurer/`** | `tests/arch/boundary.test.ts` fails if other code imports PayPal's write functions |
| **Every API route has an explicit access rule** (default deny) | add the route to `lib/auth/policy.ts`; `tests/security/access-matrix.test.ts` fails otherwise |
| **AI code gets read-only tools** | no AI tool set contains a write ([docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md)); keep it that way |
| Colour comes from design tokens, never raw palette classes | `tests/ui/no-raw-palette.test.ts` |
| Icons come from the registry in `components/icons` | `tests/ui/icon-registry.test.ts` |
| No secrets in the repository | `.env` and `.env*.local` are git-ignored; [`.env.example`](.env.example) holds names and placeholders only |
| Conventional-style commit subjects | history uses `fix(ui): …`, `feat(ai): …`, `docs: …`, `design: …` (not machine-enforced) |

## Before you open a change

```bash
pnpm install
pnpm exec tsc --noEmit && pnpm lint && pnpm test
```

Set up a disposable database for the full suite ([docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [docs/TESTING.md](docs/TESTING.md)). Never point `TEST_DATABASE_URL` at data you care about.

## What a good change looks like

* **Keeps claims honest.** If you change behaviour, update the doc that describes it ([docs/README.md](docs/README.md) says which). Do not add a claim you cannot trace to code, a test or a labelled piece of evidence. Mark replay, synthetic and Sandbox data as such.
* **Adds a test with any financial or access-control change**, and prefers a test that fails without the change.
* **Does not weaken a guard to make a demo look better.** If a number is wrong, fix the number; do not relax the integrity check.
* **Is small and explains why** in the commit message.

## Never, in any contribution

* Initiate a payout, capture or refund against anything but the Sandbox, or commit scripts that do so by default.
* Commit secrets, API keys, licence keys, database dumps or real personal data.
* Rewrite shared Git history.

## Reporting problems

* Bugs and ideas: a GitHub issue with steps to reproduce.
* **Security findings:** follow [SECURITY.md](SECURITY.md); do not post details publicly.

## Proposed guidance (not yet adopted; for the maintainer to decide)

* A pull request template with a checklist (tests added, docs updated, no secrets, access rule added).
* A code of conduct (no `CODE_OF_CONDUCT.md` exists today; the Contributor Covenant is a common choice).
* Branch protection on `main` requiring the CI workflow.
* An architecture decision record folder for choices such as the two-person rule and the Treasurer boundary.

## Licence

By contributing you agree that your contribution is licensed under the repository's [MIT licence](LICENSE).
