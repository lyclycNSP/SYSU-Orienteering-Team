import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { shouldSkipBuild } from '../scripts/netlify-ignore.mjs';

test('Netlify skips content changes but retains code, mixed, rename and missing-history builds', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sysu-netlify-ignore-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  const write = (path, value) => writeFileSync(join(cwd, path), value);
  const commit = () => {
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  mkdirSync(join(cwd, 'content'));
  mkdirSync(join(cwd, 'uploads'));
  mkdirSync(join(cwd, 'admin'));
  write('admin/config.yml', 'backend: github');
  const base = commit();
  write('content/规程.md', '# 规程');
  write('uploads/封面 图.jpg', 'fixture');
  const content = commit();
  const env = (from, to) => ({ CACHED_COMMIT_REF: from, COMMIT_REF: to });
  assert.equal(shouldSkipBuild(env(base, content), cwd), true);
  write('content/规程.md', '# 新规程');
  const nextContent = commit();
  assert.equal(shouldSkipBuild(env(base, nextContent), cwd), true);
  write('admin/config.yml', 'backend: changed');
  const code = commit();
  assert.equal(shouldSkipBuild(env(content, code), cwd), false);
  assert.equal(shouldSkipBuild(env(base, code), cwd), false);
  renameSync(join(cwd, 'admin/config.yml'), join(cwd, 'uploads/config.yml'));
  const renamed = commit();
  assert.equal(shouldSkipBuild(env(code, renamed), cwd), false);
  assert.equal(shouldSkipBuild(env(content, content), cwd), true);
  assert.equal(shouldSkipBuild({}, cwd), false);
  assert.equal(shouldSkipBuild(env('0'.repeat(40), content), cwd), false);
  const script = fileURLToPath(new URL('../scripts/netlify-ignore.mjs', import.meta.url));
  for (const [from, to, expected] of [[base, content, 0], [content, code, 1]]) {
    const result = spawnSync(process.execPath, [script], { cwd, env: { ...process.env, ...env(from, to) } });
    assert.equal(result.status, expected);
  }
});
