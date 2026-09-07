import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { join } from 'node:path';
import { root, build, assetUrl, renderMarkdown, articleCard, readContent } from '../scripts/build.mjs';

test('CMS upload paths work under both hosts and reject unsafe paths', () => {
  assert.equal(assetUrl('/uploads/封面 图.jpg', '../'), '../uploads/%E5%B0%81%E9%9D%A2%20%E5%9B%BE.jpg');
  assert.equal(assetUrl('/SYSU-Orienteering-Team/uploads/a.jpg', '../../'), '../../uploads/a.jpg');
  for (const path of ['javascript:alert(1)', '/uploads/../index.html', '/uploads/%2e%2e/a', '//evil.test/a', '/uploads/a\\b']) assert.throws(() => assetUrl(path, '../'));
});

test('Markdown supports structure, escapes HTML, and rewrites uploads', () => {
  const html = renderMarkdown('## 标题\n\n- 内容\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n![图](/uploads/a.jpg)\n\n[附件](/uploads/a.pdf)\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))');
  assert.match(html, /<h2>标题<\/h2>/);
  assert.match(html, /<table>/);
  assert.match(html, /src="\.\.\/\.\.\/uploads\/a.jpg"/);
  assert.match(html, /href="\.\.\/\.\.\/uploads\/a.pdf"/);
  assert.doesNotMatch(html, /<script>|href="javascript:/);
  assert.match(renderMarkdown('![图](/uploads/封面.jpg)'), /uploads\/%E5%B0%81%E9%9D%A2.jpg/);
});

test('Cards allow an optional cover and escape titles', () => {
  const post = { title: '<script>', category: '训练回顾', summary: '摘要', slug: 'example' };
  assert.match(articleCard(post, 0), /aria-hidden="true">01/);
  const covered = articleCard({ ...post, cover: '/uploads/test.jpg', cover_alt: '路线图' }, 0);
  assert.match(covered, /<img src="\.\.\/uploads\/test.jpg" alt="路线图"/);
  assert.match(covered, /&lt;script&gt;/);
});

test('Build preserves the guide and emits only public files', () => {
  const output = build();
  assert.deepEqual(readFileSync(join(output, 'index.html')), readFileSync(join(root, 'index.html')));
  assert.equal(existsSync(join(output, 'content')), false);
  assert.equal(existsSync(join(output, 'node_modules')), false);
  assert.ok(existsSync(join(output, 'admin/config.yml')));
  const homepage = readFileSync(join(output, 'team/index.html'), 'utf8');
  assert.match(homepage, /<strong>01 \/ 队员指南<\/strong>/);
  const visible = readdirSync(join(root, 'content/posts')).filter(name => name.endsWith('.md')).map(name => readContent(join(root, 'content/posts', name))).filter(post => post.published !== false);
  const outputPosts = existsSync(join(output, 'team/posts')) ? readdirSync(join(output, 'team/posts')) : [];
  assert.equal(outputPosts.length, visible.length);
  // Use an existing generated directory, including when all articles are removed.
  writeFileSync(join(output, 'team/removed-fixture.html'), 'stale');
  build();
  assert.equal(existsSync(join(output, 'team/removed-fixture.html')), false);
});

test('CMS and workflow configuration parse with expected repository and output', () => {
  const cms = parse(readFileSync(join(root, 'admin/config.yml'), 'utf8'));
  assert.equal(cms.backend.repo, 'lyclycNSP/SYSU-Orienteering-Team');
  assert.equal(cms.backend.branch, 'main');
  assert.ok(cms.collections[0].fields.some(field => field.name === 'cover' && field.required === false));
  const workflow = parse(readFileSync(join(root, '.github/workflows/pages.yml'), 'utf8'));
  assert.equal(workflow.jobs.build.steps.at(-1).with.path, '_site');
});
