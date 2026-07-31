import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve } from 'node:path';
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

if (errors.length > 0) {
  console.error(`Code-Audit fehlgeschlagen (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Code-Audit erfolgreich: ${sourceFiles.length} TS/TSX-Dateien geprueft.`);
}
