// Concatenate this library before one domain's construction script. No module imports.
// Root is the sole Figma writer. All IDs below originate from inspected existing assets.
async function createWebBuilders(config) {
  const cfg={theme:'Light',...config};
  if(!cfg.prefix||typeof cfg.prefix!=='string')throw Error('A unique domain prefix is required');
  if(cfg.expectedScreenCount>16&&!cfg.allowLargeBatch)throw Error('PREWRITE_SPLIT_EXPECTED_BATCH_TO_12_16_RICH_SCREENS');
  const F=cfg.foundations;
  if(!F?.components?.info||!F.components.choiceVariants||!F.styles?.body||!F.variables?.radiusButton)throw Error('Use actual shared-foundations receipt, never guessed component IDs');
  const page=await figma.getNodeByIdAsync('0:1');if(page?.type!=='PAGE')throw Error('PAGE_0_1_MISSING');
  await figma.setCurrentPageAsync(page);
  const roots=[],screens=[],createdCollections=[],createdVariables=[],mutatedSources=[],varCache=new Map(),nodeCache=new Map(),adaptedTimeouts=new Map(),authoredPrograms=new Map();
  const timerCalibration=cfg.timeoutCalibration||(typeof TIMEOUT_CALIBRATION!=='undefined'?TIMEOUT_CALIBRATION:null);
  function requireTimerCalibration(){
    const c=timerCalibration;
    if(!c||c.status!=='VERIFIED_GUI_AND_NATIVE_READBACK'||c.fileKey!=='cbUQgN4Kdd3GrYeDVfF7sk'||c.pageId!=='0:1'||c.browserConfirmed!==true||!c.nativeEvidence?.path||!('pointer'in c.nativeEvidence)||!c.browserEvidence?.path||!('pointer'in c.browserEvidence)||!Number.isFinite(c.guiMilliseconds)||c.guiMilliseconds<=0||!Number.isFinite(c.nativeTimeout)||c.nativeTimeout<=0)throw Error('TIMEOUT_CALIBRATION_REQUIRED_NO_NATIVE_WRITE');
    if(c.connectorUnit!=='seconds'||c.logicalMillisecondsPerConnectorUnit!==1000)throw Error('VERIFIED_CONNECTOR_SECONDS_CONTRACT_REQUIRED');
    const expected=c.guiMilliseconds/c.logicalMillisecondsPerConnectorUnit;if(Math.abs(c.nativeTimeout-expected)>Math.max(1e-7,Math.abs(expected)*1e-6))throw Error('CALIBRATION_PAIR_NOT_SECONDS');
    return c;
  }
  function timeoutToNative(milliseconds){const c=requireTimerCalibration();if(!Number.isFinite(milliseconds)||milliseconds<800)throw Error('DOMAIN_TIMEOUT_MIN_800_MILLISECONDS');return milliseconds/c.logicalMillisecondsPerConnectorUnit;}
  function timeoutToMilliseconds(nativeValue){const c=requireTimerCalibration();if(!Number.isFinite(nativeValue)||nativeValue<=0)throw Error('INVALID_NATIVE_TIMEOUT');return nativeValue*c.logicalMillisecondsPerConnectorUnit;}
  // Candidate stays fail-closed until the root installs an actual calibrated pair.
  requireTimerCalibration();

  const V={},C={},styles={},initialRoots=new Set(page.children.map(n=>n.id));
  const definitions=F.variables;
  for(const [key,id]of Object.entries(definitions)){V[key]=await figma.variables.getVariableByIdAsync(id);if(!V[key])throw Error('MISSING_FOUNDATION_VARIABLE '+key+' '+id);varCache.set(id,V[key]);}
  for(const [key,id]of Object.entries(F.styles)){styles[key]=await figma.getStyleByIdAsync(id);if(styles[key]?.type!=='TEXT')throw Error('MISSING_FOUNDATION_TEXT_STYLE '+key);}
  C.info=await figma.getNodeByIdAsync(F.components.info);C.primary=await figma.getNodeByIdAsync(F.components.primary);C.input=await figma.getNodeByIdAsync(F.components.input);C.choices={};
  for(const [state,id]of Object.entries(F.components.choiceVariants))C.choices[state]=await figma.getNodeByIdAsync(id);
  for(const n of [C.info,C.primary,C.input,...Object.values(C.choices)])if(n?.type!=='COMPONENT')throw Error('FOUNDATION_COMPONENT_MISSING');
  C.choiceSet=await figma.getNodeByIdAsync(F.components.choiceSet);
  if(C.info.name!==F.prefix+'InformationRow'||C.choiceSet?.type!=='COMPONENT_SET'||C.choiceSet.name!==F.prefix+'Choice'||C.primary.name!=='Web / 主按钮'||!C.primary.componentPropertyDefinitions[F.properties.primary]||!C.input.componentPropertyDefinitions[F.properties.input])throw Error('FOUNDATION_EXACT_NAME_OR_PROPERTY_DRIFT');
  for(const [state,n]of Object.entries(C.choices))if(n.parent?.id!==C.choiceSet.id||n.name!=='State='+state)throw Error('CHOICE_VARIANT_DRIFT '+state);
  const fonts=new Map();for(const n of [C.info,C.primary,C.input,...Object.values(C.choices)])for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName']))fonts.set(JSON.stringify(seg.fontName),seg.fontName);
  fonts.set('productRegular',{family:'Noto Sans SC',style:'Regular'});fonts.set('productBold',{family:'Noto Sans SC',style:'Bold'});
  for(const font of fonts.values())await figma.loadFontAsync(font);
  let anchorX=Math.max(0,...page.children.map(n=>n.x+n.width))+160;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const canonical=rxs=>rxs.map(rx=>({trigger:clone(rx.trigger),actions:clone(rx.actions||(rx.action?[rx.action]:[]))}));
  const utf8=x=>{let bytes=0;for(const ch of JSON.stringify(x)){const cp=ch.codePointAt(0);bytes+=cp<128?1:cp<2048?2:cp<65536?3:4;}return bytes;};
  function rootOf(n){let p=n;while(p?.parent&&p.parent.id!==page.id)p=p.parent;return p;}
  function screenOf(n){const root=rootOf(n);return screens.find(s=>s.root.id===root?.id);}
  function actualWidth(n){return Math.max(80,n.width-(n.paddingLeft||0)-(n.paddingRight||0));}
  function resolvedRGB(variable,consumer){const c=variable.resolveForConsumer(consumer).value;if(typeof c!=='object'||!('r'in c))throw Error('COLOR_EXPECTED '+variable.id);return {r:c.r,g:c.g,b:c.b};}
  function paint(key,n){const v=typeof key==='string'?V[key]:key;if(!v)throw Error('UNKNOWN_PAINT_TOKEN '+key);return figma.variables.setBoundVariableForPaint({type:'SOLID',color:resolvedRGB(v,n)},'color',v);}
  function spacing(n,key='space16',gap='space12'){const pad=V[key];if(!pad)throw Error('UNKNOWN_SPACING '+key);for(const f of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])n.setBoundVariable(f,pad);if(gap)n.setBoundVariable('itemSpacing',V[gap]);}
  function frame(parent,name,opts={}){
    const n=figma.createAutoLayout(opts.direction||'VERTICAL');parent.appendChild(n);n.name=name;n.fills=[];
    n.resize(opts.width||actualWidth(parent),opts.height||1);
    if((opts.direction||'VERTICAL')==='HORIZONTAL'){n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode=opts.fixedHeight?'FIXED':'AUTO';}
    else{n.primaryAxisSizingMode=opts.fixedHeight?'FIXED':'AUTO';n.counterAxisSizingMode='FIXED';}
    if(opts.fill!==false)n.layoutSizingHorizontal='FILL';if(opts.gap!==false)n.setBoundVariable('itemSpacing',V[opts.gap||'space16']);
    if(opts.padding)spacing(n,opts.padding,opts.gap||'space16');if(opts.surface)n.fills=[paint(opts.surface,n)];return n;
  }
  function text(parent,value,opts={}){
    const role=opts.role||'body',style=styles[role];if(!style)throw Error('UNKNOWN_TEXT_ROLE '+role);
    const t=figma.createText();parent.appendChild(t);t.name=opts.name||'正文 / '+String(value).slice(0,28);t.fontName=style.fontName;t.textStyleId=style.id;t.characters=String(value);t.textAutoResize='HEIGHT';
    t.resize(opts.width||actualWidth(parent),style.lineHeight.unit==='PIXELS'?style.lineHeight.value:24);t.layoutSizingHorizontal=opts.fill===false?'FIXED':'FILL';t.layoutSizingVertical='HUG';t.fills=[paint(opts.tone||'ink',t)];
    if(t.width<=0)throw Error('TEXT_WIDTH_ZERO '+t.id);return t;
  }
  function card(parent,opts={}){const n=frame(parent,opts.name||'业务卡片 / '+(opts.title||'内容'),{padding:'space24',gap:'space12',surface:'card',width:opts.width,fill:opts.fill});n.setBoundVariable('cornerRadius',V.radiusCard);n.strokes=[paint('border',n)];n.strokeWeight=1;if(opts.title)text(n,opts.title,{role:'heading'});if(opts.description)text(n,opts.description,{tone:'muted'});return n;}
  function resizeInstanceText(instance,width,padding=32){
    const texts=instance.findAllWithCriteria({types:['TEXT']});
    for(const t of texts){t.textAutoResize='HEIGHT';t.resize(Math.max(24,width-padding),Math.max(17,t.height));t.layoutSizingHorizontal='FILL';t.layoutSizingVertical='HUG';if(t.width<=0)throw Error('INSTANCE_TEXT_WIDTH_ZERO '+t.id);}
    return texts;
  }
  function info(parent,opts={}){const n=C.info.createInstance();parent.appendChild(n);n.name=opts.name||'信息 / '+(opts.title||'状态');n.resize(opts.width||actualWidth(parent),n.height);n.layoutSizingHorizontal=opts.fill===false?'FIXED':'FILL';n.layoutSizingVertical='HUG';n.setProperties({[F.properties.info.title]:opts.title||'状态说明',[F.properties.info.description]:opts.description||'',[F.properties.info.status]:opts.status||'状态：已确认'});resizeInstanceText(n,n.width);n.fills=[paint('card',n)];return n;}
  function choice(parent,opts={}){
    const state=opts.state||'Default',master=C.choices[state];if(!master)throw Error('CHOICE_STATE '+state);if(state==='Disabled'&&!opts.description)throw Error('DISABLED_CHOICE_REQUIRES_REASON');
    const n=master.createInstance();parent.appendChild(n);n.name=opts.name||'选择项 / '+opts.label;n.resize(opts.width||actualWidth(parent),n.height);n.layoutSizingHorizontal=opts.fill===false?'FIXED':'FILL';n.layoutSizingVertical='HUG';n.setProperties({[F.properties.choice.label]:opts.label||'选项',[F.properties.choice.description]:opts.description||''});resizeInstanceText(n,n.width);n.fills=[paint('card',n)];
    if(state==='Disabled'&&n.reactions.length)throw Error('DISABLED_MASTER_MUST_HAVE_NO_REACTIONS');return n;
  }
  function button(parent,opts={}){
    const kind=opts.kind||'secondary',s=screenOf(parent);if(kind==='primary'&&s&&s.primaryCount>=1)throw Error('ONLY_ONE_PRIMARY_ACTION_PER_SCREEN '+s.root.name);
    const n=C.primary.createInstance();parent.appendChild(n);n.name=opts.name||'操作 / '+(opts.label||'继续');n.resize(opts.width||248,48);n.layoutSizingHorizontal=opts.fill?'FILL':'FIXED';n.layoutSizingVertical='FIXED';n.setProperties({[F.properties.primary]:opts.label||'继续'});for(const t of resizeInstanceText(n,n.width,32)){t.textStyleId=styles.body.id;t.fills=[paint(kind==='primary'?'onAction':'action',t)];}
    n.fills=[paint(kind==='primary'?'solidAction':'card',n)];n.setBoundVariable('cornerRadius',V.radiusButton);n.strokes=kind==='primary'?[]:[paint('focus',n)];n.strokeWeight=1;
    const height=Math.max(48,...n.findAllWithCriteria({types:['TEXT']}).map(t=>t.height+24));n.resize(n.width,height);if(kind==='primary'&&s)s.primaryCount++;return n;
  }
  function input(parent,opts={}){
    const wrapper=frame(parent,opts.name||'示例输入 / '+(opts.label||'内容'),{gap:'space8'});if(opts.label)text(wrapper,opts.label,{role:'small'});
    const field=C.input.createInstance();wrapper.appendChild(field);field.name='示例输入框 / 不接收自由键入';field.resize(actualWidth(wrapper),48);field.layoutSizingHorizontal='FILL';field.setProperties({[F.properties.input]:opts.value??''});field.fills=[paint('card',field)];field.strokes=[paint('focus',field)];field.setBoundVariable('cornerRadius',V.radiusButton);
    const children=resizeInstanceText(field,field.width,36);if(children.length!==1)throw Error('EXPECTED_ONE_INPUT_TEXT');const valueText=children[0];valueText.textStyleId=styles.body.id;valueText.fills=[paint('ink',valueText)];field.resize(field.width,Math.max(48,valueText.height+24));
    const hint=text(wrapper,opts.hint||'示例输入；请用下方预设体验，不支持任意键入。',{role:'small',tone:'muted'});return {root:wrapper,field,text:valueText,hint};
  }
  // Figma objects are strict proxies: optional chaining does not protect a property
  // unsupported by the node's type. Test property presence before reading wrappers.
  function nodeId(value){if(typeof value==='string')return value;if(value&&typeof value==='object'){if('id'in value)return value.id;if('root'in value&&value.root&&typeof value.root==='object'&&'id'in value.root)return value.root.id;}throw Error('NODE_ID_REQUIRED');}
  async function getNode(value){const id=nodeId(value);if(!nodeCache.has(id))nodeCache.set(id,await figma.getNodeByIdAsync(id));return nodeCache.get(id);}
  async function getVariable(value){if(value&&typeof value==='object'&&'id'in value&&'resolvedType'in value)return value;const id=typeof value==='string'?value:value&&typeof value==='object'&&'id'in value?value.id:null;if(!id)throw Error('VARIABLE_ID_REQUIRED');if(!varCache.has(id))varCache.set(id,await figma.variables.getVariableByIdAsync(id));const v=varCache.get(id);if(!v)throw Error('VARIABLE_MISSING '+id);return v;}
  function literal(value){if(value&&typeof value==='object'&&'type'in value&&'resolvedType'in value)return clone(value);const type=typeof value==='boolean'?'BOOLEAN':typeof value==='number'?'FLOAT':typeof value==='string'?'STRING':null;if(!type)throw Error('UNSUPPORTED_LITERAL_USE_REF_FOR_VARIABLE');return {type,resolvedType:type,value};}
  function ref(variable,type){const id=typeof variable==='string'?variable:variable&&typeof variable==='object'&&'id'in variable?variable.id:null,resolvedType=type||(variable&&typeof variable==='object'&&'resolvedType'in variable?variable.resolvedType:null);if(!id||!resolvedType)throw Error('REF_REQUIRES_VARIABLE_AND_TYPE');return {type:'VARIABLE_ALIAS',resolvedType,value:{type:'VARIABLE_ALIAS',id}};}
  function expr(fn,args){return {type:'EXPRESSION',resolvedType:'BOOLEAN',value:{expressionFunction:fn,expressionArguments:args.map(literal)}};}
  function fold(fn,args){if(!args.length)return literal(fn==='AND');return args.map(literal).reduce((a,b)=>expr(fn,[a,b]));}
  function go(target){const id=nodeId(target);return {type:'NODE',destinationId:id,navigation:'NAVIGATE',transition:null,resetVideoPosition:false,resetScrollPosition:true};}
  function set(variable,value){const id=typeof variable==='string'?variable:variable&&typeof variable==='object'&&'id'in variable?variable.id:null;if(!id)throw Error('SET_REQUIRES_VARIABLE');return {type:'SET_VARIABLE',variableId:id,variableValue:literal(value)};}
  function iff(condition,yes,no=[]){if(literal(condition).resolvedType!=='BOOLEAN')throw Error('IF_REQUIRES_BOOLEAN');if([...yes,...no].some(a=>a.type==='CONDITIONAL'))throw Error('NESTED_CONDITIONAL_NOT_ALLOWED');return {type:'CONDITIONAL',conditionalBlocks:[{condition:literal(condition),actions:yes},{actions:no}]};}
  async function validateActions(control,list,depth=0){
    const source=rootOf(control);
    for(const a of list){
      if(a.type==='NODE'){const target=await getNode(a.destinationId);if(a.navigation!=='NAVIGATE'||target?.type!=='FRAME'||target.parent?.id!==page.id||!target.visible||target.id===source?.id)throw Error('INVALID_OR_SELF_NAV '+control.id+' '+a.destinationId);}
      else if(a.type==='SET_VARIABLE'){const v=await getVariable(a.variableId);if(v.resolvedType!==a.variableValue.resolvedType)throw Error('SET_VARIABLE_TYPE '+v.id);if(cfg.mutableVariableIds&&!cfg.mutableVariableIds.includes(v.id)&&!createdVariables.some(x=>x.id===v.id))throw Error('FOREIGN_VARIABLE_WRITE '+v.id);}
      else if(a.type==='CONDITIONAL'){if(depth||a.conditionalBlocks?.length!==2||!a.conditionalBlocks[0].condition)throw Error('CONDITIONAL_SHAPE');checkExpression(a.conditionalBlocks[0].condition);for(const b of a.conditionalBlocks)await validateActions(control,b.actions||[],depth+1);}
      else if(a.type==='URL')throw Error('Use same-page native links; external URL requires explicit domain-specific guard');
      else throw Error('UNSUPPORTED_ACTION '+a.type);
    }
  }
  function checkExpression(e){if(e.type!=='EXPRESSION')return;if(['AND','OR'].includes(e.value.expressionFunction)&&e.value.expressionArguments.length!==2)throw Error('LOGICAL_EXPRESSION_MUST_BE_BINARY');for(const a of e.value.expressionArguments)checkExpression(a);}
  function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
  function exactProgram(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function nearNative(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-6);}
  function programMatches(actual,expected){if(actual.length!==expected.length)return false;const normalized=clone(actual);for(let i=0;i<expected.length;i++){if(expected[i].trigger?.type==='AFTER_TIMEOUT'){if(normalized[i].trigger?.type!=='AFTER_TIMEOUT'||!nearNative(normalized[i].trigger.timeout,expected[i].trigger.timeout))return false;normalized[i].trigger.timeout=expected[i].trigger.timeout;}}return exactProgram(normalized,expected);}
  function recordProgram(node,reactions,kind){const expected=clone(reactions),timers=[];for(const[index,rx]of expected.entries())if(rx.trigger?.type==='AFTER_TIMEOUT')timers.push({reactionIndex:index,nativeTimeout:rx.trigger.timeout,milliseconds:timeoutToMilliseconds(rx.trigger.timeout)});authoredPrograms.set(node.id,{node,expected,kind});if(timers.length)adaptedTimeouts.set(node.id,{kind,timers});else adaptedTimeouts.delete(node.id);}
  async function auditAuthoredPrograms(){for(const[id,p]of authoredPrograms){if(p.node.removed)throw Error('AUTHORED_CONTROL_REMOVED '+id);if(!programMatches(canonical(p.node.reactions),p.expected))throw Error('AUTHORED_REACTION_PROGRAM_DRIFT '+id);}for(const root of roots)for(const n of[root,...root.findAll(()=>true)])if('reactions'in n&&n.reactions.some(r=>r.trigger?.type==='AFTER_TIMEOUT')&&!authoredPrograms.has(n.id))throw Error('UNADAPTED_RAW_TIMEOUT_WRITE_USE_W_AFTER_TIMEOUT '+n.id);}
  async function setReaction(control,list,trigger){if(!roots.some(r=>r.id===rootOf(control)?.id))throw Error('SOURCE_MUTATION_REQUIRES_PATCH_EXACT');await validateActions(control,list);const next=[{trigger:clone(trigger),actions:clone(list)}];await control.setReactionsAsync(next);recordProgram(control,next,'NEW_HELPER_REACTION');return control;}
  async function actions(control,list){return setReaction(control,list,{type:'ON_CLICK'});}
  // Figma Trigger.timeout is milliseconds, per official Trigger documentation.
  // Public API remains milliseconds. Only the verified GUI/native pair defines proxy units.
  async function afterTimeout(control,list,ms=800){const nativeValue=timeoutToNative(ms);await setReaction(control,list,{type:'AFTER_TIMEOUT',timeout:nativeValue});return control;}
  async function nav(control,target){return actions(control,[go(target)]);}
  async function vars(name,definitions){
    const exactName=cfg.prefix+'State / '+name,collections=await figma.variables.getLocalVariableCollectionsAsync();if(collections.some(c=>c.name===exactName))throw Error('STATE_COLLECTION_EXISTS_READ_BEFORE_RETRY '+exactName);
    const collection=figma.variables.createVariableCollection(exactName);createdCollections.push(collection);collection.renameMode(collection.defaultModeId,'Prototype fixture');const values={};
    for(const [key,spec0]of Object.entries(definitions)){const spec=spec0&&typeof spec0==='object'&&'type'in spec0?spec0:{type:typeof spec0==='boolean'?'BOOLEAN':typeof spec0==='number'?'FLOAT':'STRING',value:spec0};const v=figma.variables.createVariable(name+'/'+key,collection,spec.type);createdVariables.push(v);v.hiddenFromPublishing=true;v.scopes=spec.type==='STRING'?['TEXT_CONTENT']:spec.type==='BOOLEAN'?['ALL_SCOPES']:[];v.setValueForMode(collection.defaultModeId,spec.value);values[key]=v;varCache.set(v.id,v);}
    return {collection,vars:values,...values};
  }
  function bindText(t,variable){if(t?.type!=='TEXT'||!variable||typeof variable!=='object'||!('resolvedType'in variable)||variable.resolvedType!=='STRING')throw Error('STRING_TEXT_BIND_REQUIRED');t.resize(Math.max(24,t.width),Math.max(17,t.height));t.textAutoResize='HEIGHT';t.setBoundVariable('characters',variable);return t;}
  function bindVisible(n,variable){if(!variable||typeof variable!=='object'||!('resolvedType'in variable)||variable.resolvedType!=='BOOLEAN')throw Error('BOOLEAN_VISIBILITY_BIND_REQUIRED');n.setBoundVariable('visible',variable);return n;}
  const defaultNav={学习工作台:'2:2',今日学习:'67:239',课程中心:'2:68',词汇与复习:'2:132',专项练习:'64:1526',错题与报告:'192:1282',成长空间:'194:4170',账户设置:'12:745'};
  function normalNavStyle(n){n.strokes=[];n.fills=[];for(const t of n.findAllWithCriteria({types:['TEXT']}))t.fills=[paint('muted',t)];return n;}
  async function screen(opts){
    const name=cfg.prefix+opts.key;if(page.children.some(n=>n.name===name))throw Error('SCREEN_EXISTS_READ_BEFORE_RETRY '+name);
    const width=opts.width||1440,height=opts.height||900;if(![1440,1024,768].includes(width)&&!opts.allowCustomWidth)throw Error('Use native1440/1024/768 layouts');
    const sideWidth=width>=1440?228:width>=1024?192:160;
    const root=figma.createAutoLayout('HORIZONTAL');roots.push(root);page.appendChild(root);root.name=name;root.resize(width,height);root.primaryAxisSizingMode='FIXED';root.counterAxisSizingMode='FIXED';root.clipsContent=true;root.fills=[paint('page',root)];root.x=anchorX;root.y=0;anchorX+=width+160;
    const mode=F.themeModes[opts.theme||cfg.theme];if(!mode)throw Error('UNKNOWN_THEME');root.setExplicitVariableModeForCollection(F.themeCollectionId,mode);
    const sidebar=frame(root,'导航 / 侧栏',{width:sideWidth,fill:false,padding:'space16',gap:'space8',surface:'card',fixedHeight:true,height});sidebar.layoutSizingVertical='FILL';
    const main=frame(root,'Web 主工作区',{width:width-sideWidth,fixedHeight:true,height,gap:false});main.layoutSizingVertical='FILL';
    const s={root,sidebar,main,primaryCount:0,navButtons:{},width,height};screens.push(s);
    text(sidebar,'语学星',{role:'heading',tone:'action'});text(sidebar,'PhraseStar',{role:'small',tone:'muted'});
    const navList=frame(sidebar,opts.restricted?'导航 / 账户与帮助安全出口':'导航 / 业务入口',{gap:'space8'}),targets={...defaultNav,...cfg.navTargets,...opts.navTargets};
    if(opts.restricted){
      text(navList,'学习入口暂不可用',{role:'small',tone:'muted'});
      const exits=opts.safeExits||cfg.safeExits||[{label:'账户设置',target:'12:745'}];
      for(const exit of exits){if(!/^(账户|隐私|帮助|客服|支持|返回登录|退出)/.test(exit.label))throw Error('RESTRICTED_SAFE_EXIT_LABEL '+exit.label);const b=normalNavStyle(button(navList,{label:exit.label,kind:'secondary',width:sideWidth-32}));b.layoutSizingHorizontal='FILL';s.navButtons[exit.label]=b;await nav(b,exit.target);}
    }
    const renderedNavLabels=Object.keys(defaultNav).filter(label=>label!=='成长空间'||cfg.showConditionalNavigation===true||opts.nav==='成长空间');
    for(const label of opts.restricted?[]:renderedNavLabels){
      if(label===opts.nav){const selected=frame(navList,'当前导航 / '+label,{padding:'space12',gap:false});selected.strokes=[paint('focus',selected)];selected.strokeWeight=2;selected.setBoundVariable('cornerRadius',V.radiusButton);text(selected,'✓ '+label,{role:'body',tone:'action'});}
      else if(opts.lockedNavigation){text(navList,label,{role:'small',tone:'muted'});}
      else{const b=normalNavStyle(button(navList,{label,kind:'secondary',width:sideWidth-32}));b.layoutSizingHorizontal='FILL';s.navButtons[label]=b;await nav(b,targets[label]);}
    }
    text(sidebar,opts.restricted?'仅保留账户、隐私与支持出口。':opts.lockedNavigation?'先查询当前请求，或稍后处理后再离开。':'Phase 1 · 成人学习',{role:'small',tone:'muted'});
    const header=frame(main,'页头 / 面包屑与标题',{padding:'space24',gap:'space8',surface:'card'});
    text(header,opts.breadcrumb||(opts.restricted?'账户与帮助':'学习工作区 / '+(opts.nav||'当前页面')),{role:'small',tone:'muted'});
    text(header,opts.title,{role:'title'});if(opts.subtitle)text(header,opts.subtitle,{tone:'muted'});
    const scrollport=frame(main,'正文滚动视口',{fixedHeight:true,height:height-260,gap:false});scrollport.layoutSizingVertical='FILL';scrollport.clipsContent=true;scrollport.overflowDirection='VERTICAL';
    const body=frame(scrollport,'业务正文 / 原生可编辑',{padding:'space24',gap:'space16'});
    const footerWrap=frame(main,'固定底部 / 操作与状态',{padding:'space16',gap:'space8',surface:'card'});footerWrap.strokes=[paint('border',footerWrap)];footerWrap.strokeWeight=1;
    const footer=frame(footerWrap,'固定操作栏',{direction:width<=768?'VERTICAL':'HORIZONTAL',gap:'space16'});footer.primaryAxisSizingMode=width<=768?'AUTO':'FIXED';footer.counterAxisSizingMode=width<=768?'FIXED':'AUTO';footer.layoutSizingHorizontal='FILL';
    const footerNote=text(footerWrap,opts.footerNote||'交互原型 · 页面中的操作与结果为设计示例',{role:'small',tone:'muted'});
    Object.assign(s,{header,scrollport,body,footerWrap,footer,footerNote});return s;
  }
  async function safehome(opts={}){const s=await screen({key:opts.key||'safe-home',title:opts.title||'已保留当前操作',subtitle:opts.subtitle||'处理原请求后再继续，避免重复提交。',breadcrumb:opts.breadcrumb,nav:opts.nav||'学习工作台',width:opts.width||1440,theme:opts.theme,restricted:opts.restricted,safeExits:opts.safeExits,lockedNavigation:true});info(s.body,{title:opts.operationTitle||'当前操作',description:opts.description||'保留操作身份、当前进度与选择；稍后回访时继续查询原请求。',status:opts.status||'状态：结果待确认'});return s;}
  async function patchExact(spec){
    const n=await getNode(spec.id);if(!n||n.name!==spec.name||n.parent?.id!==spec.parentId||!Array.isArray(spec.expectedReactions))throw Error('SOURCE_PATCH_EXACT_GUARD '+spec.id);
    const old=canonical(n.reactions);if(!exactProgram(old,spec.expectedReactions))throw Error('SOURCE_REACTION_DRIFT '+n.id);
    let index=spec.reactionIndex;if(index===undefined){if(old.length>1)throw Error('AMBIGUOUS_SOURCE_TRIGGERS_REACTION_INDEX_REQUIRED');index=0;}
    if(!Number.isInteger(index)||index<0||(old.length?index>=old.length:index!==0))throw Error('SOURCE_REACTION_INDEX_OUT_OF_RANGE');
    const prior=old[index]||null;let trigger;
    if(spec.timeoutMs!==undefined){if(spec.trigger&&spec.trigger.type!=='AFTER_TIMEOUT')throw Error('TIMEOUT_MS_REQUIRES_TIMEOUT_TRIGGER');trigger={...(prior?.trigger?.type==='AFTER_TIMEOUT'?clone(prior.trigger):{}),type:'AFTER_TIMEOUT',timeout:timeoutToNative(spec.timeoutMs)};}
    else if(spec.trigger){trigger=clone(spec.trigger);if(trigger.type==='AFTER_TIMEOUT'&&(!prior||!exactProgram(trigger,prior.trigger)))throw Error('RAW_SOURCE_TIMEOUT_CHANGE_USE_TIMEOUT_MS');}
    else if(prior?.trigger)trigger=clone(prior.trigger);
    else trigger={type:'ON_CLICK'};
    if(!trigger||typeof trigger.type!=='string')throw Error('SOURCE_TRIGGER_REQUIRED');
    if(prior?.trigger?.type!==undefined&&prior.trigger.type!==trigger.type&&spec.allowTriggerTypeChange!==true)throw Error('SOURCE_TRIGGER_TYPE_CHANGE_REQUIRES_EXPLICIT_ACK');
    if(trigger.type==='AFTER_TIMEOUT')timeoutToMilliseconds(trigger.timeout);
    if(spec.preserveActions===true&&spec.actions!==undefined)throw Error('PRESERVE_ACTIONS_AND_REPLACEMENT_ARE_EXCLUSIVE');
    if(spec.preserveActions===true&&!prior)throw Error('PRESERVE_ACTIONS_REQUIRES_EXISTING_REACTION');
    const inputActions=spec.preserveActions===true?prior.actions:spec.actions;if(!Array.isArray(inputActions))throw Error('COMPLETE_ACTION_ARRAY_REQUIRED');
    const list=clone(inputActions);
    await validateActions(n,list);
    const next=clone(old);next[index]={trigger,actions:list};mutatedSources.push({node:n,old});await n.setReactionsAsync(next);recordProgram(n,next,spec.timeoutMs!==undefined?'PATCH_CALIBRATED_TIMEOUT':'PATCH_PRESERVED_TRIGGER');return n;
  }
  function registerRoot(n){if(n?.type!=='FRAME'||n.parent?.id!==page.id||!n.name.startsWith(cfg.prefix)||initialRoots.has(n.id))throw Error('REGISTER_NEW_ROOT_GUARD');if(!roots.some(r=>r.id===n.id))roots.push(n);return n;}
  async function finish(extra={}){
    await auditAuthoredPrograms();
    const errors=[];for(const s of screens){for(const n of s.footer.children){if(s.width<=768)n.layoutSizingHorizontal='FILL';}if(s.scrollport.height<160)errors.push({kind:'SCROLLPORT_TOO_SHORT',id:s.root.id,height:s.scrollport.height});}
    const all=roots.flatMap(r=>[r,...r.findAll(()=>true)]),ids=[...new Set(all.map(n=>n.id))],types={},imageFilledNodes=[],fontFamilies=new Set();let controls=0;
    function visible(n){for(let p=n;p&&p.type!=='PAGE';p=p.parent)if('visible'in p&&!p.visible)return false;return true;}
    function horizontalScroll(n){for(let p=n.parent;p&&p.type!=='PAGE';p=p.parent)if('overflowDirection'in p&&['HORIZONTAL','BOTH'].includes(p.overflowDirection))return true;return false;}
    for(const n of all){types[n.type]=(types[n.type]||0)+1;if('fills'in n&&Array.isArray(n.fills)&&n.fills.some(f=>f.type==='IMAGE'))imageFilledNodes.push({id:n.id,name:n.name,type:n.type,width:n.width,height:n.height});if(n.type==='TEXT'){for(const seg of n.getStyledTextSegments(['fontName']))fontFamilies.add(seg.fontName.family);if(n.width<=0)errors.push({kind:'ZERO_TEXT_WIDTH',id:n.id});}
      if(visible(n)&&!horizontalScroll(n)){const b=n.absoluteBoundingBox,r=rootOf(n),rb=r?.absoluteBoundingBox,pb=n.parent?.type!=='PAGE'?n.parent?.absoluteBoundingBox:null;if(b&&rb&&(b.x<rb.x-1||b.x+b.width>rb.x+rb.width+1))errors.push({kind:'ROOT_HORIZONTAL_OVERFLOW',id:n.id,root:r.id});if(n.type==='TEXT'&&b&&pb&&(b.x<pb.x-1||b.x+b.width>pb.x+pb.width+1))errors.push({kind:'TEXT_PARENT_HORIZONTAL_OVERFLOW',id:n.id,parent:n.parent.id});}
      if('reactions'in n&&n.reactions.length){controls++;for(const rx of canonical(n.reactions)){if(rx.trigger?.type==='AFTER_TIMEOUT'){if(!authoredPrograms.has(n.id))throw Error('UNADAPTED_RAW_TIMEOUT_WRITE_USE_W_AFTER_TIMEOUT '+n.id);else{const ms=timeoutToMilliseconds(rx.trigger.timeout);if(ms<800-0.001)errors.push({kind:'TIMEOUT_UNDER_800_DOMAIN_MS',id:n.id,domainMilliseconds:ms,nativeTimeout:rx.trigger.timeout});}}await validateActions(n,rx.actions);}}}
    for(const s of screens){const rb=s.root.absoluteBoundingBox,fb=s.footerWrap.absoluteBoundingBox,pb=s.scrollport.absoluteBoundingBox;for(const n of [s.sidebar,s.main,s.footerWrap,s.scrollport]){const b=n.absoluteBoundingBox;if(!b||b.x<rb.x-1||b.y<rb.y-1||b.x+b.width>rb.x+rb.width+1||b.y+b.height>rb.y+rb.height+1)errors.push({kind:'SHELL_BOUNDS',id:n.id,root:s.root.id});}if(!s.scrollport.clipsContent||s.scrollport.overflowDirection!=='VERTICAL'||pb.y+pb.height>fb.y+1)errors.push({kind:'SCROLLPORT_FOOTER_BOUNDARY',id:s.scrollport.id});for(const n of s.footer.children){const b=n.absoluteBoundingBox;if(b&&(b.x<fb.x-1||b.x+b.width>fb.x+fb.width+1))errors.push({kind:'FOOTER_CONTROL_OVERFLOW',id:n.id,root:s.root.id});}}
    if(imageFilledNodes.length)errors.push({kind:'UNEXPECTED_IMAGE_FILLED_NODES'});if([...fontFamilies].some(f=>f!=='Noto Sans SC'))errors.push({kind:'WRONG_PRODUCT_FONT',families:[...fontFamilies]});
    const result={...extra,status:errors.length?'CREATED_NATIVE_STRUCTURE_ISSUES':'CREATED_NATIVE_WEB_DOMAIN_NEEDS_VISUAL_AND_BROWSER_QA',prefix:cfg.prefix,createdNodeIdsCsv:ids.join(','),createdNodeIdCount:ids.length,mutatedNodeIds:[...new Set(mutatedSources.map(x=>x.node.id))],createdVariableIds:createdVariables.map(v=>v.id),createdVariableCollectionIds:createdCollections.map(c=>c.id),roots:roots.map(r=>({id:r.id,name:r.name,width:r.width,height:r.height})),screens:screens.map(s=>({id:s.root.id,key:s.root.name.slice(cfg.prefix.length),width:s.width,height:s.height,bodyHeight:s.body.height,viewportHeight:s.scrollport.height,fixedFooterHeight:s.footerWrap.height,primaryCount:s.primaryCount})),types,imageFilledNodes,fontFamilies:[...fontFamilies],controls,errors,timingCalibrationStatus:timerCalibration?.status||'MISSING_TIMER_WRITES_BLOCKED',timerConnectorUnit:timerCalibration?.connectorUnit,logicalMillisecondsPerConnectorUnit:timerCalibration?.logicalMillisecondsPerConnectorUnit,adaptedTimeouts:[...adaptedTimeouts].map(([id,value])=>({id,...value})),limits:['Editable Figma prototype, not real IAM/service persistence or policy approval.','Native example fields do not accept arbitrary keyboard input.','Widths reflow independently; real CSS zoom, keyboard, screen-reader and device acceptance remain separate.']};
    const bytes=utf8(result);if(bytes>=40000)throw Error('OUTPUT_BUDGET_'+bytes+'_SPLIT_BATCH_BEFORE_WRITE');result.outputUtf8BytesBeforeSizeField=bytes;return result;
  }
  async function rollback(error){
    const restoreErrors=[],warnings=[],remainingNodes=[],remainingVariables=[],remainingCollections=[],sourceVerification=[],nodeIds=new Set(),sourceOriginals=new Map();
    const rootTargets=roots.map(node=>({id:node.id,node})),variableTargets=createdVariables.map(node=>({id:node.id})),collectionTargets=createdCollections.map(node=>({id:node.id}));
    const sourceTargets=mutatedSources.map(entry=>({id:entry.node.id,old:clone(entry.old)}));
    const failure=(phase,id,e)=>restoreErrors.push({phase,id,error:String(e)});
    for(const entry of sourceTargets)if(!sourceOriginals.has(entry.id))sourceOriginals.set(entry.id,entry.old);
    for(const target of rootTargets){nodeIds.add(target.id);try{if(!target.node.removed)for(const n of target.node.findAll(()=>true))nodeIds.add(n.id);}catch(e){failure('collect-created-node-ids',target.id,e);}}
    for(const entry of [...sourceTargets].reverse())if(!nodeIds.has(entry.id))try{const live=await figma.getNodeByIdAsync(entry.id);if(!live)throw Error('SOURCE_MISSING_DURING_RESTORE');await live.setReactionsAsync(clone(entry.old));}catch(e){failure('restore-source-program',entry.id,e);}
    // Verify external source programs before deleting dependencies they may still reference.
    for(const[id,original]of sourceOriginals)if(!nodeIds.has(id))try{const live=await figma.getNodeByIdAsync(id);if(!live)throw Error('SOURCE_MISSING_AFTER_RESTORE');const matches=exactProgram(canonical(live.reactions),original);sourceVerification.push({id,completeProgramRestored:matches});if(!matches)failure('verify-source-program',id,'COMPLETE_SOURCE_PROGRAM_MISMATCH');}catch(e){failure('verify-source-program',id,e);}
    const cleanupDeferredBecauseSourceRestoreUnverified=restoreErrors.some(e=>e.phase==='restore-source-program'||e.phase==='verify-source-program');
    if(!cleanupDeferredBecauseSourceRestoreUnverified){
      for(const target of [...rootTargets].reverse())try{const live=await figma.getNodeByIdAsync(target.id);if(live)await live.remove();}catch(e){failure('remove-created-root',target.id,e);}
      // Local enumeration is authoritative for current membership: by-ID lookups may expose stale proxy wrappers.
      try{const current=new Map((await figma.variables.getLocalVariablesAsync()).map(v=>[v.id,v]));for(const target of [...variableTargets].reverse())try{const live=current.get(target.id);if(live)await live.remove();}catch(e){failure('remove-created-variable',target.id,e);}}catch(e){failure('enumerate-created-variables-before-remove','variables',e);}
      try{const current=new Map((await figma.variables.getLocalVariableCollectionsAsync()).map(c=>[c.id,c]));for(const target of [...collectionTargets].reverse())try{const live=current.get(target.id);if(live)await live.remove();}catch(e){failure('remove-created-collection',target.id,e);}}catch(e){failure('enumerate-created-collections-before-remove','collections',e);}
    }
    // Fresh APIs bypass helper caches. Read failures are unverified, never absence.
    for(const id of nodeIds)try{const live=await figma.getNodeByIdAsync(id);if(live)remainingNodes.push({id,type:live.type,name:live.name});}catch(e){failure('verify-created-node-absence',id,e);}
    let variableEnumerationVerified=false,collectionEnumerationVerified=false;
    try{const owned=new Set(variableTargets.map(x=>x.id));for(const v of await figma.variables.getLocalVariablesAsync())if(owned.has(v.id))remainingVariables.push({id:v.id,name:v.name});variableEnumerationVerified=true;}catch(e){failure('verify-variable-enumeration','variables',e);}
    try{const owned=new Set(collectionTargets.map(x=>x.id));for(const c of await figma.variables.getLocalVariableCollectionsAsync())if(owned.has(c.id))remainingCollections.push({id:c.id,name:c.name});collectionEnumerationVerified=true;}catch(e){failure('verify-collection-enumeration','collections',e);}
    if(variableTargets.length||collectionTargets.length)warnings.push({kind:'BY_ID_PROXY_WRAPPER_NOT_ABSENCE_EVIDENCE',message:'Current local enumeration determines variable/collection membership; a stale by-ID wrapper alone is not a residual.'});
    const complete=!restoreErrors.length&&!remainingNodes.length&&!remainingVariables.length&&!remainingCollections.length&&variableEnumerationVerified&&collectionEnumerationVerified;
    return {status:complete?'ROLLED_BACK_READ_BEFORE_RETRY':'PARTIAL_FAILURE_READ_BEFORE_RETRY',error:String(error),rollbackComplete:complete,cleanupDeferredBecauseSourceRestoreUnverified,createdNodeIdsCsv:[...nodeIds].join(','),createdNodeIdCount:nodeIds.size,mutatedNodeIds:[...sourceOriginals.keys()],createdVariableIds:variableTargets.map(x=>x.id),createdVariableCollectionIds:collectionTargets.map(x=>x.id),restoreErrors,warnings,verification:{status:complete?'FRESH_API_CONFIRMED_COMPLETE':'FRESH_API_INCOMPLETE_OR_RESIDUAL',nodeEvidence:'getNodeByIdAsync',variableEvidence:'getLocalVariablesAsync owned-ID filter',collectionEvidence:'getLocalVariableCollectionsAsync owned-ID filter',checkedNodeCount:nodeIds.size,checkedVariableCount:variableTargets.length,checkedCollectionCount:collectionTargets.length,variableEnumerationVerified,collectionEnumerationVerified,remainingNodes,remainingVariables,remainingCollections,sourceVerification}};
  }
  return {page,config:cfg,foundations:F,V,C,styles,roots,screens,paint,spacing,frame,text,card,info,choice,button,input,screen,safehome,vars,bindText,bindVisible,getNode,getVariable,literal,ref,eq:(a,b)=>expr('EQUALS',[a,b]),ne:(a,b)=>expr('NOT_EQUAL',[a,b]),and:(...args)=>fold('AND',args),or:(...args)=>fold('OR',args),if:iff,set,go,actions,nav,afterTimeout,patchExact,registerRoot,finish,rollback,utf8};
}
