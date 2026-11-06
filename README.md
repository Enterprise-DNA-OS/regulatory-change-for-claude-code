# Regulatory Change for Claude Code

Know which regulatory changes still need a decision, who owns the work and what evidence supports sign-off. Your records in a database you own. Built by Enterprise DNA.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free MIT code. Install and run the change desk yourself. | Your fields, rules, export mapping, preferred stack and a web front end if needed. | Installed, connected and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |

[Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=regology).

## Your weekly work

Check the official sources you watch, triage new changes, record impact decisions, chase implementation actions and review the evidence before a different person signs off. Revised facts require fresh decisions and evidence. This is a trusted-operator desk for one business, not a global regulatory intelligence service or legal advice.

Works with Claude Code, Codex, OpenCode or Cursor. Every runtime reads the same commands.

## Start with a private demo

Node 20 or newer:

```bash
npm install
npm test
npm run demo
npm run desk -- triage
npm run desk -- action-chase
npm run desk -- source-watch
npm run view
npm run docs
```

Leave DATABASE_URL unset for the local PGlite demo. Set it only to an operator-controlled Postgres database for shared use. Do not seed production. All notices and decisions in the demo are synthetic, and relative dates deliberately include stale sources and overdue work.

The five weekly rituals are `/source-watch`, `/triage`, `/effective-dates`, `/action-chase` and `/weekly-review`. `/compliance` shows evidence and record gaps with sources. `/draft-review` writes a local draft and never sends it. `npm run desk -- help` documents all flags. Read commands show human tables and support --json. Lookups accept UUID prefixes and unique case-insensitive name fragments; ambiguity lists candidates and exits 1.

## Ten questions to ask across your own records

These are custom queries that run today. We have not tested whether the vendor can answer them in a configured account.

1. Which sources have never been checked? `npm run desk -- insights 1`
2. Which owners have overdue source checks? `npm run desk -- insights 2`
3. Which high-priority changes still lack an assessment? `npm run desk -- insights 3`
4. Which upcoming dates have unfinished actions? `npm run desk -- insights 4`
5. Which applicable changes have no implementation action? `npm run desk -- insights 5`
6. Which owners have overdue actions? `npm run desk -- insights 6`
7. Which completed actions need evidence after a change was revised? `npm run desk -- insights 7`
8. Which personal-information evidence needs a retention review? `npm run desk -- insights 8`
9. Which non-applicable decisions still need independent sign-off? `npm run desk -- insights 9`
10. Which sources account for the unassessed workload? `npm run desk -- insights 10`

## Source checks and evidence

Save reviewed official text privately, then use `check-source` with the source code, file and capture reference. The first capture is a baseline. Changed content creates a triage item. The tool does not fetch pages, decide that a legal change occurred or guarantee coverage. A failed source check must not be logged as successful.

Every mutation records --by. Assessment and sign-off names must differ. Applicable changes need actions; action completion needs evidence for the current change version. Import revisions invalidate current assessments, completion and sign-off while preserving history. Evidence references must be checked against the originals. Actor names are self-declared, and a database administrator can alter the record. See [compliance scope](docs/compliance.md).

## Bring your Regology records

The importer accepts CSV with explicit mapping. The vendor documents CSV interchange and report downloads, but does not publish a standard header layout. Obtain an authorised export and map it once before running:

```bash
npm run desk -- import regology imports/changes.csv --map=imports/mapping.json --dry-run --by="Migration operator"
npm run desk -- import regology imports/changes.csv --map=imports/mapping.json --by="Migration operator"
```

[The replacement guide](docs/replace-regology.md) covers required fields, validation, revision handling, source data rights and reconciliation. The example CSV is synthetic. Historical approvals, attachments and global legal-content feeds need separate migration or connections. A clean mapped register can move in a day; the full switch depends on your coverage and contract.

## Your first hour: ten things to ask for

1. Add the regulators and official sources our business actually watches.
2. Set a weekly source-review interval and name each owner.
3. Show the sources we have never checked.
4. Test our mapped export without saving changes.
5. Record an impact assessment with its source and rationale.
6. Create an implementation action with an agreed owner and date.
7. Attach evidence for the current version and complete the action.
8. Prepare an evidence pack for an independent reviewer.
9. Add a business-unit field using `/customise` and a new migration.
10. Add a read-only management report using `/new-view`.

## Paperwork and views

brand.json controls the business name, logo and colours. Impact assessments and evidence packs render into docs-out/. The week and assurance views render into views/. These are read-only HTML snapshots, printable to PDF. [Why no front end](docs/why-no-front-end.md) explains the base and what a custom interface adds.

## Data ownership and checks

Nine domain tables use UUIDs, timestamps and update triggers. Public privileges are revoked and RLS has no public access policies. This is for trusted operators, not a tenant permission system. Keep imports, snapshots, source captures and generated reports private. The database owner controls access and backups.

`npm run desk -- export exports/review-01` preserves every domain record in JSON plus a change-register CSV. Export is not an automatic restore. Test backup recovery before cutover. Retention reviews preserve legal holds and never delete data.

`npm test` covers source baselines and changes, approvals, version invalidation, current evidence, privacy record checks, atomic imports, dry runs, duplicates, column mapping, CSV roundtrip, generated HTML escaping and real process exit codes. GitHub Actions runs Linux and Windows plus a disposable Postgres database. A local pass does not establish a hosted workflow result.

MIT. Independent of Bloomberg Regology and Anthropic. [See the comparison](https://enterprisedna.co/omni/instead-of/regology?utm_source=github&utm_medium=readme&utm_campaign=regology).
