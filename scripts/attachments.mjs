export const isPDF = value => /\.pdf(?:[?#].*)?$/i.test(String(value));
export const isAttachment = value => /\.(pdf|docx?|xlsx?|pptx?|zip|7z|txt|csv)(?:[?#].*)?$/i.test(String(value));

// Ordinary Markdown links remain portable. Only attachment links gain controls.
export function attachmentLinks(md, resolve = value => value) {
  // The editor's paired attachment already supplies download + preview links.
  // Mark that pair before rendering instead of adding a download to each PDF.
  md.core.ruler.after('inline', 'attachment-pairs', state => {
    for (const block of state.tokens) {
      const tokens = block.children || [];
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type !== 'link_open' || !isAttachment(tokens[i].attrGet('href'))) continue;
        let end = i + 1;
        while (end < tokens.length && tokens[end].type !== 'link_close') end++;
        let next = end + 1;
        if (tokens[next]?.type === 'text' && !tokens[next].content.trim()) next++;
        if (tokens[next]?.type === 'link_open' && isPDF(tokens[next].attrGet('href')) && tokens[next + 1]?.content === 'PDF预览' && tokens[next + 2]?.type === 'link_close') {
          tokens[i].meta = { pairedDownload: true };
          tokens[next].meta = { pairedPreview: true };
          i = next + 2;
        }
      }
    }
  });
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
      const download = !isPDF(original) || token.meta?.pairedDownload;
      token.attrSet('title', download ? '下载原文件' : '在新标签页预览 PDF');
      if (download) token.attrSet('download', '');
      for (let j = index + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'link_close') {
          tokens[j].meta = { attachment: isPDF(original) && !token.meta?.pairedDownload && !token.meta?.pairedPreview ? href : null };
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
