import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = '/Users/Admin/.codex/worktrees/mobile-ci-current-20261108b/cloudstudy';
const outDir = '/tmp/grok-mobile-resume-ci-current-463';
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function walkConsts(value, location, found) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkConsts(item, `${location}[${index}]`, found));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const next = `${location}.${key}`;
    if (key === 'const') found.push({ location: next, value: child });
    walkConsts(child, next, found);
  }
}

function forbiddenOf(branch) {
  const constraint = branch.not;
  if (!constraint) return [];
  if (Array.isArray(constraint.required)) return constraint.required.slice();
  if (Array.isArray(constraint.anyOf)) {
    return constraint.anyOf.map((item) => (item.required || []).join('+'));
  }
  return [`unparsed:${Object.keys(constraint).join(',')}`];
}

const lifecycleModule = await import(pathToFileURL(path.join(root, 'scripts/audit/p1r-content-lifecycle-check.mjs')).href);
const lifecycle = lifecycleModule.validateContentLifecycle({ root });
fs.writeFileSync(path.join(outDir, 'rc-c-lifecycle.json'), JSON.stringify({
  result: lifecycle.result,
  summary: lifecycle.summary,
  errorCount: lifecycle.errors.length,
  errors: lifecycle.errors,
}, null, 2));

const b9 = readJson('packages/contracts/fragments/b9/b9-content.openapi.json');
const b10 = readJson('packages/contracts/fragments/b10/b10-learning-assessment-content.openapi.json');
const b9Consts = [];
const b10Consts = [];
walkConsts(b9, '$', b9Consts);
walkConsts(b10, '$', b10Consts);
const request = b9.components.schemas.B9ContentCommandRequest;
const frozenProperties = ['command', 'contentCode', 'expectedStateVersion', 'targetVersionNumber', 'reasonCode', 'content', 'reviewDecision', 'reviewNote', 'schedule', 'scheduledPublishTaskId'];
const actualProperties = Object.keys(request.properties);
const oneOf = (request.oneOf || []).map((branch, index) => ({
  index,
  commands: branch.properties?.command?.enum || [],
  required: branch.required || [],
  forbidden: forbiddenOf(branch),
  keys: Object.keys(branch),
}));
const policy = readJson('config/p1r-content-lifecycle.v1.json');
fs.writeFileSync(path.join(outDir, 'rc-c-shape.json'), JSON.stringify({
  b9ConstCount: b9Consts.length,
  b10ConstCount: b10Consts.length,
  b9Consts,
  b10Consts,
  commandEnum: request.properties.command.enum,
  policyCommandNames: (policy.commands || []).map((command) => command.name),
  policyActorClasses: policy.actorClasses,
  actualProperties,
  propertyDelta: {
    added: actualProperties.filter((name) => !frozenProperties.includes(name)),
    removed: frozenProperties.filter((name) => !actualProperties.includes(name)),
  },
  fieldPolicy: request['x-command-field-policy'],
  oneOfCount: oneOf.length,
  oneOf,
}, null, 2));

function withheldRules() {
  const contract = readJson('packages/contracts/fragments/p1r-gateway-boundary.openapi.json');
  const boundary = contract['x-p1r-gateway-boundary'];
  const rules = new Map(boundary.routeRules.map((rule) => [rule.ruleId, rule]));
  return {
    boundary,
    rules,
    withheld: boundary.routeExecutions
      .filter((entry) => entry.projections.length === 0)
      .map((entry) => ({
        ruleId: entry.ruleId,
        priority: rules.get(entry.ruleId)?.priority,
        matchType: rules.get(entry.ruleId)?.match?.type,
        methods: rules.get(entry.ruleId)?.match?.methods ?? [],
        path: rules.get(entry.ruleId)?.match?.path,
        owner: rules.get(entry.ruleId)?.upstreamOwner,
        reason: entry.defaultReason,
        security: rules.get(entry.ruleId)?.security || rules.get(entry.ruleId)?.auth || null,
        ruleKeys: Object.keys(rules.get(entry.ruleId) || {}),
      }))
      .filter((entry) => typeof entry.path === 'string'),
  };
}

function availableExactOverrides(boundary, rules, withheldRule) {
  return boundary.routeExecutions.flatMap((execution) => {
    const rule = rules.get(execution.ruleId);
    const overlaps = withheldRule.matchType === 'PREFIX'
      ? rule?.match?.path?.startsWith(`${withheldRule.path}/`)
      : rule?.match?.path === withheldRule.path;
    const hasHigherPriority = Number.isInteger(rule?.priority) && rule.priority > withheldRule.priority;
    const sharesMethod = rule?.match?.methods?.some((method) => withheldRule.methods.includes(method));
    if (rule?.match?.type !== 'EXACT' || !overlaps || !hasHigherPriority || !sharesMethod) return [];
    return execution.projections
      .filter((projection) => projection.status === 'AVAILABLE'
        && projection.publicPathTemplate === rule.match.path
        && projection.methods.every((method) => rule.match.methods.includes(method)))
      .map((projection) => ({
        path: projection.publicPathTemplate,
        methods: projection.methods,
        projectionId: projection.projectionId,
        owner: projection.upstreamOwner,
        targetPathTemplate: projection.targetPathTemplate,
        controller: projection.controllerEvidence || null,
        operationId: projection.operationId || null,
      }));
  });
}

function collectFiles() {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.nuxt', '.output', 'dist', 'generated'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(ts|vue|js|mjs)$/u.test(entry.name)) files.push(absolute);
    }
  };
  for (const app of fs.readdirSync(path.join(root, 'apps'))) {
    const directory = path.join(root, 'apps', app);
    if (fs.statSync(directory).isDirectory()) visit(directory);
  }
  for (const shared of ['api-client', 'contracts']) {
    const directory = path.join(root, 'packages', shared, 'src');
    if (fs.existsSync(directory)) visit(directory);
  }
  return files;
}

