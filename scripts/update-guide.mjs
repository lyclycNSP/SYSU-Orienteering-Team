import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import { root } from './build.mjs';

// Explicit maintenance command: README is the guide content authority.
// Normal site builds continue to copy index.html without rewriting it.
const md = new MarkdownIt({ html: false, linkify: true });
const source = readFileSync(join(root, 'README.md'), 'utf8');
const rendered = md.render(source).replace(/^<h1>[\s\S]*?<\/h1>\n/, '');
const chunks = rendered.split(/(?=<h2>)/);
let content = `<div class="intro">${chunks.shift()}</div>`;
for (const [index, chunk] of chunks.entries()) {
  const groups = chunk.split(/(?=<h3>)/);
  let body = groups.shift();
  if (groups.length) body += '<div class="cards">' + groups.map(group => {
    if (/^<h3>(入门教程视频推荐：|优秀创作者推荐：)<\/h3>/.test(group)) return group.replace('<h3>', '<h3 class="group-heading">');
    return `<article class="card">${group}</article>`;
  }).join('') + '</div>';
  content += `<section id="section-${index + 1}">${body}</section>`;
}
content = content.replace(/<p><img src="([^"]+)" alt="([^"]*)"><\/p>/g,
  '<figure class="legend"><a href="$1" target="_blank" rel="noopener"><img src="$1" alt="$2" loading="lazy"></a><figcaption>$2</figcaption></figure>');
const htmlPath = join(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
if (!html.includes('<main>') || !html.includes('</main>')) throw new Error('Missing guide main region');
writeFileSync(htmlPath, html.replace(/<main>[\s\S]*?<\/main>/, `<main>${content}</main>`));
console.log('Updated guide HTML from README.md');
