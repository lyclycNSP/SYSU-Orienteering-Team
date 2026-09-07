import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { parse } from 'yaml';
import { join } from 'node:path';
import { root, build, assetUrl, fileUrl, renderMarkdown, articleCard, readContent } from '../scripts/build.mjs';

test('CMS hides deploy previews and status controls without disabling live preview', () => {
  const cfg = parse(readFileSync(join(root, 'admin/config.yml'), 'utf8'));
  assert.equal(cfg.show_preview_links, false);
  assert.equal(cfg.collections.find(c => c.name === 'posts').summary, '{{title}}');
  for (const collection of cfg.collections.filter(c => c.folder)) {
    assert.notEqual(collection.editor?.preview, false);
    const visibility = collection.fields.find(f => f.name === 'published');
    assert.equal(visibility.widget, 'hidden');
    assert.equal(visibility.default, true);
  }
  const example = cfg.collections.find(c => c.name === 'posts').fields.find(f => f.name === 'example');
  assert.equal(example.widget, 'hidden');
  assert.equal(example.default, false);
});

test('Multiple CMS tutorials generate separate pages and guide category cards', () => {
  const created = [];
  try {
    for (const slug of ['qa-tutorial-one', 'qa-tutorial-two']) {
      const file = join(root, 'content/tutorials', `${slug}.md`);
      writeFileSync(file, `---\ntitle: ${slug}\nsummary: 测试教程\npublished: true\n---\n## 学习步骤\n\n正文\n`, { flag: 'wx' });
      created.push(file);
    }
    const output = build();
    const home = readFileSync(join(output, 'team/index.html'), 'utf8');
    for (const slug of ['qa-tutorial-one', 'qa-tutorial-two']) {
      assert.ok(home.includes(`team/tutorials/${slug}.html`));
      assert.ok(readFileSync(join(output, 'team/tutorials', `${slug}.html`), 'utf8').includes('学习步骤'));
    }
    assert.ok(home.includes('assets/team-logo.svg'));
    assert.ok(home.includes('定向入门'));
    assert.ok(!home.includes('入门资料'));
    const cfg = parse(readFileSync(join(root, 'admin/config.yml'), 'utf8'));
    assert.equal(cfg.collections.find(c => c.name === 'tutorials').create, true);
  } finally {
    for (const file of created) unlinkSync(file);
    build();
  }
});

test('CMS upload paths work under both hosts and reject unsafe paths', () => {
  assert.equal(assetUrl('/uploads/封面 图.jpg', '../'), '../uploads/%E5%B0%81%E9%9D%A2%20%E5%9B%BE.jpg');
  assert.equal(assetUrl('/SYSU-Orienteering-Team/uploads/a.jpg', '../../'), '../../uploads/a.jpg');
  for (const path of ['javascript:alert(1)', '/uploads/../index.html', '/uploads/%2e%2e/a', '//evil.test/a', '/uploads/a\\b']) assert.throws(() => assetUrl(path, '../'));
});

test('Public notices, shared navigation and cross-host redirects preserve article routes', () => {
  const file = join(root, 'content/notices/qa-notice.md');
  writeFileSync(file, '---\ntitle: 公示测试\nsummary: 名单说明\npublished: true\n---\n公示正文\n', { flag: 'wx' });
  try {
    const out = build();
    for (const page of ['team/index.html', 'team/resources.html', 'team/culture/index.html', 'team/notices/index.html', 'team/notices/qa-notice.html']) {
      const html = readFileSync(join(out, page), 'utf8');
      assert.ok(html.includes('team-logo.svg'));
      assert.ok(html.includes('名单公示'));
      assert.ok(!html.includes('栏目建设中'));
      assert.ok(!html.includes('队伍手记'));
    }
    const redirect = readFileSync(join(out, '_redirects'), 'utf8');
    assert.ok(redirect.includes('/team/notices/qa-notice https://lyclycnsp.github.io/SYSU-Orienteering-Team/team/notices/qa-notice.html 302!'));
    assert.ok(!redirect.includes('/* https://lyclycnsp.github.io/SYSU-Orienteering-Team/ 302!'));
    assert.ok(readFileSync(join(out, 'admin/index.html'), 'utf8').includes('location.hostname === "lyclycnsp.github.io"'));
    const config = parse(readFileSync(join(root, 'admin/config.yml'), 'utf8'));
    assert.deepEqual(config.collections.map(c => c.label), ['队伍文化宣传', '规章制度', '定向入门', '名单公示', '资料下载']);
  } finally {
    unlinkSync(file);
    build();
  }
});

