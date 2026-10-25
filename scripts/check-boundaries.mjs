import ts from 'typescript';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
const files = [];
function walk(dir) { for (const entry of readdirSync(dir, { withFileTypes: true })) { const p = resolve(dir, entry.name); if (entry.isDirectory()) walk(p); else if (/\.tsx?$/.test(p)) files.push(p); } }
walk('src');
const graph = new Map();
for (const file of files) {
 const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
 const edges = [];
 for (const statement of source.statements) {
  if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
  const spec = statement.moduleSpecifier;
  if (!spec || !ts.isStringLiteral(spec)) continue;
  const name = spec.text;
  const layer = relative(resolve('src'), file).split(/[\\/]/)[0];
  if (name.startsWith('.')) {
   const base = resolve(dirname(file), name);
   const target = [base, base + '.ts', base + '.tsx', resolve(base, 'index.ts')].find(p => existsSync(p) && files.includes(p));
   if (!target) continue;
   const targetLayer = relative(resolve('src'), target).split(/[\\/]/)[0];
   if ((layer === 'domain' && targetLayer !== 'domain') || (layer === 'application' && !['application', 'domain'].includes(targetLayer)) || (layer === 'ui' && ['editor', 'infrastructure'].includes(targetLayer))) throw new Error(`Invalid dependency ${file} -> ${target}`);
   edges.push(target);
  } else if ((layer === 'domain' && name !== 'zod') || (layer === 'application' && (name.startsWith('@tiptap') || name.startsWith('react')))) throw new Error(`Invalid package dependency ${file}: ${name}`);
 }
 graph.set(file, edges);
}
const visiting = new Set(); const visited = new Set();
function visit(file) { if (visiting.has(file)) throw new Error(`Dependency cycle: ${file}`); if (visited.has(file)) return; visiting.add(file); for (const edge of graph.get(file) ?? []) visit(edge); visiting.delete(file); visited.add(file); }
for (const file of files) visit(file);
console.log(`Checked dependency boundaries and cycles in ${files.length} source files.`);
