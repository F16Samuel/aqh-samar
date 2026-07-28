# Nexorium — revamp plan

> **Goals, Tracked End To End**
>
> Renamed from aqh-samar. Part of a portfolio-wide revamp; the
> cross-project source of truth lives in `sprout/portfolio-ws/revamp/`.

## Assigned design template

UNASSIGNED — see templates.md

The template is a *reference*, not a dependency — match its typography, colour
and layout signature; do not import Wix markup.

## Analysis and feature plan

## 12. `aqh-samar` (self-named "Nexorium") — goal setting / performance management

**Now.** A genuine full-stack product built for the AtomQuest hackathon and then
kept going: FastAPI with async SQLAlchemy 2.0, Alembic (2 revisions), Supabase
Auth + Postgres, and a real module set — `api/v1/{goals, goal_sheets, cycles,
checkins, achievements, reports, automation, admin, users, auth}` plus
`core/{automation_engine, scheduler, audit, notifications, middleware, validators,
security}`. Excel reporting via openpyxl. It has a **deploy workflow** in CI and
60 commits, last pushed 2026-07-02 — not abandoned. Gaps: **no test suite** — what
exists is four ad-hoc scripts (`backend/scripts/test_ach.py`,
`backend/scripts/test_api.py`, and `test_conn.py` / `test_ip_region.py` at the repo
root), i.e. manual probes rather than assertions, and nothing a runner collects.
CI deploys without verifying, and `automation_engine.py` is the interesting part
with no way to inspect what a rule will do before it fires.

⚠️ **Overlap:** this is performance management; `pr-tracker` is delivery
analytics. Adjacent enough that showcasing both dilutes each. Recommend
`pr-tracker` as flagship and this presented with an explicitly different audience
(HR/managers vs engineering leads).

| # | Feature | Effort |
|---|---|---|
| 1 | **Test suite + CI that verifies before deploying.** Convert the four probe scripts into real pytest coverage with async fixtures over the API layer, add an Alembic upgrade/downgrade round-trip test, and put a gate in front of the existing deploy job. A repo with a deploy pipeline and no assertions undercuts its own badge. | **M** |
| 2 | **Automation rules as an inspectable DSL.** Declarative trigger/condition/action rules stored as data, with a **dry-run preview** ("this rule would fire for 14 users tonight; here they are") and a persistent execution log. Currently a black box. | **M** |
| 3 | **Cascading goal graph.** Org → team → individual alignment as a real DAG with server-computed rollup progress and a view showing which company objective any IC goal rolls into. | **M** |
| 4 | **Review cycles with calibration.** Peer and upward feedback, an anonymity threshold (suppress until N responses), and a calibration view comparing rating distributions across managers. What real performance tools charge for. | **L** |
| 5 | **Immutable cycle snapshots.** Freeze state when a cycle closes so historical reviews can't be retroactively edited; append-only, with `audit.py` recording every post-close mutation attempt. | **M** |
| 6 | **Durable scheduling with tenant timezones.** Check-in nudges and cycle deadlines fired by a durable worker respecting each org's timezone and working days, not a naive in-process cron. | **M** |
| 7 | **Scheduled report delivery.** The openpyxl export exists; add PDF, scheduling, and email at cycle close. | **M** |

**Highest credibility-per-hour: feature 1.**

**Tier 2.**

---
