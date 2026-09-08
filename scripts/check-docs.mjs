// Typejoy docs consistency check.
// Run: npm run docs
//
// Verifies:
//   1. Every handoff doc file exists at its expected path.
//   2. Every method / symbol documented under each class heading in
//      API_REFERENCE.md actually appears in that class's source file.
//
// This catches the #1 docs failure mode: the docs drifting from the code.
// If a documented method isn't found in source, either the docs are stale
// (update API_REFERENCE.md) or the API changed (update the docs).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const DOCS = [
  'README.md',
  join('docs', 'PLUGIN_GUIDE.md'),
  'API_REFERENCE.md',
  'CONTRIBUTING.md',
  join('docs', 'EXAMPLE_PLUGIN.md'),
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};

console.log('Docs consistency check');
console.log('-----------------------');

// ── 1. Every doc file exists ────────────────────────────────────────────
console.log('\n[1] Handoff files present');
for (const doc of DOCS) {
  const p = join(root, doc);
  if (existsSync(p)) console.log(`  ✓ ${doc}`);
  else fail(`${doc} is missing`);
}

// ── 2. API_REFERENCE.md methods exist in source ─────────────────────────
console.log('\n[2] API_REFERENCE.md symbols exist in src/');

const apiRefPath = join(root, 'API_REFERENCE.md');
if (existsSync(apiRefPath)) {
  const apiRef = readFileSync(apiRefPath, 'utf8');

  // Each class gets a heading like "## `RawBus` — raw key capture".
  // The class name is the first backticked token in the heading.
  const headings = [...apiRef.matchAll(/^## `([^`]+)`/gm)].map((m) => m[1]);

  const srcDir = join(root, 'src');
  const srcFiles = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));

  for (const cls of headings) {
    // Find the source file for this class. Filenames may be kebab-cased
    // (FeedbackLayer → feedback-layer.ts) and one class lives in a file
    // with a different name (PluginRegistry → PluginHooks.ts), so compare
    // a normalized (alphanumeric-only, lowercased) form.
    const ALIASES = {
      PluginRegistry: 'PluginHooks.ts',
      StaticBeatMap: 'BeatMap.ts',
      SVGKeyboardRenderer: 'svg-keyboard.ts',
    };
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const file =
      (ALIASES[cls] && srcFiles.find((f) => f === ALIASES[cls])) ??
      srcFiles.find((f) => norm(f).startsWith(norm(cls))) ??
      srcFiles.find((f) => norm(f) === norm(cls));

    if (!file) {
      fail(`no source file found for class "${cls}"`);
      continue;
    }
    const source = readFileSync(join(srcDir, file), 'utf8');

    // Collect documented method calls from the section under this heading:
    // lines of the form "methodName(args): type" (documented signatures).
    const section = apiRef.split(new RegExp(`## \`${cls}\``))[1] ?? '';
    const sectionText = section.split(/^## /m)[0];

    const methods = [
      ...sectionText.matchAll(/^([a-zA-Z_$][\w$]*)\s*\(/gm),
    ].map((m) => m[1]);

    const unique = [...new Set(methods)];
    for (const method of unique) {
      // Interface methods may be declared `foo(...)` or optional `foo?(...)`;
      // accessors appear as `get foo(): type`.
      const declared =
        source.includes(`${method}(`) ||
        source.includes(`${method}?(`) ||
        source.includes(`get ${method}():`);
      if (declared) console.log(`  ✓ ${cls}.${method}()  (${file})`);
      else fail(`${cls}.${method}() documented but not found in ${file}`);
    }
  }
} else {
  fail('API_REFERENCE.md missing — cannot check symbols');
}

console.log('\n-----------------------');
if (failures > 0) {
  console.error(`Docs check FAILED: ${failures} problem(s). Fix the docs or the code, then re-run.`);
  process.exit(1);
}
console.log('Docs check passed — API reference matches source.');
