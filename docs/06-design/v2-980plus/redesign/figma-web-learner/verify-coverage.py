#!/usr/bin/env python3
"""Validate the compact publication candidate; read-only and dependency-free."""
from pathlib import Path
import argparse,hashlib,json,sys

def main():
 ap=argparse.ArgumentParser();ap.add_argument('candidate',nargs='?',default=str(Path(__file__).resolve().parent/'coverage.json'));ap.add_argument('--repo-root',default=str(Path(__file__).resolve().parents[5]));ap.add_argument('--output');a=ap.parse_args()
 p=Path(a.candidate);d=json.loads(p.read_text());repo=Path(a.repo_root);errors=[];warnings=[]
 def require(value,msg):
  if not value:errors.append(msg)
 require(d.get('schemaVersion')=='web-learner-coverage-publication-v1','schema')
 reqs=d.get('requirements',[]);obls=d.get('obligations',[]);excluded=d.get('excludedRequirements',[])
 require(len(reqs)==484 and len({r['id']for r in reqs})==484,'484unique current requirements')
 require(len(excluded)==496 and len({r['id']for r in excluded})==496,'496unique excluded requirements')
 require(len(obls)==291 and len({r['id']for r in obls})==291,'291unique obligations')
 require(not({r['id']for r in reqs}&{r['id']for r in excluded}),'scope overlap')
 require(len({r['id']for r in reqs+excluded})==980,'980scope dispositions')
 sources=d.get('sources',{});lines={}
 for sid,s in sources.items():
  path=d['sourceFiles'][s['fileRef']]['path']if s.get('fileRef')else s['path'];f=repo/path
  if f not in lines:lines[f]=f.read_text().splitlines()if f.exists()else[]
  require(isinstance(s['line'],int)and 0<s['line']<=len(lines[f]),'source line missing '+sid)
  if 0<s['line']<=len(lines[f]):
   text=lines[f][s['line']-1]
   if'text'in s:require(text==s['text'],'current source mismatch '+sid)
   else:require(hashlib.sha256(text.encode()).hexdigest()==s['textSha256']and text.startswith(s['textExcerpt']),'current source mismatch '+sid)
 oid={o['id']for o in obls};rid={r['id']for r in reqs}
 for r in reqs:
  require(r['sourceRef']in sources,'requirement source '+r['id']);require(bool(r['obligationIds']),'unmapped '+r['id']);require(set(r['obligationIds']).issubset(oid),'unknown obligation '+r['id'])
  if r['sourceRef']in sources:require(r['id']in sources[r['sourceRef']].get('text',sources[r['sourceRef']].get('textExcerpt','')),'requirement ID absent current source '+r['id'])
 for o in obls:
  require(set(o['requirementIds']).issubset(rid),'excluded/unknown source used '+o['id']);require(all(s in sources for s in o['sourceRefs']),'obligation source '+o['id']);require(o['figma']['fileKey']=='cbUQgN4Kdd3GrYeDVfF7sk','foreign/mobile frame '+o['id'])
  if 'VERIFIED'in o['designStatus']and o['designStatus']!='UNVERIFIED':
   require(o['semanticReviewComplete'],'native status without semantic review '+o['id']);require(str(o['verification']['native']['status']).startswith('PASS'),'native status without evidence '+o['id'])
 require(sum(o['sourceKind']=='CANONICAL_PAGE'for o in obls)==33,'33PAGE')
 require(sum(o['sourceKind']=='CANONICAL_JOURNEY'for o in obls)==14,'14JNY')
 require(sum(o['sourceKind']=='CANONICAL_LEARNING_RULE'for o in obls)==8,'8RULE')
 all_source_files={s['path']:s for s in d['sourceBaseline']['authoritativeRepoSources']}
 for s in d.get('sourceFiles',{}).values():all_source_files[s['path']]=s
 for s in all_source_files.values():
  f=repo/s['path'];require(f.exists(),'source file missing '+s['path'])
  if f.exists():require(hashlib.sha256(f.read_bytes()).hexdigest()==s['sha256'],'source baseline changed '+s['path'])
 # Verify the portable artifacts that reviewers can actually retrieve with this file.
 qa_ref=d.get('verificationBoundary',{}).get('criticalTimingGate',{}).get('scopedBrowserQA',{})
 qa_file=p.parent/qa_ref.get('artifact','BROWSER-QA-CURRENT.json')
 require(qa_file.exists(),'browser evidence file missing')
 if qa_file.exists():
  require(hashlib.sha256(qa_file.read_bytes()).hexdigest()==qa_ref.get('sha256'),'browser evidence SHA mismatch')
  qa=json.loads(qa_file.read_text())
  for name in qa.get('successfulFlow',{}).get('proof',[]):require((p.parent/name).exists(),'browser proof missing '+name)
  for m in qa.get('actualGuiMutations',[]):
   for key in ['proofBefore','proofAfter']:
    if m.get(key):require((p.parent/m[key]).exists(),'GUI mutation proof missing '+m[key])
 journal_file=p.parent/'WEB-ROOT-UI-MUTATIONS.json'
 require(journal_file.exists(),'GUI mutation journal missing')
 if journal_file.exists():
  journal=json.loads(journal_file.read_text())
  for name in journal.get('browserProof',{}).get('proof',[]):require((p.parent/name).exists(),'journal browser proof missing '+name)
 evidence=p.parent/'evidence'/'manifest.json'
 require(evidence.exists(),'evidence manifest missing')
 if evidence.exists():
  for item in json.loads(evidence.read_text()).get('files',[]):
   f=evidence.parent/item['file'];require(f.exists(),'evidence missing '+item['file'])
   if f.exists():require(hashlib.sha256(f.read_bytes()).hexdigest()==item['sha256'],'evidence SHA mismatch '+item['file'])
 a11y_file=p.parent/'accessibility-review.json'
 if a11y_file.exists():
  for case in json.loads(a11y_file.read_text()).get('cases',[]):
   for ref in case.get('sourceRefs',[]):
    f=repo/ref['path'];require(f.exists(),'accessibility source missing '+ref['path'])
    if f.exists():
     require(hashlib.sha256(f.read_bytes()).hexdigest()==ref['sha256'],'accessibility source SHA mismatch '+ref['path'])
     actual='\n'.join(f.read_text().splitlines()[ref['startLine']-1:ref['endLine']])
     require(actual==ref['excerpt'],'accessibility source excerpt mismatch '+case['id'])
 result={'status':'COMPACT_SOURCE_REFERENCES_VALID_DESIGN_CLOSURE_PENDING'if not errors else'COMPACT_CANDIDATE_ISSUES','requirements':len(reqs),'obligations':len(obls),'excluded':len(excluded),'sourceRecords':len(sources),'errors':errors,'warnings':warnings,'limits':['Source/reference validation only. No native/browser/service acceptance is created.','External raw receipt references retain filename/hash; only explicit scoped native evidence can close design.']}
 if a.output:Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(result,ensure_ascii=False));return bool(errors)
if __name__=='__main__':sys.exit(main())
