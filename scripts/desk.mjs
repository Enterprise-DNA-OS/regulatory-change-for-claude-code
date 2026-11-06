#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv,pick} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const today=()=>new Date().toISOString().slice(0,10);
const required=(v,name)=>{if(typeof v!=='string'||!v.trim())throw Error(`${name} is required`);return v.trim();};
const date=(v,name)=>{required(v,name);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error(`${name} needs a valid YYYY-MM-DD date`);return v;};
const https=v=>{try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password)throw Error();return v;}catch{throw Error('A public HTTPS source URL without credentials is required');}};
const choice=(v,values,name)=>{if(!values.includes(v))throw Error(`${name}: choose ${values.join(', ')}`);return v;};
const bool=(v,name)=>{if(v===undefined)return false;return choice(v,['true','false'],name)==='true';};
export function args(argv){const opts={},pos=[];for(const x of argv){if(x.startsWith('--')){const i=x.indexOf('=');const k=x.slice(2,i<0?undefined:i);if(k in opts)throw Error(`Duplicate flag ${k}`);opts[k]=i<0?true:x.slice(i+1);}else pos.push(x);}return {opts,pos};}
const reads={sources:'select * from v_source_watch order by code',changes:'select * from v_change_desk order by review_due,external_id','triage':'select external_id,title,owner,review_due,priority from v_change_desk where state=\'unassessed\' order by review_due',
 'effective-dates':"select external_id,title,effective_date,owner,state from v_change_desk where effective_date between current_date and current_date+60 order by effective_date",
 'action-chase':"select * from v_action_desk where state<>'done' order by due_date,title",'source-watch':'select * from v_source_watch order by last_checked nulls first',
 'signoffs':'select c.external_id,z.version,z.signed_by,z.reason,z.created_at from signoffs z join changes c on c.id=z.change_id order by z.created_at',
 'evidence-review':'select e.*,c.external_id from evidence e join actions a on a.id=e.action_id join changes c on c.id=a.change_id order by e.retention_review nulls last',
 'compliance':'select * from v_compliance order by rule,reference',
 'history':'select entity,entity_id,event,actor,detail,created_at from history order by created_at,id',
 'attention':"select 'source' as kind,code as reference,state as issue,owner from v_source_watch where state<>'current' union all select 'change',external_id,'assessment overdue',owner from v_change_desk where state='unassessed' and review_due<current_date union all select 'action',title,state,owner from v_action_desk where state='overdue'"};