function scriptBodies(file, text) {
  if (!file.endsWith('.vue')) return [text];
  return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu)].map((match) => match[1]);
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function enclosingName(sourceFile, node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) {
      return current.name?.text || '(anonymous function)';
    }
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    if (ts.isPropertyAssignment(current) && current.name) return current.name.getText(sourceFile);
    current = current.parent;
  }
  return null;
}

function transportMethod(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isCallExpression(parent)) continue;
    const name = ts.isPropertyAccessExpression(parent.expression) ? parent.expression.name.text
      : ts.isIdentifier(parent.expression) ? parent.expression.text : '';
    if (['get', 'post', 'put', 'patch', 'delete'].includes(name)) return name.toUpperCase();
    if (name === 'request') {
      const options = parent.arguments[1];
      const method = options && ts.isObjectLiteralExpression(options) ? options.properties.find((property) =>
        ts.isPropertyAssignment(property) && property.name.getText() === 'method') : undefined;
      return method && ts.isStringLiteralLike(method.initializer) ? method.initializer.text : 'GET';
    }
  }
  return null;
}

const { boundary, rules, withheld } = withheldRules();
const sources = collectFiles().map((file) => {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const text = fs.readFileSync(file, 'utf8');
  return { file: relative, text };
});

function isExactOverrideCall(file, literal, method, exactOverrides) {
  return exactOverrides.some((entry) => {
    if (method && !entry.methods.includes(method)) return false;
    const variants = [entry.path];
    if (file.includes('/src/api/') && entry.path.startsWith('/api/v1/')) variants.push(entry.path.slice('/api/v1'.length));
    return variants.some((route) => {
      const routeSegments = route.split('/');
      const literalSegments = literal.split('?')[0].split('/');
      return routeSegments.length === literalSegments.length && routeSegments.every((segment, index) =>
        /^\{[^}]+\}$/.test(segment) ? literalSegments[index].length > 0 : segment === literalSegments[index]);
    });
  });
}

const matches = [];
for (const entry of withheld) {
  const exactOverrides = availableExactOverrides(boundary, rules, entry);
  const paths = [entry.path];
  for (const source of sources) {
    const relativeOk = source.file.includes('/src/api/') && entry.path.startsWith('/api/v1/');
    const candidatePaths = relativeOk ? [...paths, entry.path.slice('/api/v1'.length)] : paths;
    for (const script of scriptBodies(source.file, source.text)) {
      const syntax = ts.createSourceFile(source.file, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const visit = (node) => {
        let literal = null;
        if (ts.isStringLiteralLike(node)) literal = node.text;
        else if (ts.isTemplateExpression(node)) literal = node.head.text + node.templateSpans.map((span) => `{dynamic}${span.literal.text}`).join('');
        if (literal) {
          const method = transportMethod(node);
          const hit = candidatePaths.some((prefix) => literal === prefix || literal.startsWith(`${prefix}/`) || literal.startsWith(`${prefix}?`));
          if (hit && !isExactOverrideCall(source.file, literal, method, exactOverrides)) {
            matches.push({
              withheldPath: entry.path,
              ruleId: entry.ruleId,
              owner: entry.owner,
              reason: entry.reason,
              matchType: entry.matchType,
              methods: entry.methods,
              file: source.file,
              line: lineOf(script, node.getStart(syntax)),
              literal,
              transportMethod: method,
              enclosing: enclosingName(syntax, node),
            });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(syntax);
    }
  }
  entry.exactOverrideCount = exactOverrides.length;
  entry.exactOverrides = exactOverrides;
}

const productTexts = sources.map((source) => source);
function references(name, definitionFile) {
  if (!name || name.startsWith('(')) return [];
  const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'u');
  return productTexts
    .filter((source) => source.file !== definitionFile && pattern.test(source.text))
    .map((source) => source.file);
}

const grouped = [];
const seen = new Set();
for (const match of matches) {
  const key = `${match.file}|${match.line}|${match.literal}|${match.withheldPath}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const refs = references(match.enclosing, match.file);
  grouped.push({
    ...match,
    productReferences: refs,
    vueReferences: refs.filter((file) => file.endsWith('.vue')),
    routerReferences: refs.filter((file) => file.includes('router') || file.includes('routes')),
    classification: refs.length === 0 ? 'dead-export-or-local-only' : (refs.some((file) => file.endsWith('.vue') || file.includes('router')) ? 'reachable-ui' : 'referenced-non-ui'),
  });
}

fs.writeFileSync(path.join(outDir, 'rc-h.json'), JSON.stringify({
  withheldCount: withheld.length,
  withheld: withheld.map((entry) => ({
    ruleId: entry.ruleId,
    path: entry.path,
    matchType: entry.matchType,
    methods: entry.methods,
    priority: entry.priority,
    owner: entry.owner,
    reason: entry.reason,
    exactOverrideCount: entry.exactOverrideCount,
    exactOverrides: entry.exactOverrides,
  })),
  matchCount: grouped.length,
  matches: grouped,
}, null, 2));

console.log(JSON.stringify({
  lifecycle: lifecycle.result,
  lifecycleErrors: lifecycle.errors.length,
  b9Consts: b9Consts.length,
  b10Consts: b10Consts.length,
  commands: request.properties.command.enum.length,
  oneOf: oneOf.length,
  withheld: withheld.length,
  matches: grouped.length,
}, null, 2));
