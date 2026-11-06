# Move the change register from Bloomberg Regology

The first cut is a reviewed change-register import. Keep your existing service until source coverage, open work and evidence have been reconciled.

## What the vendor documents

The [pricing page](https://www.regology.com/pricing), checked 6 November 2026, lists downloadable reports. The [integrations page](https://www.regology.com/integrations) documents CSV interchange alongside other formats. These pages do not publish fixed column headers or a universal one-click export path. Use your authorised report export or ask your administrator for a CSV of the change register. Confirm your contractual rights before retaining licensed material. This project has not been tested against a live Regology tenant export.

## One import command after mapping

1. Obtain the authorised CSV with a stable change identifier, title, summary, source citation, assigned owner and review due date. Bring effective dates only when known. Export original assessments, documents and task history separately for your archive.
2. Add each regulator/source using `npm run desk -- add-source`. The import source code maps each row to one of these records. Source codes, review dates and owners absent from the vendor file must be deliberately added by the responsible operator, never inferred from a law title.
3. Read the headings. `examples/regology.csv` is a synthetic compatibility fixture, not an authentic vendor export. `examples/import-map.json` demonstrates a mapping from the project's canonical field names to your actual column headers. Omit unchanged headings from the map. Canonical headings work without --map.
4. Run the same one-command importer in test mode first:

```bash
npm run desk -- import regology imports/changes.csv --map=imports/mapping.json --dry-run --by="Migration operator"
npm run desk -- import regology imports/changes.csv --map=imports/mapping.json --by="Migration operator"
```

Dates must use YYYY-MM-DD. Unknown effective dates stay blank. Source citations must be HTTPS URLs without credentials. Priority is high, normal or low. Unknown status columns are retained in raw_source, not treated as valid assessments or approvals. All mapped and extra source columns are preserved on insertion and revision.

The importer rejects malformed rows, duplicate IDs, missing required fields, invalid dates and unknown sources. The whole file rolls back on any failure. Repeated imports with unchanged operational fields do nothing. Updated operational fields increment the version, preserve previous facts in history and require fresh assessment, action evidence and sign-off. Changes to unmapped extra fields alone do not create a revision. Existing external IDs cannot silently move to a different source.

## Reconcile before cutover

Check record counts, IDs, source coverage, citations, blank effective dates and a sample of values against the export. Review every owner and due date added during mapping. Do not import approvals as completed work: re-record and verify the decisions and evidence. Run both systems through a full review cycle and read the original contract for renewal and notice obligations.

The free base does not include the vendor's global legal library, licensed summaries, continuous alerts, permissions, integrations or document attachments. Existing workflows, source monitoring and retained licensed content require separate scope and permission. Enterprise DNA can map and migrate your records and build agreed connections into your version. The one-day promise applies to a clean, mapped change register, not a full service replacement or contract exit.

## Export and recovery

`npm run desk -- export exports/review-01` writes a complete JSON snapshot and an interoperable change CSV to a new private directory. The CSV supports change-register re-import after sources are created. The JSON is an archive, not an automatic restore. Back up a stopped PGlite directory or use managed Postgres backups, and test recovery before production use. CSV text is preserved exactly, so open untrusted exports as text instead of allowing spreadsheet formula execution.
