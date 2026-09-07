import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { articleFolder, uploadPath, uniqueName, filterMedia, referencedUploads } from '../scripts/media-policy.mjs';
import { patchSelectors, patchGithub } from '../scripts/cms-compat.mjs';
import { renderMarkdown } from '../scripts/build.mjs';

test('Media groups preserve old references and isolate new article/shared uploads', () => {
  const folder = articleFolder('posts', 'article-1');
  const files = ['uploads/旧图.jpg', `${folder}/photo.jpg`, 'uploads/articles/posts/other/photo.jpg', 'uploads/resources/map.pdf'].map(path => ({ path }));
  const references = referencedUploads({ cover: 'uploads/旧图.jpg', body: '[资料](<uploads/resources/map.pdf>)' });
  assert.deepEqual(filterMedia(files, { scope: 'article', folder, references }).map(f => f.path), [files[0].path, files[1].path, files[3].path]);
  assert.deepEqual(filterMedia(files, { scope: 'shared' }).map(f => f.path), [files[3].path]);
  assert.equal(filterMedia(files, { scope: 'all', imagesOnly: true }).length, 3);
  assert.equal(filterMedia(files, { scope: 'all', type: 'document', query: 'resources MAP' }).length, 1);
  assert.equal(filterMedia(files, { scope: 'article', folder: null }).length, 0);
});

test('Upload names and paths cannot escape uploads or overwrite legacy files', () => {
  for (const path of ['uploads/../secret', 'uploads/%2e%2e/secret', 'uploads/a\\b', 'uploads//a', 'https://evil.test/a', 'uploads/a%252f..']) assert.equal(uploadPath(path), null);
  assert.equal(uploadPath('/SYSU-Orienteering-Team/uploads/中文%20文件.pdf'), 'uploads/中文 文件.pdf');
  assert.equal(uniqueName('成绩 表.PDF', '12345678'), '成绩 表-12345678.pdf');
  assert.notEqual(uniqueName('a.jpg', '11111111'), uniqueName('a.jpg', '22222222'));
  assert.throws(() => articleFolder('../secret', 'id'));
  assert.throws(() => articleFolder('posts', '../id'));
});

test('Locked Decap selectors preserve nested paths during insertion and publication', () => {
  const source = patchSelectors(readFileSync('node_modules/decap-cms-core/dist/esm/reducers/entries.js', 'utf8'));
  const start = source.indexOf('export function selectMediaFilePath(');
  const end = source.indexOf('export function selectEditingDraft(', start);
  const context = { isAbsolutePath: () => false, selectMediaFolder: () => 'uploads', join: (...parts) => parts.join('/'), basename: p => p.split('/').pop() };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end).replaceAll('export function', 'function'), context);
  const nested = 'uploads/articles/posts/id/中文 文件.pdf';
  assert.equal(context.selectMediaFilePath({}, null, null, nested), nested);
  assert.equal(context.selectMediaFilePublicPath({}, null, nested, null), nested);
  assert.equal(context.selectMediaFilePath({}, null, null, 'legacy.jpg'), 'uploads/legacy.jpg');
  assert.throws(() => context.selectMediaFilePath({}, null, null, 'uploads/../bad'));
  assert.throws(() => patchSelectors('upstream changed'));
  assert.match(patchGithub(readFileSync('node_modules/decap-cms-backend-github/dist/esm/implementation.js', 'utf8')), /listFiles\(mediaFolder, \{ depth: 64 \}\)/);
});

test('PDF preview and download share a valid project-relative URL; Word remains a download', () => {
  const html = renderMarkdown('[成绩](<uploads/articles/posts/id/成绩 表.pdf>) [Word](uploads/resources/rules.docx) [普通](https://example.org/)');
  const urls = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.equal(urls[0], urls[1]);
  assert.match(urls[0], /^\.\.\/\.\.\/uploads\/articles\/posts\/id\//);
  assert.match(html, /title="在新标签页预览 PDF"/);
  assert.match(html, /title="下载原文件" download=""/);
  assert.match(html, /<a href="https:\/\/example.org\/">普通<\/a>/);
  assert.doesNotMatch(renderMarkdown('[x](javascript:alert(1))'), /href="javascript:/);
});
