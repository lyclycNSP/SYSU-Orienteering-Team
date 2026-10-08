import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseAccessKey, protectArticle } from '../scripts/article-access.mjs';
import { articleCard } from '../scripts/build.mjs';

const salt = '00112233445566778899aabbccddeeff';
const password = 'test-reading-password';
const stored = `v1:${salt}:${pbkdf2Sync(password, Buffer.from(salt, 'hex'), 210000, 32, 'sha256').toString('hex')}`;

test('Protected HTML decrypts with the reader password and rejects wrong passwords/tampering', async () => {
  const html = protectArticle('<p>受限正文</p>', stored);
  assert.doesNotMatch(html, /受限正文|test-reading-password/);
  assert.ok(!html.includes(stored.split(':')[2]));
  const payload = JSON.parse(html.match(/class="article-lock-data">([^<]+)</)[1]);
  const decrypt = async (pass, bytes = Buffer.from(payload.ciphertext, 'base64')) => {
    const material = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(payload.salt, 'hex'), iterations: 210000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    return new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(payload.iv, 'hex') }, key, bytes));
  };
  assert.equal(await decrypt(password), '<p>受限正文</p>');
  await assert.rejects(decrypt('wrong-password'));
  const bytes = Buffer.from(payload.ciphertext, 'base64'); bytes[0] ^= 1;
  await assert.rejects(decrypt(password, bytes));
  for (const invalid of ['', 'plain-password', `v2:${salt}:abc`]) assert.throws(() => parseAccessKey(invalid));
});

test('Protected article cards exclude body search text while public cards retain it', () => {
  const post = { title: '标题', summary: '公开摘要', category: '比赛故事', slug: 'test', body: '受限关键词' };
  assert.match(articleCard(post, 0), /受限关键词/);
  const card = articleCard({ ...post, password_protected: true }, 0);
  assert.doesNotMatch(card, /受限关键词/);
  assert.match(card, /公开摘要/);
  assert.match(card, /密码阅读/);
});

test('CMS password widget persists a derived key and keeps unchanged passwords', async () => {
  let control;
  const browser = { querySelector: () => null };
  vm.runInNewContext(readFileSync('admin/article-password.js', 'utf8'), {
    crypto: webcrypto, TextEncoder, Uint8Array, h() {}, createClass: value => value,
    document: browser,
    CMS: { registerWidget: (name, value) => { assert.equal(name, 'article-password'); control = value; } }
  });
  let saved;
  const instance = { ...control, state: { password, editing: true }, props: { onChange: value => { saved = value; } }, setState: value => Object.assign(instance.state, value) };
  assert.notEqual(instance.isValid(), true);
  await instance.savePassword();
  const parsed = parseAccessKey(saved);
  assert.equal(parsed.key.toString('hex'), pbkdf2Sync(password, Buffer.from(parsed.salt, 'hex'), 210000, 32, 'sha256').toString('hex'));
  assert.ok(!saved.includes(password));
  assert.equal(instance.state.password, '');
  assert.equal(instance.isValid(), true);
  saved = undefined;
  await instance.savePassword();
  assert.equal(saved, undefined);
  instance.props.entry = { getIn: () => true };
  instance.props.value = '';
  assert.notEqual(instance.isValid(), true);
  browser.querySelector = () => ({ getAttribute: () => 'false' });
  assert.equal(instance.isValid(), true);
  browser.querySelector = () => ({ getAttribute: () => 'true' });
  assert.notEqual(instance.isValid(), true);
  instance.props.value = stored;
  assert.equal(instance.isValid(), true);
});
