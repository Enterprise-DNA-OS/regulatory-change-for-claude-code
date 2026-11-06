INSERT INTO sources(id,code,name,jurisdiction,url,owner,review_days,last_checked) VALUES
('10000000-0000-0000-0000-000000000001','NZ-OPC','NZ privacy guidance','NZ','https://www.privacy.org.nz/privacy-principles/','Morgan',7,current_date-21),
('10000000-0000-0000-0000-000000000002','AU-OAIC','Australian privacy guidance','AU','https://www.oaic.gov.au/privacy/australian-privacy-principles','Casey',14,current_date),
('10000000-0000-0000-0000-000000000003','NZ-MBIE','NZ business notices','NZ','https://www.mbie.govt.nz/','Morgan',7,NULL)
ON CONFLICT DO NOTHING;
INSERT INTO changes(id,external_id,source_id,title,summary,citation,effective_date,review_due,owner,priority) VALUES
('20000000-0000-0000-0000-000000000001','DEMO-001','10000000-0000-0000-0000-000000000001','Review privacy retention practice','Synthetic exercise: reassess evidence retention. This is not a claim of a new law.','https://www.privacy.org.nz/privacy-principles/9/',NULL,current_date-5,'Morgan','high'),
('20000000-0000-0000-0000-000000000002','DEMO-002','10000000-0000-0000-0000-000000000002','Review evidence access controls','Synthetic exercise: review who can read saved assessment evidence.','https://www.oaic.gov.au/privacy/australian-privacy-principles',NULL,current_date+5,'Casey','normal'),
('20000000-0000-0000-0000-000000000003','DEMO-003','10000000-0000-0000-0000-000000000003','Triage business notice','Synthetic notice with an example effective date, not a real regulatory announcement.','https://www.mbie.govt.nz/',current_date+20,current_date+3,'Morgan','high')
ON CONFLICT DO NOTHING;
INSERT INTO assessments(id,change_id,version,decision,rationale,assessed_by) VALUES
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',1,'applicable','Demo decision: evidence access review is in scope.','Casey') ON CONFLICT DO NOTHING;
INSERT INTO actions(id,change_id,title,owner,due_date,status,completed_version,completed_by) VALUES
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Review evidence folder access','Ari',current_date-2,'open',NULL,NULL),
('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Review retained assessment notes','Casey',current_date-7,'done',1,'Casey') ON CONFLICT DO NOTHING;
INSERT INTO evidence(id,action_id,version,reference,description,personal_data,purpose,retention_review,legal_hold,recorded_by) VALUES
('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',1,'DEMO:access-review','Synthetic evidence reference, no personal records included.',true,'Demo retention assessment',current_date-1,true,'Casey') ON CONFLICT DO NOTHING;
