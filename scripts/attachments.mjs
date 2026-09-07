export const isPDF = value => /\.pdf(?:[?#].*)?$/i.test(String(value));
export const isAttachment = value => /\.(pdf|docx?|xlsx?|pptx?|zip|7z|txt|csv)(?:[?#].*)?$/i.test(String(value));

// Ordinary Markdown links remain portable. Only attachment links gain controls.
export function attachmentLinks(md, resolve = value => value) {
  const open = md.renderer.rules.link_open || ((t, i, o, e, r) => r.renderToken(t, i, o));
  const close = md.renderer.rules.link_close || ((t, i, o, e, r) => r.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const original = token.attrGet('href') || '';
    if (isAttachment(original)) {
      const href = resolve(original);
      token.attrSet('href', href);
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
      token.attrSet('title', isPDF(original) ? '在新标签页预览 PDF' : '下载原文件');
      if (!isPDF(original)) token.attrSet('download', '');
      for (let j = index + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'link_close') {
          tokens[j].meta = { attachment: isPDF(original) ? href : null };
          break;
        }
      }
    }
    return open(tokens, index, options, env, renderer);
  };
  md.renderer.rules.link_close = (tokens, index, options, env, renderer) => {
    const href = tokens[index].meta?.attachment;
    return close(tokens, index, options, env, renderer) + (href ? ` <a class="attachment-download" href="${md.utils.escapeHtml(href)}" download target="_blank" rel="noopener noreferrer" aria-label="下载 PDF 文件">下载 PDF ↓</a>` : '');
  };
}
