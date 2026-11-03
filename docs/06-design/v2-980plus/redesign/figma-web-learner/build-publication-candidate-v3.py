#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Local, parameterized publication snapshot. Never writes source D files or any repo."""
from pathlib import Path
from datetime import datetime,timezone
import argparse,copy,json,hashlib,shutil,re
D=Path(__file__).resolve().parent.parent;BASE=D/'publication-candidate-v2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def un(x):
 if isinstance(x,dict)and x.get('structuredContent')is not None:return un(x['structuredContent'])
 if isinstance(x,dict)and'content'in x:
  for c in x['content']:
   if c.get('type')=='text':
    try:return un(json.loads(c['text']))
    except json.JSONDecodeError:pass
 return x
def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--output-dir',default=str(Path(__file__).parent));ap.add_argument('--repo-root',default='/Users/Admin/.codex/worktrees/figma-web-coverage-20261103/cloudstudy')
 ap.add_argument('--auth-recovery-receipt');ap.add_argument('--auth-recovery-readback',action='append',default=[]);ap.add_argument('--auth-recovery-accepted',action='store_true',help='Root explicit scoped acceptance after reviewing all supplied actual native proofs; never inferred from filenames/models')
 ap.add_argument('--expected-root-count',type=int,default=1074);a=ap.parse_args();O=Path(a.output_dir).resolve();R=Path(a.repo_root).resolve();T=R/'docs/06-design/v2-980plus/redesign/figma-web-learner'
 assert O.is_relative_to(D)and O!=D and not O.is_relative_to(BASE),'Output must be a new/local v3 directory, never D root/v2/repo'
 O.mkdir(exist_ok=True);(O/'evidence').mkdir(exist_ok=True)
 if Path(__file__).resolve()!=O/Path(__file__).name:shutil.copyfile(__file__,O/Path(__file__).name)
 def read(n):return json.loads((D/n).read_text())
 def write(n,x):(O/n).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
 def text(n,s):(O/n).write_text(s)
 now=datetime.now(timezone.utc).isoformat();stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')
 frozenV2={p.name:sha(p)for p in BASE.iterdir()if p.is_file()};srcNames=['CURRENT-WEB-COVERAGE-CHECKPOINT-v3.json','BROWSER-QA-CURRENT.json','WEB-ROOT-UI-MUTATIONS.json','RESUME-WEB-COVERAGE-v4.md'];sourcePins={n:sha(D/n)for n in srcNames}
 oldReview=json.loads((BASE/'review-v2.json').read_text());oldIdx=json.loads((BASE/'actual-receipt-index.json').read_text());oldEvidence=json.loads((BASE/'evidence-index.json').read_text());checkpoint=read(srcNames[0]);qa=read(srcNames[1]);ui=read(srcNames[2]);files={};pairs=[]
 def ev(n,kind='ACTUAL_EVIDENCE',reason='',dest=None):
  p=Path(n);p=p if p.is_absolute()else D/p;assert p.is_file(),p;dest=dest or'evidence/'+p.name
  if dest not in files:
   shutil.copyfile(p,O/dest);files[dest]={'sourceFile':str(p.relative_to(D))if p.is_relative_to(D)else p.name,'destination':dest,'sha256':sha(p),'bytes':p.stat().st_size,'kind':kind,'reason':reason,'unalteredSource':True}
  else:assert files[dest]['sha256']==sha(p),(p,dest,'evidence collision')
  return {'path':dest,'sha256':files[dest]['sha256']}
 def pair(raw,parsed=None,kind='RAW_NATIVE_RESULT'):
  data=un(read(raw));r=ev(raw,kind,'Actual unedited raw result; status judged separately')
  if parsed:
   assert data==read(parsed),(raw,parsed);p=ev(parsed,'NORMALIZED_NATIVE_RESULT','Normalized actual content equals raw')
  else:
   dest='evidence/'+Path(raw).stem+'-normalized.json';write(dest,data);files[dest]={'sourceFile':raw,'destination':dest,'sha256':sha(O/dest),'bytes':(O/dest).stat().st_size,'kind':'DERIVED_NORMALIZED_RESULT','reason':'Raw preserved; this is parsed content only','unalteredSource':False};p={'path':dest,'sha256':files[dest]['sha256']}
  pairs.append({'raw':r,'parsed':p,'equalUnwrappedContent':True});return data,r,p
 for f in oldEvidence['files']:ev(BASE/f['destination'],f['kind'],'Frozen v2 evidence retained unchanged',f['destination'])
 for oldPair in oldEvidence['rawNormalizedPairs']:
  assert un(json.loads((BASE/oldPair['raw']['path']).read_text()))==json.loads((BASE/oldPair['parsed']['path']).read_text());pairs.append(copy.deepcopy(oldPair))
 snapshots={n:ev(n,'CURRENT_ROOT_SNAPSHOT','Copied without changing D source; pending/failure status is authoritative for its scope',f'evidence/{Path(n).stem}-source-v3-{stamp}{Path(n).suffix}')for n in srcNames}
 # Exact16source SHA on the new isolated worktree; no writes or branch changes.
 srcIntegrity=json.loads((BASE/'source-integrity.json').read_text());sourceRows=srcIntegrity['files']
 for s in sourceRows:
  h=sha(R/s['path']);assert h==s['sha256'],('source baseline drift',s['path']);s['currentSha256']=h;s['unchanged']=True
 assert len(sourceRows)==16
 idx=copy.deepcopy(oldIdx);additions=[];reads=[];deps=copy.deepcopy(json.loads((BASE/'dependency-hash-index.json').read_text())['items']);allRoots=idx['actualRootIndex'];seen={r['id']for r in allRoots}
 def accept(key,raw,parsed,expectedRoots=None):
  x,r,p=pair(raw,parsed);assert not read(raw).get('isError')and not x.get('errors')and not x.get('failures'),raw
  assert not any(b in x.get('status','')for b in ['PARTIAL_FAILURE','ROLLED_BACK','BLOCKED','HOLD']),raw
  rs=x.get('roots',[])
  if expectedRoots is not None:assert len(rs)==expectedRoots,(raw,'root count')
  z={'key':key,'status':x.get('status'),'raw':r,'parsed':p,'createdRootIds':[u['id']for u in rs],'createdRootCount':len(rs),'createdNativeNodeCount':x.get('createdNodeIdCount',0),'createdVariableCount':len(set(x.get('createdVariableIds',[]))),'mutatedNodeIds':x.get('mutatedNodeIds',[]),'nativeReceiptActuallySuccessful':True,'semanticClosure':'UNVERIFIED','doNotReplay':True,'limits':x.get('limits',[])}
  additions.append(z)
  for u in rs:
   assert u['id']not in seen and u['id']in x['createdNodeIdsCsv'].split(','),(u['id'],'not unique/current creation');seen.add(u['id']);allRoots.append({'id':u['id'],'name':u['name'],'width':u['width'],'height':u['height'],'actualReceipt':r,'createdBatch':key,'figmaUrl':'https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id='+u['id'].replace(':','-'),'provenanceClass':'ACTUAL_NEW_ROOT_CANDIDATE_ONLY'})
  return x,z
 first,firstRow=accept('FIRSTDAY16','access-firstday-recovery-v2-calibrated-v1-write-result.json','access-firstday-recovery-v2-calibrated-v1-parsed.json',16)
 glob,globalRow=accept('GLOBAL_SCOPE12','global-scope-ui12-v2-write-result.json','global-scope-ui12-v2-parsed.json',12)
 firstRow.update(privateVariableIds=first['privateVariables'],privateMasks=first['privateMasks'],actualSourcePatches=first['actualSourcePatches'],integrationRequests=first['integrationRequests'],sourceProvenance=first['sourceProvenance'],coverageStatus='CREATED_SOURCE_ENTRY_PATCHES_RECORDED_FURTHER_PRIVATE_TASK_BINDINGS_QA_OPEN')
 globalRow.update(scopeVariableIds=glob['scopeVariableIds'],sourceDeps=glob['sourceDeps'],defaultPrivateAllowed=glob['defaultPrivateAllowed'],defaultHistoryAllowed=glob['defaultHistoryAllowed'],proofBoundary=glob['proofBoundary'],coverageStatus='TWELVE_TARGETS_CREATED_EXACT_SOURCE_BINDINGS_OPEN')
 assert glob['defaultPrivateAllowed']is False and glob['defaultHistoryAllowed']is False
 # Discover only named authoritativeSource19 plan units with actual matching successful receipts. No READY/model status is admitted.
 plan=read('practice-source19-v2-plan.json');knownInV2={'read-controls-r1'};sourceDone=[]
 for b in plan['batches']:
  key=b['key'];raw=f'practice-source19-v2-{key}-write-result.json';parsed=f'practice-source19-v2-{key}-parsed.json'
  if not(D/raw).exists():continue
  x=un(read(raw));prefix='PATCHED_EXACT_ORIGINAL_PRACTICE_SOURCE_V2_'+key
  if not x.get('status','').startswith(prefix)or x.get('errors')or read(raw).get('isError'):continue
  sourceDone.append(key)
  if key in knownInV2:continue
  x,z=accept('SOURCE19_'+key,raw,parsed,0);z.update(source19Key=key,selectedReactionIndices=x['selectedReactionIndices'],preservedControls=x['preservedControls'],scope=x['scope'],nativeReadbackStatus='PENDING_FULL_CURRENT_NATIVE_FLOW_QA')
  for field,fn in [('coreReceiptSha256','practice-original-facts-core-v2-UI14-calibrated-v1-parsed.json'),('timingCalibrationSha256','timeout-calibration.verified.json'),('sourceGuardsSha256','practice-original-facts-source-guards.json'),('sourceEngineSha256','practice-original-facts-engine.js')]:
   assert sha(D/fn)==x[field];deps.append({'sourceBatch':key,'field':field,'evidence':ev(fn,'EXACT_SOURCE_DEPENDENCY','Receipt-reported dependency SHA verified'),'shaMatches':True})
 assert all(k in sourceDone for k in ['read-controls-r1','read-controls-r2','read-views-r1-input'])
 remaining=[b['key']for b in plan['batches']if b['key']not in sourceDone]
 # Three huge programs: only actual in-native full hash comparison metadata is exported, no full graphs or business acceptance.
 prog,pr,pp=pair('practice-core-position-copy-after-native-v1-raw.json','practice-core-position-copy-after-native-v1.json','RAW_READ_ONLY_NATIVE_VERIFICATION');expect=read('practice-core-position-copy-after-expected-v1.json');expected={r['rootId']:r for r in expect['roots']}
 assert prog['documentMutations']==0 and prog['totalProgressStrings']==20 and prog['fullActionsExported']is False and prog['businessAcceptance']is False and len(prog['roots'])==3
 for r in prog['roots']:
  e=expected[r['rootId']];assert r['completeProgramMatchesExpectedAfter']and r['triggerPreserved']and r['oldLiteralCount']==0 and r['positionStringsMatch'];assert r['currentCanonicalSha256']==e['expectedAfterSha256']and r['currentCanonicalUtf8Bytes']==e['expectedAfterUtf8Bytes']
 reads.append({'kind':'CORE_THREE_PROGRAMS_TWENTY_LITERAL_NATIVE_HASH_COMPARISON','raw':pr,'parsed':pp,'expected':ev('practice-core-position-copy-after-expected-v1.json','EXPECTED_COMPARISON_PLAN','Local expected hash compared with actual native result'),'roots':prog['roots'],'totalProgressStrings':20,'fullActionsExported':False,'businessAcceptance':False})
 # Source dependencies for new body batches, clearly preserving oldpreparation tags.
 for n in ['access-firstday-recovery-v2-calibrated-v1-manifest.json','global-scope-ui12-v2-manifest.json','global-scope-current-actual-deps-v2.json','global-scope-ui12-v2-deps.json']:
  ev(n,'PRE_EXECUTION_DEPENDENCY_SNAPSHOT','Actual successful receipt overrides its historicalNOT_RUN tag for exact scope only')
 for field in ['helper','calibration','currentSource13']:
  value=read('access-firstday-recovery-v2-calibrated-v1-manifest.json').get(field)
  if isinstance(value,dict)and value.get('path')and value.get('sha256'):
   target=Path(value['path']);target=target if target.is_absolute()else D/target
   assert sha(target)==value['sha256'];deps.append({'sourceBatch':'FIRSTDAY16','field':field,'evidence':ev(target,'ACTUAL_FIRSTDAY_DEPENDENCY','Manifest exact source/helper/contract SHA'),'shaMatches':True})
 fm=read('access-firstday-recovery-v2-calibrated-v1-manifest.json')
 c13=fm['currentSource13']
 for tag,path,h in [('source13raw',c13['raw'],c13['rawSha256']),('source13parsed',c13['parsed'],c13['sha256'])]+[(name,value['receipt'],value['sha256'])for name,value in fm['actualDependencies'].items()if isinstance(value,dict)and value.get('receipt')and value.get('sha256')]:
  assert sha(D/path)==h;deps.append({'sourceBatch':'FIRSTDAY16','field':tag,'evidence':ev(path,'FIRSTDAY_ACTUAL_RECEIPT_OR_SOURCE_PIN','Exact captured dependency; hook hashes need re-read afterAuthfailure recovery'),'shaMatches':True})
 for r in glob['sourceDeps']:
  assert sha(D/r['path'])==r['sha256'];deps.append({'sourceBatch':'GLOBAL12','evidence':ev(r['path'],'ACTUAL_BODY_DEPENDENCY','Receipt-reported exact current dependency'),'shaMatches':True})
 for raw,parsed in [('access-firstday-recovery-v2-calibrated-v1-current-source13-raw.json','access-firstday-recovery-v2-calibrated-v1-current-source13-parsed.json'),('global-scope-current-hooks-v2-native-raw-result.json','global-scope-current-hooks-v2-native-parsed.json')]:
  data,r,p=pair(raw,parsed,'ACTUAL_PRE_CREATION_SOURCE_READ');reads.append({'kind':'PRE_CREATION_CURRENT_SOURCE_GUARD','raw':r,'parsed':p,'notAPostFlowPass':True})
 # Current authcleanform failure is NEVER a successfulreceipt or new root, even if rollback touched new andold IDs.
 fail,fr,fp=pair('access-auth-cleanform-v1-write-result.json','access-auth-cleanform-v1-parsed.json','FAILED_NATIVE_MUTATION_PARTIAL_ROLLBACK');assert fail['status']=='PARTIAL_FAILURE_READ_BEFORE_RETRY'and fail['rollbackComplete']is False
 failedLedger={'schemaVersion':'web-publication-failure-recovery-v3','status':'HOLD_WAIT_AUTH_RECOVERY','failure':{'raw':fr,'parsed':fp,'status':fail['status'],'error':fail['error'],'rollbackComplete':False,'failures':fail['failures'],'attemptedCreatedIdsCsv':fail['createdIdsCsv'],'reportedMutatedIdsCsv':fail['mutatedIdsCsv'],'neverCountAsSuccessfulReceipt':True,'neverCountAsSuccessfulNewRoot':True,'interpretation':'Host rejected removal of4old nestedI426TEXT misclassified ascreated; this does not prove complete currentAuth programs/variables/layout restored. No blanket deletion or mainretry permitted from this report.'},'diagnosticReads':[],'recovery':None,'currentAuth16Readiness':'P0_CURRENT_INTEGRITY_NOT_ACCEPTED','gateReasons':[],'wholeBusinessAccepted':False}
 diagnostic='access-auth-cleanform-recovery-READ01-native-v1-raw.json'
 if(D/diagnostic).exists():
  d,r,p=pair(diagnostic,None,'FAILED_READ_ONLY_DIAGNOSTIC');failedLedger['diagnosticReads'].append({'raw':r,'parsed':p,'isError':bool(read(diagnostic).get('isError')),'status':'READ_FAILED_NO_INTEGRITY_ACCEPTANCE','message':d.get('error',{}).get('message')if isinstance(d,dict)else str(d)})
 accepted=False
 def resolveArg(v):
  p=Path(v);return p if p.is_absolute()else D/p
 if a.auth_recovery_receipt:
  p=resolveArg(a.auth_recovery_receipt);rawObj=json.loads(p.read_text());rec=un(rawObj);ref=ev(p,'AUTH_CURRENT_STATE_COMBINED_READ_REVIEW'if rec.get('recoveryDocumentWrites')==0 else'AUTH_RECOVERY_ACTUAL_RECEIPT','Explicit recovery/recheck input; originalfailure never erased or reclassified');rb=[];bad=[]
  if rawObj.get('isError')or rec.get('errors')or rec.get('failures')or rec.get('rollbackComplete')is False or rec.get('status','').startswith(('PARTIAL_FAILURE','BLOCKED','HOLD','FAILED')):bad.append('Recovery receipt does not establish successful complete recovery')
  for name in a.auth_recovery_readback:
   p2=resolveArg(name);rr=json.loads(p2.read_text());u=un(rr);rrRef=ev(p2,'AUTH_RECOVERY_FRESH_NATIVE_READBACK','Explicit post-recovery current native proof supplied to root')
   rb.append({'evidence':rrRef,'status':u.get('status')if isinstance(u,dict)else None})
   if rr.get('isError')or(isinstance(u,dict)and(u.get('errors')or u.get('failures')or u.get('rollbackComplete')is False)):bad.append('Supplied freshreadback hasactual errors/failures')
  if not rb:bad.append('At least one actual post-recovery freshreadback required')
  if not a.auth_recovery_accepted:bad.append('Root explicit --auth-recovery-accepted not provided; no inference frommodelorfilename')
  if rec.get('status')=='NATIVE_RECOVERY_RECHECK_CLEAR_VISUAL_REMAINS_OPEN':
   expectedRefs=rec['combinedFreshEvidence'];supplied={sha(resolveArg(n))for n in a.auth_recovery_readback}
   if supplied!={z['sha256']for z in expectedRefs}:bad.append('Must supply allfour exactcombined freshnative proofs')
   if rec['actualImmediateTransactionResult']['sha256']!=sha(D/'access-auth-cleanform-v1-write-result.json')or rec.get('recoveryDocumentWrites')!=0:bad.append('Combinedfailurepin/read-onlyrecoverymismatch')
   c=rec['checks'];assert c['explicitCreated463Candidates57']['currentAbsent']==57 and c['explicitCreated463Candidates57']['residuals']==[]
   assert c['originalText146']['normalLookupExact']==142 and c['originalText146']['hiddenTraversalExact']==4 and c['originalText146']['actualFieldOrFontBindingDiffs']==0 and c['originalText146']['unreadableRemaining']==0
   assert c['presetOriginal27']['fullCanonicalRXHashesMatched']==27 and c['rowsOriginal9']['visibleChildrenOrderGeometryAndConstraintsMatched']==9 and c['componentCopyProperties11']['diffs']==0 and c['protectedAuthHooks2']['identityAndFullCanonicalRXHashesMatch']
   assert c['authVariables55']['currentMembershipIDsTypesScopesCollectionsHiddenMatched']and c['authVariables55']['noticeSavedNativePreWriteValueMatched']and c['authVariables55']['other54ExactBeforeAfterValueComparison']=='NOT_AVAILABLE_PREWRITE_RUNTIME_SNAPSHOT_NOT_SERIALIZED'and c['authVariables55']['noVariableRepairPerformed']
   for z in expectedRefs:
    assert sha(D/z['path'])==z['sha256'];rawName=z['path'].replace('.json','-raw.json')if 'READ04'not in z['path']else z['path'].replace('.json','-raw-result.json')
    pair(rawName,z['path'],'READ_ONLY_AUTH_CURRENT_RECOVERY_RECHECK')
   hidden=read('access-auth-cleanform-recovery-READ04-hidden-native-v1.json');assert len(hidden['rows'])==4 and all(r['current']is not None and r['listedInParent']and not r['diff']for r in hidden['rows'])and hidden['environmentTraversalFlagOnly']['restored']and hidden['environmentTraversalFlagOnly']['before']==hidden['environmentTraversalFlagOnly']['after']
  accepted=not bad;failedLedger['recovery']={'raw':ref,'reportedStatus':rec.get('status'),'readbacks':rb,'explicitRootAcceptanceFlag':bool(a.auth_recovery_accepted),'errorsBlockingRelease':bad,'scopedRecoveryAccepted':accepted,'businessSemanticsStillUNVERIFIED':True,'recheckMethod':'SEQUENTIAL_READ_ONLY_CURRENT_STATE_RECHECK','recoveryDocumentWrites':rec.get('recoveryDocumentWrites'),'originalImmediateRollbackCompleteRemainsFalse':True,'combinedChecks':rec.get('checks'),'limits':rec.get('limits')};failedLedger['gateReasons']=bad
 else:failedLedger['gateReasons']=['No actual successful recovery receipt and complete freshreadback accepted yet; prepared recovery tools/models cannot releaseP0']
 if accepted:failedLedger['status']='AUTH_CURRENT_NATIVE_RECHECK_CLEAR_VISUAL_BUSINESS_OPEN';failedLedger['currentAuth16Readiness']='CURRENT_NATIVE_RECHECK_CLEAR_VISUAL_OPEN'
 # Root current source files are copied to new names, preserving v2raw snapshots unchanged.
 def portable(v):
  if isinstance(v,dict):return{k:portable(x)for k,x in v.items()}
  if isinstance(v,list):return[portable(x)for x in v]
  if isinstance(v,str)and'/'not in v and(D/v).is_file()and Path(v).suffix in ['.json','.png','.jpg','.txt']:return ev(v,'CURRENT_ROOT_QA_REFERENCE','Current source QA reference; not automatic acceptance')['path']
  return v
 write('BROWSER-QA-CURRENT.json',portable(qa));write('WEB-ROOT-UI-MUTATIONS.json',portable(ui));write('failure-and-recovery.json',failedLedger)
 # Append only genuine writes to successful ledger. Failed cleanform and read-only verification remain separate.
 idx.pop('additionalSuccessfulReceiptsSincePrevious1016Publication',None);idx.pop('newBodyRoots',None);idx['historicalV2Snapshot']={'roots':1046,'successfulWriteIndex':116,'extraSuccessfulReceiptsBeyondBase97':19};idx['schemaVersion']='web-actual-receipt-addendum-v3';idx['generatedAt']=now;idx['previousPublicationRootCount']=1046;idx['newRootsSincePreviousPublication']=28;idx['additionalSuccessfulReceipts'].extend(additions);idx['additionalReceiptCount']=len(idx['additionalSuccessfulReceipts']);idx['additionalSuccessfulReceiptsSincePreviousPublication']=len(additions);idx['doNotReplaySuccessfulRawFiles']=[r['raw']for r in idx['additionalSuccessfulReceipts']];idx['indexCountIncludingBaselineAndScopedAddendum']=97+idx['additionalReceiptCount'];idx['actualRootIndex']=allRoots;idx['uniqueCreatedRootCount']=len(allRoots);idx['newBodyRootsFromOriginal1000']=len(allRoots)-1000;idx['failedMutationsExcludedFromSuccess']=[{'failure':fr,'status':fail['status'],'rollbackComplete':False,'countedInSuccessfulReceipts':False}];idx['auth16CurrentIntegrityGate']=failedLedger['status'];idx['successIndexNotCurrentAuthReadiness']=True
 assert len(allRoots)==a.expected_root_count and checkpoint['totalCreatedRootsFromBaseline']==len(allRoots),(len(allRoots),checkpoint['totalCreatedRootsFromBaseline'],'pass--expected-root-count/extend sourceafter newactual')
 assert len({r['raw']['sha256']for r in idx['additionalSuccessfulReceipts']})==len(idx['additionalSuccessfulReceipts'])
 nested=copy.deepcopy(oldReview['timing']['nestedScan']);nested['excludedNewRootCount']=len(allRoots)-1000;nested['excludedNew74RootIds']=[r['id']for r in allRoots[1000:]];nested.pop('excludedNew46RootIds',None);nested['doesNotCover1074Roots']=True;nested.pop('doesNotCover1046Roots',None)
 review={'schemaVersion':'web-learner-publication-review-v3','generatedAt':now,'status':'READY_SCOPED_RECOVERY_REVIEW_BUSINESS_OPEN'if accepted else'HOLD_WAIT_AUTH_RECOVERY','figma':oldReview['figma'],'denominator':oldReview['denominator'],'sourceIntegrity':'source-integrity.json','nativeRootSnapshot':{'originalBase':1000,'Auth':16,'Core':14,'Consent':16,'FirstDay':16,'GlobalScope':12,'uniqueCreatedRoots':len(allRoots),'previousPublicationRootCount':1046,'addedSincePreviousPublication':28,'notIndependentPageOrCompletionRate':True},'successfulWriteLedger':'actual-receipt-index.json','successfulReceiptCountWithOriginal97':idx['indexCountIncludingBaselineAndScopedAddendum'],'newActualWritesSinceV2':additions,'source19':{'actualSuccessfulBatchKeys':sourceDone,'actualWriteBatches':len(sourceDone),'requiredBatches':19,'remaining':remaining,'allNeedCurrentFlowSemanticQA':True},'core20CopyFreshVerification':reads[0],'readOnlyVerificationIndex':'native-read-verification.json','failureRecovery':'failure-and-recovery.json','authPublicationGate':failedLedger['status'],'authCreationAndCurrentIntegrityAreSeparate':True,'oldNestedScan':nested,'currentRootSnapshots':snapshots,'previousFixedBrowserSamples':oldReview['currentFixedBrowserSamples'],'fixedBrowserSamplesAreNotAuthRecoveryProof':True,'currentQA':'BROWSER-QA-CURRENT.json','currentDependentHashes':'dependency-hash-index.json','authDependentGuardChronology':'FirstDay/Global dependency receipt SHA remains valid provenance, but captured Auth hook/program hashes predate failed cleanform. Fresh exact Auth/Consent hooks must be re-read after accepted recovery before dependent source patches; no reuse of stale guards.','openItems':[('Authcurrentnative recheckclear by57/146/27RX9rows11props2hooks55metadata; visual remainsOPEN, oldmain permanentlyforbidden'if accepted else'P0Authcleanform partialrollback/sourceprogram+55variable+layoutrecovery untilactualcompletefreshproof accepted'),'FirstDay16 privateactor/task/notready binding andfullquery/restorecycleQA','GlobalScope12 defaultprivate/historyfalse; exactAuth/Consent/private/history/logout/switchsourcebridges stillOPEN','Source19 remaininggroups inexactorder; existingpatches needcurrentnativewholeflow+originalroundQA','Expressioncompleteentity/note/intent/source/return dirtypayload; otherChoicegroups andgeneralWriting','All484requirements/291semantic obligations, fullresponsive/theme/keyboard/SR/media/IAM/persistence'], 'execution':{'McpCalls':0,'browserCalls':0,'repoWrites':0,'DConcurrentRootFilesModified':False,'v2CandidateOverwritten':False},'worktreeReadOnlyBasis':{'repoRootLocalSupplementary':str(R),'originBasisReportedByParent':'58711c87','noFetchMergeRebaseOrCommitPerformed':True,'READMEWasReadOnlyReference':'Current worktree README already has corrected scoped timer/rough state; proposals only'},'wholeDesignAccepted':False}
 write('review-v3.json',review);write('actual-receipt-index.json',idx);write('native-read-verification.json',{'status':'SCOPED_READ_ONLY_NATIVE_PROOFS_NOT_BUSINESS_ACCEPTANCE','reads':reads,'fullActionsExported':False});write('dependency-hash-index.json',{'status':'PASS_CURRENT_EXACT_ADDED_DEPENDENCIES','items':deps,'allSourceSemanticStatus':'UNVERIFIED','preparedManifestNOTRUNIsHistoricalNotActualOverride':True});write('source-integrity.json',{'status':'PASS_ISOLATED_WORKTREE_16_SOURCE_SHA_UNCHANGED','generatedAt':now,'files':sourceRows,'requirements':484,'obligations':291,'allSemanticUNVERIFIED':True})
 # Worktree docs are read-only; retain existing righttimerstatus and replace only staleFigma paragraphs on eventualrootreview.
 gateText='当前Auth表单整理发生部分回滚，发布候选保持HOLD_WAIT_AUTH_RECOVERY；先完成原节点、完整程序、55变量与几何的精确恢复和fresh核验。'if not accepted else'原Auth整理失败rollbackComplete=false历史保留；0恢复写的4份连续fresh原生读验证当前指定范围无残差，仅解除P0复核门。其它54变量before值未持久化，不能称精确前后对比；visual与业务仍OPEN，旧main永久禁重放。'
 text('proposed-main-readme-update.md',f'''# 主README状态更新建议\n\n保留当前worktreeREADME已修正的计时范围与业务未签收说明。补充：累计1074个唯一顶层根=1000+Auth16+Core14+Consent16+FirstDay16+GlobalScope12，较v2增加28根，不是1074个独立页面。Source19当前{len(sourceDone)}/19仅有实际patch回执，其余与完整返流/语义仍待核。FirstDay和Global12仅原生目标/局部来源已建，默认权限不自动开放。\n\n{gateText}\n\n保留所有484/291UNVERIFIED及原1000子树扫描范围；该扫描不含新74根或旧source祖先，不外推1074。旧Speaking/Writing固定浏览器PASS不代表Auth恢复。\n''')
 text('proposed-status-update.md',f'''# STATUS中Figma Web小节的替换建议\n\n- 当前需求分母仍980来源分类、484Web需求、291独立义务，全部尚未语义签收。\n- 当前连接已恢复并完成校准，159指定顶层timer已原位修复、4GUI正确根保留；旧1000子树未发现嵌套timer，范围不含新增74根/旧source祖先。删除旧“额度耗尽、计时尚未校准”的当前时态，历史记录保留原文。\n- 累计1074顶层设计根；新增FirstDay16/GlobalScope12有实际成功回执。Source19当前{len(sourceDone)}/19实际patch；3大程序20条progress文案有native完整hash对照PASS，完整actions未导出，业务未验。\n- {gateText}\n- 完整业务、来源接线、草稿payload、响应式、键盘读屏与真实IAM/持久化仍OPEN；不升级既有源码LW/MB、R1历史或部署签收。\n''')
 write('proposed-checkpoint-addendum.json',{'status':'SUGGESTION_ONLY_NO_D_CURRENT_WRITES','sourceSnapshot':snapshots[srcNames[0]],'totalCreatedRoots':len(allRoots),'successfulReceipts':idx['indexCountIncludingBaselineAndScopedAddendum'],'source19Actual':len(sourceDone),'source19Remaining':remaining,'authRecoveryGate':failedLedger['status'],'failuresSeparate':'failure-and-recovery.json','resumeFirst':[('Authcurrentnative recovery recheckclear; nextpurecopy/layout/preset splitdrafts, oldmain permanentlyforbidden'if accepted else'Authcurrentpartialrollback exact diagnostic/recovery/freshproof; do notmainretry ordeleteoldI426children'),'Preserve all successful1074bodyroots/timers andsourcepatches; no replay','FirstDay/GlobalScope actual dependency/sourcebridges andremainingSource19freshgroups'],'all291SemanticUNVERIFIED':True,'old1000NestedScanNotNew74':True})
 write('proposed-coverage-boundary-patch.json',{'status':'MERGE_ADVICE_HELD_FOR_AUTH_RECOVERY'if not accepted else'MERGE_ADVICE_SCOPED_RECOVERY_ACCEPTED_BUSINESS_OPEN','preserve':{'requirements':484,'obligations':291,'designStatusCounts':{'UNVERIFIED':291}},'verificationBoundaryProposed':{'latestActualReview':'review-v3.json','currentUniqueCreatedRootCandidates':len(allRoots),'source19ActualPatchedBatches':len(sourceDone),'authCurrentIntegrityGate':failedLedger['status'],'nativeFullProgramCopyComparison':'Three exactCoreprograms20stringchangesmatchnativeexpectedhash; actionsnotexported/businessnotaccepted','nestedScanScope':nested,'currentSemanticComplete':False,'wholeBusinessAccepted':False},'failureMustNotEnterSuccessLedger':True})
 text('review-v3.md',f'''# Web学员端实际证据复核 v3\n\n**{'HOLD_WAIT_AUTH_RECOVERY：Auth整理发生部分回滚，尚未恢复核验。'if not accepted else'Auth当前原生状态经四次只读复核clear；原事务失败保留，visual与业务仍未签收。'}** 484条Web需求与291项义务全部保持UNVERIFIED。\n\n当前1074唯一顶层根=原1000+Auth16+Core14+Consent16+FirstDay16+GlobalScope12；较v2新增28。根包含状态/响应式/审阅，不是独立页面或完成率。FirstDay16和Global12有实际成功回执，Source19当前{len(sourceDone)}/19实际patch，余{len(remaining)}组仍待fresh来源与原轮次/返流。\n\n3个Core大程序的20条progress文案，经实际native完整canonical SHA/bytes对照匹配，旧literal0且trigger保留；完整actions未导出，不当远程完整程序或业务通过。\n\n## 失败与成功必须分开\n\nAuthcleanform-v1是PARTIAL_FAILURE_READ_BEFORE_RETRY、rollbackComplete=false、FINAL_GEOMETRY_BASE。Host拒删4个原有I426嵌套TEXT，且有source-shape恢复失败；不能把它计入成功或凭旧画板/模型/固定浏览器样例认定Auth当前恢复。[失败与恢复台账](failure-and-recovery.json)保留完整原件和诊断失败。\n\n原Auth16创建事实仍保留，当前恢复门状态为 {failedLedger['status']}。0恢复写的连续fresh复核若已接受：57候选无残差、142+4=146字段/字体/绑定、27RX/9行/11props/2hook及55变量metadata+notice匹配；其余54变量before值未持久化，不能宣称精确前后值比较。visual仍OPEN，旧main永久禁重放。恢复工具准备或READ01失败都不能解除HOLD。只有给参数化脚本实际恢复回执、完整fresh读并由root显式接受，才可生成“指定恢复已验、业务仍OPEN”版本。\n\n## 保持精确范围\n\n159指定顶层timer修复与4GUI正确根保持，不重放。旧1000子树扫描57611后代/8856有反应后代/nested0仅在该旧范围；不含新增74根或旧source祖先，不能外推1074。旧Speaking C与Writing19词v5仅固定样例PASS，不证明当前Auth恢复或全量业务。\n\n主README、STATUS、checkpoint、coverage建议分别在proposed-*。新worktree仅只读，16源SHA未变化；旧v2和D并发根文件未改。发布前先解Auth恢复门并由root核当前远端/并发状态。复制计划见evidence-copy-plan.json；原始/parsed证据与依赖SHA随包。0MCP、0browser、0repo写。\n''')
 text('REBUILD.md',f'''# v3重建方式\n\n默认生成HOLD快照（不调用Figma/浏览器、不写repo/D根文件）：\n\n`python3 {Path(__file__).name} --output-dir {D}/publication-candidate-v3`\n\n实际恢复与完整fresh读回齐全并由root逐项审查接受后，建议另建目录保留HOLD原件：\n\n`python3 {Path(__file__).name} --output-dir {D}/publication-candidate-v3-recovered --auth-recovery-receipt <D内实际恢复结果.json> --auth-recovery-readback <D内实际fresh读回.json> --auth-recovery-accepted`\n\n可重复传--auth-recovery-readback。未给齐、任何actualerrors/partialrollback，或没有root明确accepted参数，均保留HOLD。该参数不是按模型/文件名自动验收，也不升级291语义状态。\n\n只吸收Source19正式plan中有匹配实际成功回执/依赖的批，不能吸收READY。若后续另增主体，用新候选脚本明确加actualreceipt后调整--expected-root-count，不能仅改数字。--repo-root默认当前隔离worktree，源16SHA漂移即停止。\n''')
 # Freeze current copiedfile SHA and dependency pins, without mutatingD sources.
 for n,h in sourcePins.items():assert sha(D/n)==h,('ConcurrentDsourcechanged;rerun',n)
 assert all(sha(BASE/n)==h for n,h in frozenV2.items()),'v2freezechanged'
 for f in files.values():assert sha(O/f['destination'])==f['sha256']
 write('evidence-index.json',{'schemaVersion':'web-publication-evidence-index-v3','generatedAt':now,'files':list(files.values()),'rawNormalizedPairs':pairs,'allShaVerified':True,'sourceSnapshotPins':sourcePins,'sourceFiles16Unchanged':True,'failureEvidenceNotSuccessful':True,'wholeBusinessAccepted':False})
 for staged in (O/'evidence').iterdir():
  rel=str(staged.relative_to(O))
  if staged.is_file()and rel not in files and '-source-v3-'in staged.name:staged.unlink()
 outputFiles=[p for p in O.rglob('*')if p.is_file()and p.name not in ['evidence-copy-plan.json','validation.json']];copyPlan={'status':'HOLD_WAIT_AUTH_RECOVERY'if not accepted else'ROOT_REVIEW_SCOPED_RECOVERY_ACCEPTED_BUSINESS_OPEN','targetDirectory':'docs/06-design/v2-980plus/redesign/figma-web-learner/','add':[],'alreadyPresentSameSha':[],'reviewReplace':[],'selfFilesToCopyAfterFreeze':['evidence-copy-plan.json','validation.json'],'noAutomaticCommit':True}
 for p in outputFiles:
  rel=str(p.relative_to(O));dest=T/rel;z={'source':rel,'destination':rel,'sha256':sha(p),'bytes':p.stat().st_size}
  if not dest.exists():copyPlan['add'].append(z)
  elif sha(dest)==z['sha256']:copyPlan['alreadyPresentSameSha'].append(z)
  else:z['existingSha256']=sha(dest);copyPlan['reviewReplace'].append(z)
 write('evidence-copy-plan.json',copyPlan)
 validation={'status':'PASS_REFERENCE_INTEGRITY_PACKAGE_HOLD_WAIT_AUTH_RECOVERY'if not accepted else'PASS_REFERENCE_INTEGRITY_SCOPED_RECOVERY_ACCEPTED_BUSINESS_OPEN','generatedAt':now,'authRecoveryGate':failedLedger['status'],'roots':len(allRoots),'v2RootSnapshot':1046,'newSinceV2':28,'source19ActualBatches':len(sourceDone),'source19Total':19,'source19Remaining':len(remaining),'nativeSuccessfulWriteReceiptsIndexed':idx['indexCountIncludingBaselineAndScopedAddendum'],'failedCleanformInSuccessfulReceipts':False,'fullActionsExportedForCore20':False,'source16ShaUnchanged':True,'all291UNVERIFIED':True,'rawParsedChecks':len(pairs),'allRawParsedEqual':True,'evidenceFiles':len(files),'evidenceBytes':sum(f['bytes']for f in files.values()),'v2AndConcurrentRootFilesUnchanged':True,'repoWrites':0,'McpCalls':0,'browserCalls':0,'artifacts':{n:{'sha256':sha(O/n),'bytes':(O/n).stat().st_size}for n in ['review-v3.md','review-v3.json','actual-receipt-index.json','failure-and-recovery.json','native-read-verification.json','dependency-hash-index.json','evidence-index.json','source-integrity.json','evidence-copy-plan.json','REBUILD.md',Path(__file__).name]}}
 write('validation.json',validation);print(json.dumps({k:v for k,v in validation.items()if k!='artifacts'},ensure_ascii=False));print(json.dumps(validation['artifacts'],ensure_ascii=False,indent=2))
if __name__=='__main__':main()
