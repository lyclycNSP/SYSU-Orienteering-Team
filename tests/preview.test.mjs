import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import MarkdownIt from 'markdown-it';
import * as TeamAttachments from '../scripts/attachments.mjs';

function previewHarness() {
  const templates = {};
  const components = {};
  const context = {
    window: { TeamAttachments }, markdownit: MarkdownIt, createClass: value => value,
    h: (type, props, ...children) => ({ type, props, children }),
    CMS: {
      registerPreviewStyle() {},
      registerPreviewTemplate(name, component) { templates[name] = component; },
      registerEditorComponent(component) { components[component.id] = component; }
    }
  };
  vm.runInNewContext(readFileSync(new URL('../admin/preview.js', import.meta.url), 'utf8'), context);
  return { ...context.window.TeamCMSPreview, templates, components };
}

test('Draft cover and Markdown images resolve from the same in-memory asset', () => {
  const preview = previewHarness();
  const lookup = [];
  const getAsset = path => {
    lookup.push(path);
    assert.equal(path, 'uploads/草稿.jpg');
    return { toString: () => 'blob:https://example.test/draft' };
  };
  assert.equal(preview.assetPreview('/uploads/草稿.jpg', getAsset), 'blob:https://example.test/draft');
  assert.match(preview.renderBody('![图片](/uploads/草稿.jpg)', getAsset), /src="blob:https:\/\/example.test\/draft"/);
  assert.equal(lookup.length, 2);
  assert.doesNotMatch(preview.renderBody('<script>alert(1)</script>', getAsset), /<script>/);
});

test('Attachment insert component uses portable Markdown and has a file picker', () => {
  const { components, templates } = previewHarness();
  assert.ok(templates.posts && templates.rules && templates.resources);
  const attachment = components.attachment;
  assert.equal(attachment.fields[1].widget, 'file');
  assert.equal(attachment.pattern.multiline, false);
  const block = attachment.toBlock({ title: '下载资料', file: 'uploads/比赛 记录.docx' });
  const result = attachment.fromBlock(block.match(attachment.pattern));
  assert.equal(result.file, 'uploads/比赛 记录.docx');
  assert.equal(result.title, '下载资料');
  const paired = attachment.toBlock({ title: 'Word原件', file: 'uploads/resources/rules.docx', preview: 'uploads/resources/rules.pdf' });
  assert.equal(attachment.fromBlock(paired.match(attachment.pattern)).preview, 'uploads/resources/rules.pdf');
});

test('Unpublished PDF links use the draft blob URL for preview and download', () => {
  const preview = previewHarness();
  const html = preview.renderBody('[PDF](<uploads/articles/posts/id/说明.pdf>)', path => {
    assert.equal(path, 'uploads/articles/posts/id/说明.pdf');
    return { toString: () => 'blob:https://example.test/pdf' };
  });
  assert.equal((html.match(/href="blob:https:\/\/example.test\/pdf"/g) || []).length, 2);
  assert.match(html, /target="_blank"/);
});
