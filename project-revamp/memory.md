# Nexorium — durable memory

Context that must survive a context reset. Update continuously, not at the end.

## Identity

- Repo: `F16Samuel/nexorium` (renamed from aqh-samar)
- Product name: **Nexorium** — Goals, Tracked End To End
- Template: UNASSIGNED — see templates.md

## Rules carried from the portfolio work

- Commit as **F16Samuel** (`f16samakasamuel@gmail.com`). The `includeIf` rule in
  `~/.gitconfig` only covers specific directories — verify with
  `git config user.email` before the first commit in a fresh clone.
- **Never** add a `Co-Authored-By: Claude` trailer.
- `gh auth switch --user F16Samuel` — the credential helper only issues a token
  for the *active* account, so pushes fail while the work account is active.

## Do not repeat these mistakes

- **Read the README before describing this project.** Two project descriptions
  in this portfolio were written from repo names and were wrong (`AWSS` is waste
  segregation, not water; `aqh-samar` is a goal tracker, not a hackathon
  platform). One line settles it:
  `gh api repos/F16Samuel/nexorium/readme -q .content | base64 -d | head -20`
- **Do not let the README claim what the code does not do.** Several repos here
  overclaim in checkable ways. Either build the feature or fix the sentence.

## Findings

_(append as you go)_
