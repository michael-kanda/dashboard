import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const workspace = process.cwd();
const sourceRoot = resolve(workspace, 'src');
const sourceFiles = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) await walk(filePath);
    else if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.d.ts')) {
      sourceFiles.push(normalize(filePath));
    }
  }
}

await walk(sourceRoot);

const errors = [];
const contents = new Map();
for (const file of sourceFiles) contents.set(file, await readFile(file, 'utf8'));

const ddlPattern = /\b(?:ALTER\s+TABLE|CREATE\s+(?:TABLE|INDEX)|DROP\s+TABLE)\b/i;
for (const [file, content] of contents) {
  if (ddlPattern.test(content)) {
    errors.push(`Runtime-DDL: ${relative(workspace, file)}`);
  }
}

const toPosix = (file) => relative(workspace, file).split(sep).join('/');

// Dateigroesse: Neue Dateien duerfen hoechstens MAX_LINES Zeilen haben. Bestehende
// grosse Dateien stehen mit ihrer aktuellen Zeilenzahl in der Baseline und duerfen
// nicht weiter wachsen. Wer eine davon verkleinert, senkt hier den Wert mit.
const MAX_LINES = 600;
const lineBaseline = new Map([
  ['src/components/PromptTrackingCard.tsx', 1550],
  ['src/app/admin/edit/[id]/EditUserForm.tsx', 1210],
  ['src/lib/ai-traffic-extended-v2.ts', 1160],
  ['src/components/LocalSeoMapWidget.tsx', 852],
  ['src/app/api/ai/chat/route.ts', 840],
  ['src/lib/google/gsc.ts', 831],
  ['src/lib/google-data-loader.ts', 828],
  ['src/components/IndexingStatusWidget.tsx', 798],
  ['src/lib/google/ads.ts', 705],
  ['src/lib/google/ga4.ts', 682],
  ['src/components/AiTrafficDetailCardV2.tsx', 674],
  ['src/app/api/ai/analyze/route.ts', 644],
  ['src/components/charts/LandingPageChart.tsx', 611],
  ['src/components/GoogleAdsWidget.tsx', 602],
]);
const shrunk = [];

function countLines(content) {
  if (content.length === 0) return 0;
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

for (const [file, content] of contents) {
  const path = toPosix(file);
  const lines = countLines(content);
  const limit = lineBaseline.get(path) ?? MAX_LINES;
  if (lines > limit) {
    errors.push(
      lineBaseline.has(path)
        ? `Dateigroesse: ${path} hat ${lines} Zeilen, Baseline ist ${limit}`
        : `Dateigroesse: ${path} hat ${lines} Zeilen, erlaubt sind ${MAX_LINES}`
    );
  } else if (lineBaseline.has(path) && lines < limit) {
    shrunk.push(`${path}: ${limit} -> ${lines}`);
  }
}

// Authentifizierung: Die Middleware laesst /api ungeprueft durch. Jede Route muss
// deshalb selbst eine Session, eine Rollenpruefung oder ein Cron-Secret pruefen.
const publicRoutes = new Set([
  'src/app/api/auth/[...nextauth]/route.ts',
]);
const authPattern = /\bauth\(\)|\bgetServerSession\(|\brequireContentStudioProject\(|\bCRON_SECRET\b/;

for (const [file, content] of contents) {
  const path = toPosix(file);
  if (!path.startsWith('src/app/api/') || !path.endsWith('/route.ts')) continue;
  if (publicRoutes.has(path) || authPattern.test(content)) continue;
  errors.push(`Route ohne erkannte Auth-Pruefung: ${path}`);
}

const fileSet = new Set(sourceFiles);
const incoming = new Map(sourceFiles.map((file) => [file, 0]));

function resolveImport(sourceFile, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(sourceFile, '..', specifier);
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    const normalized = normalize(candidate);
    if (fileSet.has(normalized)) return normalized;
  }
  return null;
}

for (const [file, content] of contents) {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    let specifier = null;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifier = node.moduleSpecifier.text;
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifier = node.arguments[0].text;
    }

    if (specifier) {
      const target = resolveImport(file, specifier);
      if (target) incoming.set(target, (incoming.get(target) ?? 0) + 1);

      if (
        file.includes(`${join('src', 'lib')}${process.platform === 'win32' ? '\\' : '/'}`) &&
        specifier.startsWith('@/components/')
      ) {
        errors.push(`Server/UI-Kopplung: ${relative(workspace, file)} -> ${specifier}`);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);
}

const frameworkEntry = /\/(?:page|layout|route|loading|error|global-error|not-found|template|default|middleware|instrumentation|instrumentation-client)\.(?:ts|tsx)$/;
for (const [file, count] of incoming) {
  if (count > 0 || frameworkEntry.test(file) || file.endsWith(`${join('preview', 'page 2.tsx')}`)) continue;
  errors.push(`Ohne Importreferenz: ${relative(workspace, file)}`);
}

const hashes = new Map();
for (const [file, content] of contents) {
  const hash = createHash('sha256').update(content).digest('hex');
  const matches = hashes.get(hash) ?? [];
  matches.push(file);
  hashes.set(hash, matches);
}
for (const matches of hashes.values()) {
  if (matches.length > 1) {
    errors.push(`Exaktes Duplikat: ${matches.map((file) => relative(workspace, file)).join(', ')}`);
  }
}

if (shrunk.length > 0) {
  console.log('Kleiner als Baseline, bitte Wert in lineBaseline senken:');
  shrunk.forEach((entry) => console.log(`- ${entry}`));
}

if (errors.length > 0) {
  console.error(`Code-Audit fehlgeschlagen (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Code-Audit erfolgreich: ${sourceFiles.length} TS/TSX-Dateien geprueft.`);
}