export const questions=[
 ['Which sources have never been checked?',"select code,name,owner from v_source_watch where last_checked is null"],
 ['Which owners have overdue source checks?',"select owner,count(*)::int as overdue from v_source_watch where state='overdue' group by owner"],
 ['Which high-priority changes still lack an assessment?',"select external_id,title,review_due from v_change_desk where priority='high' and state='unassessed'"],
 ['Which upcoming dates have unfinished actions?',"select external_id,title,effective_date,unfinished_actions from v_change_desk where effective_date between current_date and current_date+60 and unfinished_actions>0"],
 ['Which applicable changes have no implementation action?',"select external_id,title from v_change_desk where decision='applicable' and action_count=0"],
 ['Which owners have overdue actions?',"select owner,count(*)::int as overdue from v_action_desk where state='overdue' group by owner"],
 ['Which completed actions need evidence after a change was revised?',"select external_id,title,version,completed_version from v_action_desk where status='done' and (completed_version is distinct from version or current_evidence=0)"],
 ['Which personal-information evidence needs a retention review?',"select reference,purpose,retention_review,legal_hold from evidence where personal_data and retention_review<current_date"],
 ['Which non-applicable decisions still need independent sign-off?',"select external_id,title,assessed_by,rationale from v_change_desk where state='not-applicable'"],
 ['Which sources account for the unassessed workload?',"select source,count(*)::int as unassessed from v_change_desk where state='unassessed' group by source order by unassessed desc"]
];
async function lookup(db,kind,q){required(q,kind);const cfg={sources:['code','name'],changes:['external_id','title'],actions:['title','title']};const [key,name]=cfg[kind];const rows=await db.query(`select * from ${kind} order by ${key}`);const lower=q.toLowerCase();const exact=rows.filter(r=>String(r[key]).toLowerCase()===lower||r.id===q);const found=exact.length?exact:rows.filter(r=>r.id.startsWith(lower)||String(r[name]).toLowerCase().includes(lower));if(found.length!==1)throw Error(`${kind}: ${found.length?'ambiguous':'no match'} ${q}\n`+found.map(r=>`${r.id} ${r[key]}`).join('\n'));return found[0];}
async function audit(db,entity,id,event,actor,detail){await db.query('insert into history(entity,entity_id,event,actor,detail) values($1,$2,$3,$4,$5)',[entity,id,event,actor,JSON.stringify(detail)]);}
export const help=`Regulatory change desk. All commands support --json. Flags use --name=value.
Read: sources | changes | triage | effective-dates | action-chase | source-watch | attention | compliance | evidence-review | signoffs | history | weekly-review
show <change ID/name> | insights [1..10]
Every write requires --by=<operator>. Operator identity is recorded, not authenticated.
add-source --code= --name= --jurisdiction=NZ|AU|US|OTHER --url=https://... --owner= [--review-days=7]
check-source <source> --file=<saved official text> --reference=<capture evidence>
add-change --external-id= --source= --title= --summary= --citation=https://... --review-due=YYYY-MM-DD --owner= [--effective-date=YYYY-MM-DD] [--priority=normal]
assess <change> --decision=applicable|not-applicable|monitor --rationale=
add-action <change> --title= --owner= --due=YYYY-MM-DD
add-evidence <action> --reference= --description= [--personal=true --purpose= --retention-review=YYYY-MM-DD] [--legal-hold=true]
complete-action <action>
review-retention <evidence UUID> --purpose= --retention-review=YYYY-MM-DD --reason=
sign-off <change> --reason= (different reviewer; current evidence and actions required)
log <change> --note=
import regology <file.csv> [--map=<mapping.json>] [--dry-run] --by=
export <new-directory>
draft-review
No commands send messages, fetch laws or submit filings. Saved source text is supplied by the operator. Demo changes are synthetic.`;
export async function run(db,argv){
 const {opts:o,pos}=args(argv),[cmd='help',arg,arg2]=pos;
 const allowed={
 'add-source':['code','name','jurisdiction','url','owner','review-days'],
 'check-source':['file','reference'], 'add-change':['external-id','source','title','summary','citation','effective-date','review-due','owner','priority'],
 'assess':['decision','rationale'],'add-action':['title','owner','due'],'add-evidence':['reference','description','personal','purpose','retention-review','legal-hold'],
 'complete-action':[],'sign-off':['reason'],'log':['note'],'import':['map','dry-run'],
 'review-retention':['purpose','retention-review','reason']};
 for(const k of Object.keys(o))if(!['json','help',...(cmd in allowed?['by',...allowed[cmd]]:[])].includes(k))throw Error('Unknown flag --'+k);
 for(const k of ['json','help','dry-run'])if(k in o&&o[k]!==true)throw Error('--'+k+' is a switch without a value');
 if(cmd==='help'||o.help)return [{help}];
 if(cmd in reads)return db.query(reads[cmd]);
 if(cmd==='show'){const c=await lookup(db,'changes',arg);return [{change:c,assessments:await db.query('select * from assessments where change_id=$1 order by created_at',[c.id]),actions:await db.query('select * from v_action_desk where external_id=$1',[c.external_id]),history:await db.query('select * from history where entity_id=$1 order by created_at',[c.id])}];}
 if(cmd==='insights'){if(!arg)return questions.map(([question],i)=>({number:i+1,question}));const n=Number(arg);if(!Number.isInteger(n)||n<1||n>10)throw Error('Choose insight 1 to 10');return db.query(questions[n-1][1]);}
 if(cmd==='weekly-review'){const result=[];for(const name of ['triage','action-chase','source-watch'])result.push({section:name,records:await db.query(reads[name])});return result;}
 if(cmd==='draft-review'){const rows=await run(db,['weekly-review']);const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,`review-${today()}-${randomUUID()}.md`);fs.writeFileSync(file,`# Regulatory change review\n\nDraft for operator review. Recorded facts only.\n\n`+rows.map(r=>`## ${r.section}\n\n${JSON.stringify(r.records,null,2)}`).join('\n\n'),{mode:0o600});return [{file}];}
 if(cmd==='export'){required(arg,'new output directory');const dir=path.resolve(arg);if(fs.existsSync(dir))throw Error('Export directory already exists');await db.exec('BEGIN READ ONLY');try{const snapshot={exported_at:new Date().toISOString(),format:1};for(const t of ['sources','changes','assessments','actions','evidence','signoffs','source_reviews','history','import_runs'])snapshot[t]=await db.query(`select * from ${t} order by id`);fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.writeFileSync(path.join(dir,'snapshot.json'),JSON.stringify(snapshot,null,2),{mode:0o600});const rows=await db.query('select c.external_id,s.code as source,c.title,c.summary,c.citation,c.effective_date,c.review_due,c.owner,c.priority from changes c join sources s on s.id=c.source_id order by c.external_id');const keys=['external_id','source','title','summary','citation','effective_date','review_due','owner','priority'];const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';fs.writeFileSync(path.join(dir,'changes.csv'),[keys.map(csv).join(','),...rows.map(r=>keys.map(k=>csv(r[k])).join(','))].join('\r\n')+'\r\n',{mode:0o600});return [{directory:dir,changes:rows.length}];}finally{await db.exec('ROLLBACK');}}
 const actor=required(o.by,'--by');
 await db.exec('BEGIN');
 try{
 let result;
 if(cmd==='add-source'){
  const days=Number(o['review-days']??7);if(!Number.isInteger(days)||days<1||days>365)throw Error('review-days must be 1..365');
  result=await db.query('insert into sources(code,name,jurisdiction,url,owner,review_days) values($1,$2,$3,$4,$5,$6) returning *',[required(o.code,'code'),required(o.name,'name'),choice(o.jurisdiction,['NZ','AU','US','OTHER'],'jurisdiction'),https(o.url),required(o.owner,'owner'),days]);await audit(db,'source',result[0].id,cmd,actor,result[0]);
 }else if(cmd==='check-source'){
  const s=await lookup(db,'sources',arg);await db.query('select id from sources where id=$1 for update',[s.id]);const current=(await db.query('select * from sources where id=$1',[s.id]))[0];
  const content=fs.readFileSync(required(o.file,'file'));if(!content.length||content.length>5_000_000)throw Error('Source text must be nonempty and at most 5 MB');const digest=hash(content);const ref=required(o.reference,'reference');
  await db.query('insert into source_reviews(source_id,content_hash,evidence_reference,checked_by) values($1,$2,$3,$4)',[s.id,digest,ref,actor]);
  const changed=!!current.last_hash&&current.last_hash!==digest;let c;
  if(changed){c=(await db.query("insert into changes(external_id,source_id,title,summary,citation,review_due,owner,priority) values($1,$2,$3,$4,$5,current_date+7,$6,'normal') returning *",['MON-'+randomUUID().slice(0,12),s.id,s.name+' source text changed','Saved source text hash changed. Human review must distinguish a legal change from page layout edits. Capture: '+ref,s.url,s.owner]))[0];await audit(db,'change',c.id,'source-change',actor,{old_hash:current.last_hash,new_hash:digest});}
  await db.query('update sources set last_checked=current_date,last_hash=$2 where id=$1',[s.id,digest]);await audit(db,'source',s.id,cmd,actor,{digest,reference:ref,changed});result=[{source:s.code,baseline:!current.last_hash,changed,change:c?.external_id??null}];
 }else if(cmd==='add-change'){
  const s=await lookup(db,'sources',o.source);result=await db.query('insert into changes(external_id,source_id,title,summary,citation,effective_date,review_due,owner,priority) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[required(o['external-id'],'external-id'),s.id,required(o.title,'title'),required(o.summary,'summary'),https(o.citation),o['effective-date']?date(o['effective-date'],'effective-date'):null,date(o['review-due'],'review-due'),required(o.owner,'owner'),choice(o.priority||'normal',['high','normal','low'],'priority')]);await audit(db,'change',result[0].id,cmd,actor,result[0]);
 }else if(['assess','add-action','sign-off','log'].includes(cmd)){
  const found=await lookup(db,'changes',arg);const c=(await db.query('select * from changes where id=$1 for update',[found.id]))[0];
  if(cmd==='assess'){
   if((await db.query('select id from signoffs where change_id=$1 and version=$2',[c.id,c.version])).length)throw Error('Current version is signed off; revise imported change facts before reassessment');
   result=await db.query('insert into assessments(change_id,version,decision,rationale,assessed_by) values($1,$2,$3,$4,$5) returning *',[c.id,c.version,choice(o.decision,['applicable','not-applicable','monitor'],'decision'),required(o.rationale,'rationale'),actor]);
  }else if(cmd==='add-action'){
   if((await db.query('select id from signoffs where change_id=$1 and version=$2',[c.id,c.version])).length)throw Error('Cannot add work to a signed-off version');
   result=await db.query('insert into actions(change_id,title,owner,due_date) values($1,$2,$3,$4) returning *',[c.id,required(o.title,'title'),required(o.owner,'owner'),date(o.due,'due')]);
  }else if(cmd==='sign-off'){
   const a=(await db.query('select * from assessments where change_id=$1 and version=$2 order by created_at desc,id desc limit 1',[c.id,c.version]))[0];
   if(!a||a.decision==='monitor')throw Error('Current definitive impact assessment is required');
   if(a.assessed_by.toLowerCase()===actor.toLowerCase())throw Error('A different reviewer must sign off');
   const actions=await db.query('select * from v_action_desk where external_id=$1',[c.external_id]);
   if(a.decision==='applicable'&&!actions.length)throw Error('Applicable change needs an implementation action');
   if(actions.some(x=>x.state!=='done'||!x.current_evidence))throw Error('Complete every action with current-version evidence first');
   result=await db.query('insert into signoffs(change_id,version,assessment_id,signed_by,reason) values($1,$2,$3,$4,$5) returning *',[c.id,c.version,a.id,actor,required(o.reason,'reason')]);
  }else result=[{note:required(o.note,'note')}];
  await audit(db,'change',c.id,cmd,actor,result[0]);
 }else if(['add-evidence','complete-action'].includes(cmd)){
  const found=await lookup(db,'actions',arg);const c=(await db.query('select * from changes where id=$1 for update',[found.change_id]))[0];const a=(await db.query('select * from actions where id=$1 for update',[found.id]))[0];
  if((await db.query('select id from signoffs where change_id=$1 and version=$2',[c.id,c.version])).length)throw Error('Current version is signed off');
  if(cmd==='add-evidence'){
   const personal=bool(o.personal,'personal'),hold=bool(o['legal-hold'],'legal-hold');const purpose=personal?required(o.purpose,'purpose'):o.purpose||null;const retention=o['retention-review']?date(o['retention-review'],'retention-review'):null;if(personal&&!retention)throw Error('Personal data requires retention-review');
   result=await db.query('insert into evidence(action_id,version,reference,description,personal_data,purpose,retention_review,legal_hold,recorded_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[a.id,c.version,required(o.reference,'reference'),required(o.description,'description'),personal,purpose,retention,hold,actor]);
  }else{
   if(!(await db.query('select id from evidence where action_id=$1 and version=$2',[a.id,c.version])).length)throw Error('Current-version evidence is required');
   result=await db.query("update actions set status='done',completed_version=$2,completed_by=$3 where id=$1 returning *",[a.id,c.version,actor]);
  }
  await audit(db,'change',c.id,cmd,actor,result[0]);
  }else if(cmd==='review-retention'){
   required(arg,'evidence UUID');const e=(await db.query('select * from evidence where id::text=$1 for update',[arg]))[0];if(!e)throw Error('Evidence not found');
   const review=date(o['retention-review'],'retention-review');if(review<today())throw Error('New retention review must be today or later');
   const reason=required(o.reason,'reason');result=await db.query('update evidence set purpose=$2,retention_review=$3 where id=$1 returning *',[e.id,required(o.purpose,'purpose'),review]);
   await audit(db,'evidence',e.id,cmd,actor,{previous:e,current:result[0],reason});
 }else if(cmd==='import'){
  if(arg!=='regology')throw Error('Import format must be regology');const file=required(arg2,'CSV file');const content=fs.readFileSync(file,'utf8');const rows=parseCsv(content);if(!rows.length)throw Error('CSV contains no records');
  const mapping=o.map?JSON.parse(fs.readFileSync(o.map,'utf8')):{};if(!mapping||Array.isArray(mapping)||typeof mapping!=='object')throw Error('Mapping must be an object');
  const aliases={external_id:['external_id','External ID','Change ID','ID'],source:['source','Source Code'],title:['title','Title','Name'],summary:['summary','Summary','Description'],citation:['citation','Source URL','URL'],effective_date:['effective_date','Effective Date'],review_due:['review_due','Review Due'],owner:['owner','Owner'],priority:['priority','Priority']};
  for(const [k,v] of Object.entries(mapping))if(!(k in aliases)||typeof v!=='string'||!v)throw Error('Unknown mapping key or invalid header: '+k);
  const seen=new Set(),staged=[];
  for(const row of rows){const x={};for(const [k,names] of Object.entries(aliases)){if(mapping[k]&&!Object.keys(row).includes(mapping[k]))throw Error('Mapped header missing: '+mapping[k]);x[k]=mapping[k]?row[mapping[k]]:pick(row,...names);}
   for(const k of ['external_id','source','title','summary','citation','review_due','owner'])x[k]=required(x[k],k);
   if(seen.has(x.external_id))throw Error('Duplicate external ID in file: '+x.external_id);seen.add(x.external_id);
   x.citation=https(x.citation);x.review_due=date(x.review_due,'review_due');x.effective_date=x.effective_date?date(x.effective_date,'effective_date'):null;x.priority=choice(x.priority?.toLowerCase()||'normal',['high','normal','low'],'priority');x.source_id=(await lookup(db,'sources',x.source)).id;x.raw=row;staged.push(x);
  }
  let inserted=0,updated=0,unchanged=0;
  for(const x of staged){const old=(await db.query('select * from changes where external_id=$1 for update',[x.external_id]))[0];const keys=['source_id','title','summary','citation','effective_date','review_due','owner','priority'];
   if(old&&keys.every(k=>old[k]===x[k])){unchanged++;continue;}
   let c;if(old){if(old.source_id!==x.source_id)throw Error('Changing source on an existing external ID is refused: '+x.external_id);c=(await db.query('update changes set title=$2,summary=$3,citation=$4,effective_date=$5,review_due=$6,owner=$7,priority=$8,raw_source=$9,version=version+1 where id=$1 returning *',[old.id,x.title,x.summary,x.citation,x.effective_date,x.review_due,x.owner,x.priority,JSON.stringify(x.raw)]))[0];updated++;}
   else{c=(await db.query('insert into changes(external_id,source_id,title,summary,citation,effective_date,review_due,owner,priority,raw_source) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *',[x.external_id,x.source_id,x.title,x.summary,x.citation,x.effective_date,x.review_due,x.owner,x.priority,JSON.stringify(x.raw)]))[0];inserted++;}
   await audit(db,'change',c.id,'import',actor,{previous:old||null,current:c});
  }
  await db.query('insert into import_runs(file_hash,row_count,actor) values($1,$2,$3)',[hash(content),staged.length,actor]);result=[{rows:staged.length,inserted,updated,unchanged,dry_run:!!o['dry-run']}];
 }else throw Error('Unknown command: '+cmd+'; run help');
 await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
export function format(rows){if(rows[0]?.section)return rows.map(r=>r.section+'\n'+format(r.records)).join('\n\n');if(!rows.length)return '(none)';if(rows[0].help)return rows[0].help;const keys=('current_evidence' in rows[0])?['title','external_id','owner','due_date','state','current_evidence']:('last_checked' in rows[0]&&'code' in rows[0])?['code','name','owner','last_checked','state']:('unfinished_actions' in rows[0])?['external_id','title','owner','review_due','state','unfinished_actions']:Object.keys(rows[0]).filter(k=>!['raw_source','created_at','updated_at'].includes(k));return table(rows,keys.map(k=>({key:k,label:k.replaceAll('_',' '),width:52,format:v=>typeof v==='object'&&v!==null?JSON.stringify(v):v})));}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const rows=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(rows,null,2):format(rows));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
