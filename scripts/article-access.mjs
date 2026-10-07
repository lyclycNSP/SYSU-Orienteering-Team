import { createCipheriv, randomBytes } from 'node:crypto';

// This is a public-repository reading gate, not server-side authorization.
// The CMS stores a derived key instead of the password. Repository readers can
// still obtain that key and the original Markdown.
export function parseAccessKey(value) {
  const match = typeof value === 'string' && value.match(/^v1:([a-f0-9]{32}):([a-f0-9]{64})$/);
  if (!match) throw new Error('启用密码阅读的文章需要先在后台设置密码');
  return { salt: match[1], key: Buffer.from(match[2], 'hex') };
}

export function protectArticle(html, value) {
  const { salt, key } = parseAccessKey(value);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const bytes = Buffer.concat([cipher.update(html, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  const payload = { version: 1, salt, iv: iv.toString('hex'), ciphertext: bytes.toString('base64') };
  return `<section class="article-lock"><h2>本文需要密码阅读</h2><form class="article-unlock"><label>阅读密码 <input type="password" name="password" required autocomplete="off"></label><button type="submit">解锁阅读</button><p role="status" aria-live="polite"></p></form><noscript>请启用 JavaScript 后输入密码。</noscript><script type="application/json" class="article-lock-data">${JSON.stringify(payload)}</script></section><script src="../article-unlock.js" defer></script>`;
}
