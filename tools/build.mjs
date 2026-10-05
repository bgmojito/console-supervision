// Build sans dépendance : src/index.html -> dist/index.html autonome (CSS, polices et modules inlinés).
//
// Conventions des modules (vérifiées ici, le build échoue sinon) :
//   - imports en tête de fichier, en début de ligne :
//       import { a, b as c } from './x.js';   import * as NS from './x.js';   import './x.js';
//     import('./x.js') dynamique autorisé (le module est alors évalué au premier appel) ;
//   - exports uniquement par une liste `export { a, b as c };` (les lignes de déclaration restent identiques à l'original) ;
//   - pas d'`export let` / `export var` ni d'autre forme d'export : l'état partagé et modifiable passe par des objets ;
//   - pas de cycle d'imports statiques.
// Chaque module est placé dans sa propre fonction et évalué au premier import, dans le même ordre que des modules ES natifs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist', 'index.html');

const fail = msg => { throw new Error('build : ' + msg); };
const rel = f => path.relative(SRC, f).split(path.sep).join('/');

/* ---------- Modules ---------- */
const IMPORT_RE = /^import\s+(?:(\*\s+as\s+[\w$]+)|\{([^}]*)\}\s*|)\s*(?:from\s+)?'([^']+)';?[ \t]*$/gm;
const DYN_RE = /\bimport\(\s*'([^']+)'\s*\)/g;
const EXPORT_RE = /^export\s*\{([^}]*)\};?[ \t]*$/gm;

function parseSpecs(list, file) {
  return list.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
    if (!m) fail(`${file} : spécificateur illisible « ${s} »`);
    return { name: m[1], as: m[2] || m[1] };
  });
}

const modules = new Map();   // id -> { id, code, deps, dyn }
function load(file) {
  const id = rel(file);
  if (modules.has(id)) return id;
  if (!fs.existsSync(file)) fail(`module introuvable : ${id}`);
  let code = fs.readFileSync(file, 'utf8');
  const resolve = spec => {
    if (!spec.startsWith('.')) fail(`${id} : seuls les chemins relatifs sont acceptés (« ${spec} »)`);
    return rel(path.resolve(path.dirname(file), spec));
  };
  const mod = { id, deps: [], dyn: [], code: '' };
  modules.set(id, mod);

  const imports = [];
  code = code.replace(IMPORT_RE, (all, ns, list, spec) => {
    const dep = resolve(spec);
    imports.push(dep);
    if (ns) return `const ${ns.replace(/^\*\s+as\s+/, '')} = __require(${JSON.stringify(dep)});`;
    if (list !== undefined) {
      const specs = parseSpecs(list, id);
      return `const { ${specs.map(s => s.name === s.as ? s.name : `${s.name}: ${s.as}`).join(', ')} } = __require(${JSON.stringify(dep)});`;
    }
    return `__require(${JSON.stringify(dep)});`;
  });
  const exportsList = [];
  code = code.replace(EXPORT_RE, (all, list) => { exportsList.push(...parseSpecs(list, id)); return ''; });
  code = code.replace(DYN_RE, (all, spec) => { const dep = resolve(spec); mod.dyn.push(dep); return `__import(${JSON.stringify(dep)})`; });

  const leftover = code.match(/^(import|export)\b.*$/m);
  if (leftover) fail(`${id} : forme non prise en charge : « ${leftover[0].slice(0, 80)} »`);
  const indented = code.match(/^[ \t]+(?:import|export)\s*[{*'\w].*$/m);
  if (indented) fail(`${id} : import/export indenté (doit être en début de ligne) : « ${indented[0].trim().slice(0, 80)} »`);

  mod.deps = imports;
  mod.code = code + `\nreturn { ${exportsList.map(s => s.name === s.as ? s.name : `${s.as}: ${s.name}`).join(', ')} };`;
  for (const d of imports) load(path.join(SRC, d));
  for (const d of mod.dyn) load(path.join(SRC, d));
  return id;
}

function checkCycles() {
  const state = new Map();
  const visit = (id, stack) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) fail(`cycle d'imports : ${[...stack, id].join(' -> ')}`);
    state.set(id, 1);
    for (const d of modules.get(id).deps) visit(d, [...stack, id]);
    state.set(id, 2);
  };
  for (const id of modules.keys()) visit(id, []);
}

function bundle(entryFile) {
  const entry = load(entryFile);
  checkCycles();
  const defs = [...modules.values()].map(m => `${JSON.stringify(m.id)}: () => {\n${m.code}\n}`).join(',\n');
  return `(() => {
const __defs = {
${defs}
};
const __cache = Object.create(null);
function __require(id) {
  if (!(id in __cache)) { __cache[id] = null; __cache[id] = __defs[id](); }
  return __cache[id];
}
function __import(id) { return Promise.resolve().then(() => __require(id)); }
__require(${JSON.stringify(entry)});
})();`;
}

/* ---------- CSS et polices ---------- */
const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml' };
function inlineCss(file) {
  const css = fs.readFileSync(file, 'utf8');
  return css.replace(/url\((?!data:|https?:)['"]?([^'")]+)['"]?\)/g, (all, u) => {
    const f = path.resolve(path.dirname(file), u), type = MIME[path.extname(f)];
    if (!type || !fs.existsSync(f)) fail(`${rel(file)} : ressource introuvable ou type inconnu : ${u}`);
    return `url(data:${type};base64,${fs.readFileSync(f).toString('base64')})`;
  });
}

/* ---------- Page ---------- */
let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (all, href) => `<style>\n${inlineCss(path.join(SRC, href))}</style>`);
let scripts = 0;
html = html.replace(/<script type="module" src="([^"]+)"><\/script>/g, (all, src) => {
  scripts++;
  const js = bundle(path.join(SRC, src));
  if (/<!--|<script/i.test(js)) fail('séquence « <!-- » ou « <script » dans le code : elle casserait le script inline');
  return `<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
});
if (scripts !== 1) fail(`un seul <script type="module" src> attendu dans index.html, trouvé : ${scripts}`);
const external = html.match(/(?:src|href)="(?!#|data:)[^"]+"/);
if (external) fail(`ressource externe restante : ${external[0]}`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`dist/index.html : ${(html.length / 1024).toFixed(0)} Ko, ${modules.size} module(s) : ${[...modules.keys()].join(', ')}`);
