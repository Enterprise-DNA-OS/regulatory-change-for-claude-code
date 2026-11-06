CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TABLE sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL,
 jurisdiction text NOT NULL CHECK (jurisdiction IN ('NZ','AU','US','OTHER')), url text NOT NULL CHECK(url ~ '^https://'),
 owner text NOT NULL, review_days integer NOT NULL DEFAULT 7 CHECK(review_days BETWEEN 1 AND 365),
 last_checked date, last_hash text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), external_id text UNIQUE NOT NULL, source_id uuid NOT NULL REFERENCES sources,
 title text NOT NULL, summary text NOT NULL, citation text NOT NULL, effective_date date,
 review_due date NOT NULL, owner text NOT NULL, priority text NOT NULL CHECK(priority IN ('high','normal','low')),
 version integer NOT NULL DEFAULT 1, raw_source jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), change_id uuid NOT NULL REFERENCES changes,
 version integer NOT NULL, decision text NOT NULL CHECK(decision IN ('applicable','not-applicable','monitor')),
 rationale text NOT NULL, assessed_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), change_id uuid NOT NULL REFERENCES changes,
 title text NOT NULL, owner text NOT NULL, due_date date NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
 completed_version integer, completed_by text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action_id uuid NOT NULL REFERENCES actions,
 version integer NOT NULL, reference text NOT NULL, description text NOT NULL,
 personal_data boolean NOT NULL DEFAULT false, purpose text, retention_review date, legal_hold boolean NOT NULL DEFAULT false,
 recorded_by text NOT NULL,
 CHECK(NOT personal_data OR (length(trim(purpose))>0 AND retention_review IS NOT NULL)),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE signoffs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), change_id uuid NOT NULL REFERENCES changes,
 version integer NOT NULL, assessment_id uuid NOT NULL REFERENCES assessments,
 signed_by text NOT NULL, reason text NOT NULL, UNIQUE(change_id,version),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE source_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES sources,
 content_hash text NOT NULL, evidence_reference text NOT NULL, checked_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity text NOT NULL, entity_id uuid, event text NOT NULL,
 actor text NOT NULL, detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE import_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), file_hash text NOT NULL, row_count integer NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX actions_change ON actions(change_id);
CREATE INDEX evidence_action ON evidence(action_id);
CREATE INDEX assessments_change ON assessments(change_id,version);
CREATE VIEW v_change_desk AS
 SELECT c.id,c.external_id,c.title,s.code AS source,s.jurisdiction,c.owner,c.priority,c.effective_date,c.review_due,c.version,
 a.decision,a.assessed_by,a.rationale,
 (SELECT count(*)::int FROM actions x WHERE x.change_id=c.id) AS action_count,
 (SELECT count(*)::int FROM actions x WHERE x.change_id=c.id AND (x.status='open' OR x.completed_version IS DISTINCT FROM c.version)) AS unfinished_actions,
 CASE WHEN z.id IS NOT NULL THEN 'signed-off' WHEN a.id IS NULL THEN 'unassessed' ELSE a.decision END AS state
 FROM changes c JOIN sources s ON s.id=c.source_id
 LEFT JOIN LATERAL (SELECT * FROM assessments a WHERE a.change_id=c.id AND a.version=c.version ORDER BY created_at DESC,id DESC LIMIT 1) a ON true
 LEFT JOIN signoffs z ON z.change_id=c.id AND z.version=c.version;
CREATE VIEW v_action_desk AS
 SELECT a.id,a.title,c.external_id,c.title AS change_title,a.owner,a.due_date,a.status,c.version,
 a.completed_version,
 (SELECT count(*)::int FROM evidence e WHERE e.action_id=a.id AND e.version=c.version) AS current_evidence,
 CASE WHEN a.status='done' AND a.completed_version=c.version THEN 'done' WHEN a.due_date<current_date THEN 'overdue' ELSE 'open' END AS state
 FROM actions a JOIN changes c ON c.id=a.change_id;
CREATE VIEW v_source_watch AS
 SELECT id,code,name,jurisdiction,owner,url,review_days,last_checked,
 CASE WHEN last_checked IS NULL THEN 'never checked' WHEN last_checked+review_days<current_date THEN 'overdue' ELSE 'current' END AS state
 FROM sources;
CREATE VIEW v_compliance AS
 SELECT 'SOURCE_REVIEW' AS rule,code AS reference,'Source review missing or overdue (local policy)' AS finding,url AS authority
 FROM v_source_watch WHERE state<>'current'
 UNION ALL SELECT 'IMPACT_REVIEW',external_id,'Impact assessment overdue (local policy)','docs/compliance.md#workflow'
 FROM v_change_desk WHERE state='unassessed' AND review_due<current_date
 UNION ALL SELECT 'ACTION_EVIDENCE',a.title,'Completed action has no evidence for the current change version','docs/compliance.md#workflow'
 FROM v_action_desk a WHERE status='done' AND (current_evidence=0 OR completed_version IS DISTINCT FROM version)
 UNION ALL SELECT 'NZ_IPP9',e.reference,'Review retention purpose for personal information; do not delete on a legal hold','https://www.privacy.org.nz/privacy-principles/9/'
 FROM evidence e JOIN actions a ON a.id=e.action_id JOIN changes c ON c.id=a.change_id JOIN sources s ON s.id=c.source_id
 WHERE s.jurisdiction='NZ' AND e.personal_data AND e.retention_review<current_date
 UNION ALL SELECT 'AU_APP11',e.reference,'Review retention and security for personal information; check applicable exceptions','https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information'
 FROM evidence e JOIN actions a ON a.id=e.action_id JOIN changes c ON c.id=a.change_id JOIN sources s ON s.id=c.source_id
 WHERE s.jurisdiction='AU' AND e.personal_data AND e.retention_review<current_date;
CREATE TRIGGER touch_sources BEFORE UPDATE ON sources FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sources FROM PUBLIC;
CREATE TRIGGER touch_changes BEFORE UPDATE ON changes FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON changes FROM PUBLIC;
CREATE TRIGGER touch_assessments BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON assessments FROM PUBLIC;
CREATE TRIGGER touch_actions BEFORE UPDATE ON actions FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON actions FROM PUBLIC;
CREATE TRIGGER touch_evidence BEFORE UPDATE ON evidence FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON evidence FROM PUBLIC;
CREATE TRIGGER touch_signoffs BEFORE UPDATE ON signoffs FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE signoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON signoffs FROM PUBLIC;
CREATE TRIGGER touch_source_reviews BEFORE UPDATE ON source_reviews FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE source_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON source_reviews FROM PUBLIC;
CREATE TRIGGER touch_history BEFORE UPDATE ON history FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON history FROM PUBLIC;
CREATE TRIGGER touch_import_runs BEFORE UPDATE ON import_runs FOR EACH ROW EXECUTE FUNCTION touch_updated();
ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON import_runs FROM PUBLIC;
REVOKE ALL ON v_change_desk FROM PUBLIC;
REVOKE ALL ON v_action_desk FROM PUBLIC;
REVOKE ALL ON v_source_watch FROM PUBLIC;
REVOKE ALL ON v_compliance FROM PUBLIC;
