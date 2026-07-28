# Nexorium — todo

## Phase 0 — hygiene

- [ ] Read the README and confirm every claim in it is true of the code
- [ ] Check for committed secrets (`.env`, credentials, tokens) and real PII
- [ ] Confirm `git config user.email` resolves to f16samakasamuel@gmail.com
- [ ] Rewrite README: live link, screenshot, stack, problem solved

## Phase 1 — revamp features

_See `plan.md` for the full table with effort estimates. Copy the features
here as checkboxes once the order is decided._

- [ ] Highest credibility-per-hour item first (named in plan.md)

## Phase 2 — presentation

- [ ] Landing page / UI against the assigned template
- [ ] Deploy, and confirm the deployment is embeddable
      (no `X-Frame-Options`, no CSP `frame-ancestors`) so the portfolio can
      iframe it
- [ ] Capture a poster frame for the portfolio carousel
- [ ] Update `portfolio/src/lib/projects.ts` — name, repo path, brief, timeline

## Phase 3 — quality gates

- [ ] CI: lint + typecheck/tests on every push
- [ ] CI badge in the README pointing at **F16Samuel**, not samarverma-sl
- [ ] Decide public vs private, and strip whatever blocks going public