test('Markdown supports structure, escapes HTML, and rewrites uploads', () => {
  const placeholder = renderMarkdown('前文\n\n![]()\n\n![合影](uploads/a.jpg)\n\n后文');
  assert.ok(placeholder.includes('前文') && placeholder.includes('后文'));
  assert.equal((placeholder.match(/<img /g) || []).length, 1);
  assert.throws(() => renderMarkdown('![图](../private.jpg)'));
  const html = renderMarkdown('## 标题\n\n- 内容\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n![图](/uploads/a.jpg)\n\n[附件](/uploads/a.pdf)\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))');
  assert.match(html, /<h2>标题<\/h2>/);
  assert.match(html, /<table>/);
  assert.match(html, /src="\.\.\/\.\.\/uploads\/a.jpg"/);
  assert.match(html, /href="\.\.\/\.\.\/uploads\/a.pdf"/);
  assert.doesNotMatch(html, /<script>|href="javascript:/);
  assert.match(renderMarkdown('![图](/uploads/封面.jpg)'), /uploads\/%E5%B0%81%E9%9D%A2.jpg/);
  assert.match(renderMarkdown('[附件](<uploads/测试资料.docx>)'), /href="\.\.\/\.\.\/uploads\/%E6%B5%8B/);
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
  const rules = readdirSync(join(root, 'content/rules')).filter(name => name.endsWith('.md')).map(name => readContent(join(root, 'content/rules', name))).filter(rule => rule.published !== false);
  const rulesIndex = readFileSync(join(output, 'team/rules/index.html'), 'utf8');
  for (const rule of rules) {
    assert.ok(rulesIndex.includes(`doc-${encodeURIComponent(rule.slug)}.html`));
    const article = readFileSync(join(output, `team/rules/doc-${rule.slug}.html`), 'utf8');
    assert.ok(article.includes(renderMarkdown(rule.body)));
  }
  const resources = parse(readFileSync(join(root, 'content/resources.yml'), 'utf8'));
  const downloads = readFileSync(join(output, 'team/resources.html'), 'utf8');
  for (const item of resources.items) assert.ok(downloads.includes(fileUrl(item.file, '../')));
  // Use an existing generated directory, including when all articles are removed.
  writeFileSync(join(output, 'team/removed-fixture.html'), 'stale');
  build();
  assert.equal(existsSync(join(output, 'team/removed-fixture.html')), false);
});

test('CMS and workflow configuration parse with expected repository and output', () => {
  const cms = parse(readFileSync(join(root, 'admin/config.yml'), 'utf8'));
  assert.equal(cms.backend.repo, 'lyclycNSP/SYSU-Orienteering-Team');
  assert.equal(cms.backend.branch, 'main');
  assert.equal(cms.public_folder, 'uploads');
  assert.equal(cms.collections.find(item => item.name === 'rules').create, true);
  assert.ok(cms.collections[0].fields.some(field => field.name === 'cover' && field.required === false));
  const workflow = parse(readFileSync(join(root, '.github/workflows/pages.yml'), 'utf8'));
  assert.equal(workflow.jobs.build.steps.at(-1).with.path, '_site');
});

test('Rule cards use separate URLs and attachments reject executable/path traversal links', () => {
  const first = articleCard({ title: '训练规定', category: '队伍规程', summary: '一', slug: 'one' }, 0, '../../');
  const second = articleCard({ title: '参赛规定', category: '队伍规程', summary: '二', slug: 'two' }, 1, '../../');
  assert.match(first, /team\/rules\/doc-one.html/);
  assert.match(second, /team\/rules\/doc-two.html/);
  assert.equal(fileUrl('/downloads/IOF Control.pdf', '../'), '../downloads/IOF%20Control.pdf');
  for (const value of ['javascript:alert(1)', '../private.pdf', '//evil.test/file', '/uploads/%2e%2e/private']) assert.throws(() => fileUrl(value, '../'));
});
