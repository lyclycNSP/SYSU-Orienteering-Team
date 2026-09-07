import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context = { window: {}, CMS: { getWidget: () => ({}), registerWidget() {} }, createClass: value => value };
vm.runInNewContext(readFileSync(new URL('../admin/markdown-editor.js', import.meta.url), 'utf8'), context);
const edit = context.window.TeamMarkdownEdit;
test('Markdown formatting preserves surrounding text and selects the formatted content', () => {
  const result = edit('前文选择后文', 2, 4, 'bold');
  assert.equal(result.value, '前文**选择**后文');
  assert.equal(result.value.slice(result.start, result.end), '选择');
  assert.equal(edit('甲\n乙\n丙', 0, 4, 'ol').value, '1. 甲\n2. 乙\n丙');
  assert.equal(edit('文字', 0, 0, 'h2').value, '## 文字');
});
test('Media insertions support filenames with spaces and safe code fences', () => {
  assert.match(edit('图片', 0, 2, 'image', 'uploads/测试 图.jpg').value, /!\[图片\]\(uploads\/测试%20图.jpg\)/);
  assert.match(edit('', 0, 0, 'file', 'uploads/资料.pdf').value, /\[下载附件\]/);
  assert.ok(edit('```', 0, 3, 'block').value.includes('````'));
  assert.throws(() => edit('', 0, 0, 'link', 'javascript:alert(1)'));
  const image = edit('', 0, 0, 'image', 'uploads/a.jpg');
  assert.equal(image.start, image.end);
  const attachment = edit(image.value, image.start, image.end, 'file', 'uploads/a.pdf');
  assert.match(attachment.value, /!\[图片说明\]\(uploads\/a.jpg\)/);
  assert.match(attachment.value, /\[下载附件\]\(<uploads\/a.pdf>\)/);
});
