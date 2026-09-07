// One-time, reviewable migration of referenced legacy images. Dry-run by default.
import { readFileSync, readdirSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, basename, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { articleFolder, mediaKind } from './media-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const variants = path => [...new Set([path, encodeURI(path), path.split('/').map(encodeURIComponent).join('/')])];
const mentions = (text, path) => variants(path).some(value => text.includes(value));

export function planMigration() {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const documents = tracked.filter(path => /\.(md|html|yml|yaml|json)$/.test(path) && !path.includes('package-lock')).map(path => ({ path, text: readFileSync(resolve(root, path), 'utf8') }));
  const articles = documents.filter(doc => /^content\/(posts|rules|tutorials|notices)\/[^/]+\.md$/.test(doc.path)).map(doc => {
    const meta = doc.text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!meta) throw new Error(`缺少元数据：${doc.path}`);
    const data = parse(meta[1]);
    return { ...doc, id: data.media_id || hash(doc.path).slice(0, 24), needsId: !data.media_id, collection: doc.path.split('/')[1] };
  });
  const moves = [];
  for (const oldPath of tracked.filter(path => /^uploads\/[^/]+$/.test(path) && mediaKind(path) === 'image')) {
    const owners = articles.filter(article => mentions(article.text, oldPath));
    if (!owners.length) continue;
    const external = documents.filter(doc => !articles.some(article => article.path === doc.path) && mentions(doc.text, oldPath));
    if (external.length) throw new Error(`图片仍有文章以外的引用，需先检查：${oldPath} → ${external.map(d => d.path).join(', ')}`);
    const folder = owners.length > 1 ? 'uploads/resources' : articleFolder(owners[0].collection, owners[0].id);
    const newPath = `${folder}/${basename(oldPath)}`;
    if (existsSync(resolve(root, newPath))) throw new Error(`目标文件已存在：${newPath}`);
    moves.push({ oldPath, newPath, sha256: hash(readFileSync(resolve(root, oldPath))), articles: owners.map(a => a.path) });
  }
  const updates = articles.map(article => {
    const owned = moves.filter(move => move.articles.includes(article.path));
    let text = article.text;
    for (const move of owned) for (const value of variants(move.oldPath)) text = text.replaceAll(value, value === move.oldPath ? move.newPath : encodeURI(move.newPath));
    if (owned.length && article.needsId) text = text.replace(/^---(\r?\n)/, `---$1media_id: ${article.id}$1`);
    return { path: article.path, before: article.text, after: text };
  }).filter(update => update.before !== update.after);
  return { moves, updates };
}

export function applyMigration(plan) {
  const uploadRoot = resolve(root, 'uploads');
  // Validate every absolute source/target before performing any move.
  for (const move of plan.moves) {
    for (const path of [move.oldPath, move.newPath]) {
      const rel = relative(uploadRoot, resolve(root, path));
      if (!rel || rel === '..' || rel.startsWith('..' + sep) || resolve(uploadRoot, rel) !== resolve(root, path)) throw new Error('迁移路径超出 uploads');
    }
    if (existsSync(resolve(root, move.newPath)) || hash(readFileSync(resolve(root, move.oldPath))) !== move.sha256) throw new Error('文件在计划后发生变化');
  }
  for (const update of plan.updates) if (readFileSync(resolve(root, update.path), 'utf8') !== update.before) throw new Error('文章在计划后发生变化');
  for (const move of plan.moves) {
    mkdirSync(dirname(resolve(root, move.newPath)), { recursive: true });
    renameSync(resolve(root, move.oldPath), resolve(root, move.newPath));
    if (hash(readFileSync(resolve(root, move.newPath))) !== move.sha256) throw new Error('迁移后文件校验失败');
  }
  for (const update of plan.updates) writeFileSync(resolve(root, update.path), update.after);
  mkdirSync(resolve(root, 'config'), { recursive: true });
  const manifest = resolve(root, 'config/media-aliases.json');
  const existing = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : [];
  writeFileSync(manifest, JSON.stringify([...existing, ...plan.moves], null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = planMigration();
  console.log(JSON.stringify({ images: plan.moves.length, articles: plan.updates.length, shared: plan.moves.filter(m => m.articles.length > 1).length, moves: plan.moves }, null, 2));
  if (process.argv.includes('--apply')) applyMigration(plan);
}
