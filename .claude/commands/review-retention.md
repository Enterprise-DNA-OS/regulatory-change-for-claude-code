---
description: Run the regulatory change review retention workflow.
---

# Review Retention

Run `evidence-review`, read the purpose and original record, then `review-retention <evidence-UUID> --purpose=<current-purpose> --retention-review=YYYY-MM-DD --reason=<review-reason> --by=<operator>`. This updates a review record and preserves legal holds. It neither deletes nor decides the lawful retention period.
