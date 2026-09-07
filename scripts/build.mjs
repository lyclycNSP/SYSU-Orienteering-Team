import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { parse } from 'yaml';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const categories = { '队伍文化宣传': 'culture', '定向入门': 'guide', '规章制度': 'rules', '名单公示': 'notices' };
const aliases = { '训练回顾': '队伍文化宣传', '比赛故事': '队伍文化宣传', '入门资料': '定向入门', '入门教程': '定向入门', '队伍规程': '规章制度' };
const categoryPaths = { culture: 'culture', guide: 'tutorials', rules: 'rules', notices: 'notices' };
const normalizeCategory = category => aliases[category] || category;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// CMS saves uploads relative to the site root. Published pages use relative URLs,
// so the same artifact works at both a domain root and a GitHub project subpath.
export function assetUrl(value, prefix) {
  const url = String(value ?? '');
  if (/^https:\/\/[^\s<>"\\]+$/i.test(url)) return url;
  const local = decodeURIComponent(url).replace(/^\/(?:SYSU-Orienteering-Team\/)?/, '');
  if (!local.startsWith('uploads/') || /[\\?#%\x00-\x1f]/.test(local) || local.split('/').some(part => part === '..' || part === '.')) {
    throw new Error(`图片必须来自 uploads 或 HTTPS 地址：${url}`);
  }
  return prefix + local.split('/').map(encodeURIComponent).join('/');
}

export function fileUrl(value, prefix) {
  const url = String(value ?? '');
  if (/^https:\/\/[^\s<>"\\]+$/i.test(url)) return url;
  const local = decodeURIComponent(url).replace(/^\/(?:SYSU-Orienteering-Team\/)?/, '');
  if (!local || local.startsWith('/') || /[:\\?#%\x00-\x1f]/.test(local) || local.split('/').some(part => part === '..' || part === '.')) throw new Error(`无效的附件或阅读地址：${url}`);
  return prefix + local.split('/').map(encodeURIComponent).join('/');
}

export function renderMarkdown(body, prefix = '../../') {
  const md = new MarkdownIt({ html: false, linkify: true });
  const imageRule = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    // Native rich-text editing can serialize an unselected image as ![]().
    // It contains no asset to publish; do not let it block unrelated articles.
    if (!(token.attrGet('src') || '').trim()) return '';
    token.attrSet('src', assetUrl(token.attrGet('src'), prefix));
    token.attrSet('loading', 'lazy');
    return imageRule(tokens, index, options, env, renderer);
  };
  const linkRule = md.renderer.rules.link_open ?? ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    if (/^(?:\/(?:SYSU-Orienteering-Team\/)?)?uploads\//.test(href)) token.attrSet('href', assetUrl(href, prefix));
    return linkRule(tokens, index, options, env, renderer);
  };
  return md.render(body);
}

export function readContent(file) {
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: 缺少 Markdown 元数据`);
  const data = parse(match[1]);
  if (!data || typeof data.title !== 'string' || !data.title.trim()) throw new Error(`${file}: 标题不能为空`);
  if (typeof data.summary !== 'string') throw new Error(`${file}: 缺少摘要`);
  if (data.date && (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date)) throw new Error(`${file}: 日期应为 YYYY-MM-DD`);
  for (const key of ['published', 'example']) {
    if (data[key] !== undefined && typeof data[key] !== 'boolean') throw new Error(`${file}: ${key} 必须为布尔值`);
  }
  return { ...data, category: normalizeCategory(data.category), body: match[2], slug: basename(file, '.md') };
}

function siteHeader(prefix) {
  const base = `${prefix}team/`;
  const links = [['首页', 'index.html'], ['定向入门', 'tutorials/'], ['规章制度', 'rules/'], ['名单公示', 'notices/'], ['队伍文化宣传', 'culture/'], ['资料下载', 'resources.html'], ['搜索', 'index.html#search']];
  return `<header class="wrap top"><a class="brand" href="${base}"><img class="team-logo" src="${prefix}assets/team-logo.svg" alt="中山大学定向队队徽"><span>中山大学定向队<small>SYSU ORIENTEERING TEAM</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">菜单 ☰</button><nav id="site-nav" class="nav" aria-label="主导航">${links.map(([label, path]) => `<a href="${base}${path}">${label}</a>`).join('')}</nav></header>`;
}

function searchText(body) {
  return new MarkdownIt().render(body).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function template(name, values) {
  const prefix = name === 'article.html' ? '../../' : '../';
  values = { ...values, header: siteHeader(prefix) };
  return readFileSync(join(root, 'templates', name), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`未提供模板变量：${key}`);
    return values[key];
  });
}

export function articleCard(post, index, prefix = '../') {
  post = { ...post, category: normalizeCategory(post.category) };
  const category = categories[post.category];
  if (!Object.hasOwn(categories, post.category)) throw new Error(`未知分类：${post.category}`);
  const art = post.cover
    ? `<div class="art"><img src="${escape(assetUrl(post.cover, prefix))}" alt="${escape(post.cover_alt)}" loading="lazy"></div>`
    : `<div class="art ${category}" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>`;
  const href = post.collection === 'notices' ? `${prefix}team/notices/${encodeURIComponent(post.slug)}.html` : post.collection === 'tutorials' ? `${prefix}team/tutorials/${encodeURIComponent(post.slug)}.html` : post.category === '规章制度' ? `${prefix}team/rules/doc-${encodeURIComponent(post.slug)}.html` : `${prefix}team/posts/${encodeURIComponent(post.slug)}.html`;
  return `<article class="card" data-category="${category}" data-search="${escape(searchText(post.body || ''))}"><a href="${href}">${art}<div class="card-body"><span class="tag">${escape(post.category)}${post.example ? ' · 排版示例' : ''}</span><h3>${escape(post.title)}</h3><p>${escape(post.summary)}</p><div class="card-foot"><span>${post.example ? '内容示例' : escape(post.date || post.author || '中山大学定向队')}</span><span>阅读全文 ↗</span></div></div></a></article>`;
}

export function build() {
  // Fixed generated-output directory only; never rewrite the source guide or team HTML.
  const output = join(root, '_site');
  const guideBefore = readFileSync(join(root, 'index.html'));
  const posts = readdirSync(join(root, 'content/posts')).filter(name => name.endsWith('.md')).map(name => readContent(join(root, 'content/posts', name))).filter(post => post.published !== false);
  const rules = readdirSync(join(root, 'content/rules')).filter(name => name.endsWith('.md')).map(name => ({ ...readContent(join(root, 'content/rules', name)), category: '规章制度' })).filter(post => post.published !== false);
  const tutorials = readdirSync(join(root, 'content/tutorials')).filter(name => name.endsWith('.md')).map(name => ({ ...readContent(join(root, 'content/tutorials', name)), category: '定向入门', collection: 'tutorials' })).filter(post => post.published !== false);
  const notices = readdirSync(join(root, 'content/notices')).filter(name => name.endsWith('.md')).map(name => ({ ...readContent(join(root, 'content/notices', name)), category: '名单公示', collection: 'notices' })).filter(post => post.published !== false);
  const articles = [...posts, ...rules, ...tutorials, ...notices].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || b.slug.localeCompare(a.slug));
  const pages = new Map();
  const cards = articles.map((post, index) => articleCard(post, index));
  pages.set('team/index.html', template('home.html', { cards: cards.join('\n'), count: cards.length }));
  for (const post of articles) {
    const cover = post.cover ? `<img class="article-cover" src="${escape(assetUrl(post.cover, '../../'))}" alt="${escape(post.cover_alt)}">` : '';
    const meta = post.example ? '排版示例 · 非真实活动报道' : [post.date, post.author].filter(Boolean).map(escape).join(' · ');
    const article = `<p class="crumb"><a href="../index.html">首页</a> / ${escape(post.category)}</p><header class="article-head"><p class="eyebrow">${escape(post.category)}</p><h1>${escape(post.title)}</h1><p class="small">${meta}</p></header>${cover}<div class="prose">${renderMarkdown(post.body)}</div><a class="back" href="../${categoryPaths[categories[post.category]]}/index.html">← 返回所属栏目</a>`;
    const path = post.collection === 'notices' ? `team/notices/${post.slug}.html` : post.collection === 'tutorials' ? `team/tutorials/${post.slug}.html` : post.category === '规章制度' ? `team/rules/doc-${post.slug}.html` : `team/posts/${post.slug}.html`;
    pages.set(path, template('article.html', { title: escape(post.title), article }));
  }
  for (const [label, key] of Object.entries(categories)) {
    const selected = articles.filter(post => post.category === label);
    const listing = selected.map((post, index) => articleCard(post, index, '../../')).join('');
    const guide = key === 'guide' ? '<p><a class="button" href="../../index.html">打开队员指南 ↗</a></p>' : '';
    pages.set(`team/${categoryPaths[key]}/index.html`, template('article.html', {
      title: label,
      article: `<p class="crumb"><a href="../index.html">首页</a> / ${label}</p><header class="article-head"><h1>${label}</h1></header>${guide}<div class="rules-grid">${listing || '<p>暂无已发布文章。</p>'}</div><a class="back" href="../index.html">← 返回首页</a>`
    }));
  }
  const resources = parse(readFileSync(join(root, 'content/resources.yml'), 'utf8'));
  if (!resources || typeof resources.title !== 'string' || !Array.isArray(resources.items)) throw new Error('资料下载配置缺少标题或列表');
  const downloads = resources.items.map(item => {
    if (!item || typeof item.title !== 'string' || !item.file) throw new Error('每份资料需要名称和文件');
    return `<section class="chapter"><h2>${escape(item.title)}</h2><p>${escape(item.description)}</p><a class="button" href="${escape(fileUrl(item.file, '../'))}" download>${escape(item.button || '下载文件 ↓')}</a>${item.online_url ? ` <a href="${escape(fileUrl(item.online_url, '../'))}">在线阅读 ↗</a>` : ''}</section>`;
  }).join('\n');
  pages.set('team/resources.html', template('resources.html', {
    title: escape(resources.title),
    article: `<p class="crumb"><a href="index.html">首页</a> / 资料下载</p><header class="article-head"><p class="eyebrow">RESOURCES</p><h1>${escape(resources.title)}</h1><p class="small">${escape(resources.summary)}</p></header>${downloads}<a class="back" href="index.html">← 返回首页</a>`
  }));
  // Validate all content before replacing a previous build. A fresh output prevents
  // deleted or unpublished articles from surviving in the deployed artifact.
  rmSync(output, { recursive: true, force: true });
  mkdirSync(join(output, 'team'), { recursive: true });
  for (const path of ['index.html', '.nojekyll', 'assets', '_redirects', 'downloads', '定向越野指南-中山大学定向队.pdf', 'uploads', 'admin']) {
    cpSync(join(root, path), join(output, path), { recursive: true });
  }
  for (const file of ['style.css', 'content.css', 'filter.js', 'map.svg']) cpSync(join(root, 'team', file), join(output, 'team', file));
  mkdirSync(join(output, 'admin/vendor'), { recursive: true });
  cpSync(join(root, 'node_modules/markdown-it/dist/browser/markdown-it.umd.min.js'), join(output, 'admin/vendor/markdown-it.js'));
  for (const [path, html] of pages) {
    mkdirSync(dirname(join(output, path)), { recursive: true });
    writeFileSync(join(output, path), html);
  }
  // Netlify's pretty URLs may omit .html; Pages requires the actual file path.
  const prettyRedirects = [...pages.keys()].filter(path => path.endsWith('.html')).map(path =>
    `/${path.slice(0, -5)} https://lyclycnsp.github.io/SYSU-Orienteering-Team/${path.split('/').map(encodeURIComponent).join('/')} 302!`
  );
  writeFileSync(join(output, '_redirects'), prettyRedirects.join('\n') + '\n' + readFileSync(join(root, '_redirects'), 'utf8'));
  if (!guideBefore.equals(readFileSync(join(output, 'index.html'))) || !guideBefore.equals(readFileSync(join(root, 'index.html')))) throw new Error('指南完整性检查失败');
  console.log(`已生成 ${articles.length} 篇文章、四类栏目和下载页；指南按原字节复制至 _site。`);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
