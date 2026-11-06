# Regulatory Change for Claude Code

Business: [your business]. Operator: [your name]. Keep the sources, decisions and evidence behind each regulatory change together.

Read the command matching the job in `.claude/commands/`. Every answer starts with an actual CLI read. Flags use `--name=value`. All commands support `--json`. For details run `npm run desk -- help`.

## One route per job

| /sources | Run `npm run desk -- sources`. |
| /changes | Run `npm run desk -- changes`. |
| /show | Run `npm run desk -- show <change>`. |
| /triage | Run `npm run desk -- triage`. |
| /effective-dates | Run `npm run desk -- effective-dates`. |
| /action-chase | Run `npm run desk -- action-chase`. |
| /source-watch | Run `npm run desk -- source-watch`. |
| /attention | Run `npm run desk -- attention`. |
| /compliance | Read `docs/compliance.md`, then run `npm run desk -- compliance`. |
| /evidence-review | Run `npm run desk -- evidence-review`. |
| /signoffs | Run `npm run desk -- signoffs`. |
| /history | Run `npm run desk -- history`. |
| /insights | Run `npm run desk -- insights` for ten questions, then `npm run desk -- insights <number>`. |
| /add-source | Run `npm run desk -- help`, then `add-source` with the requested code, name, jurisdiction, public HTTPS URL, owner and local review interval. |
| /check-source | Read the official source. |
| /add-change | Run `npm run desk -- help`. |
| /assess | Read `show <change>` and the official citation. |
| /add-action | Read `show <change>`. |
| /add-evidence | Read `action-chase` and `show`. |
| /complete-action | Read the action and original evidence. |
| /review-retention | Run `evidence-review`, read the purpose and original record, then `review-retention <evidence-UUID> --purpose=<current-purpose> --retention-review=YYYY-MM-DD --reason=<review-reason> --by=<operator>`. |
| /sign-off | Read `show <change>` and original action evidence. |
| /log | Read `show <change>`, then `log <change> --note=<factual-note> --by=<operator>`. |
| /import | Read `docs/replace-regology.md`. |
| /export | Run `npm run desk -- export <new-private-directory>`. |
| /weekly-review | Run `npm run desk -- triage`, `npm run desk -- action-chase` and `npm run desk -- source-watch`. |
| /draft-review | Run `npm run desk -- draft-review`. |
| /customise | Read CLAUDE.md and the schema. |
| /new-view | Read `views.json` and the SQL views. |

## Rules

Every mutation requires the real requesting operator in --by. Names are recorded assertions, not authenticated identities. The system is for trusted database operators in one business, not tenants or public users. RLS has no public policies, and tables and views revoke public access. Do not expose database credentials or publish exports.

Read the source citation before an impact assessment. The tool records human judgement; it does not issue legal advice. Source text checks compare locally saved files by hash. A layout edit can trigger a change and an unavailable source must remain unchecked. There is no global legal-content feed. An unknown date stays unknown.

A definitive assessment and a different reviewer are needed for sign-off. Applicable changes need an implementation action. Actions require evidence for the current change version. Revised imports invalidate current assessments, action completion and sign-off. Original records stay in history. Never pass a gate by inventing evidence or a reviewer.

Use docs/compliance.md to distinguish privacy principles from local workflow policy. No deletion command exists. Retention review changes preserve legal holds. Do not put real personal data into demo seed data or examples.

DATABASE_URL selects operator-managed Postgres; otherwise PGlite persists in .data/db. npm test ignores production DATABASE_URL and uses temporary embedded data unless TEST_DATABASE_URL explicitly names an empty disposable database. Seed only a demo database. Keep source files, backups, drafts, captures and exports private. Test recovery before switching systems.

Never send, publish a report, submit a filing, or use a customer's account without their explicit instruction. Draft locally. Schema changes use a new migration, never an edit to an applied file. The same command library serves Claude Code, Codex, OpenCode and Cursor.

Omni by Enterprise DNA customises and operates this system. One setup fee, then a retainer.
