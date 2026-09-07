/* global CMS, h, createClass, markdownit */
(() => {
  function assetPreview(path, getAsset) {
    if (!path) return '';
    // Markdown parsers encode Chinese filenames. Decap's in-memory asset keys
    // use the original upload path, so resolve that before requesting a URL.
    let decoded = String(path);
    try { decoded = decodeURIComponent(decoded); } catch { /* Keep malformed text for Decap to report. */ }
    // A leading slash is treated as a public URL by Decap and bypasses its
    // draft asset cache. Our repository stores all CMS uploads in uploads/.
    const lookup = decoded.replace(/^\/(?:SYSU-Orienteering-Team\/)?uploads\//, 'uploads/');
    const asset = getAsset(lookup);
    return asset ? asset.toString() : decoded;
  }
  function renderBody(body, getAsset) {
    const parser = markdownit({ html: false, linkify: true });
    const imageRule = parser.renderer.rules.image;
    parser.renderer.rules.image = (tokens, index, options, env, renderer) => {
      if (!(tokens[index].attrGet('src') || '').trim()) return '<span class="empty-image-hint">图片尚未选择，请选择图片或删除这个空占位。</span>';
      tokens[index].attrSet('src', assetPreview(tokens[index].attrGet('src'), getAsset));
      return imageRule(tokens, index, options, env, renderer);
    };
    window.TeamAttachments.attachmentLinks(parser, path => /^(?:\/(?:SYSU-Orienteering-Team\/)?)?uploads\//.test(path) ? assetPreview(path, getAsset) : path);
    return parser.render(body || '');
  }
  function filePreview(path, getAsset) {
    if (!path) return '';
    if (/^(?:\/(?:SYSU-Orienteering-Team\/)?)?uploads\//.test(path)) return assetPreview(path, getAsset);
    return /^https:\/\//.test(path) ? path : '../' + String(path).replace(/^\//, '');
  }
  const ArticlePreview = createClass({
    render() {
      const data = this.props.entry.get('data');
      const cover = data.get('cover');
      const meta = data.get('example') ? '排版示例 · 非真实活动报道' : [data.get('date'), data.get('author')].filter(Boolean).join(' · ');
      return h('article', { className: 'cms-preview' },
        h('p', { className: 'eyebrow' }, ({posts: '比赛故事', rules: '规章制度', tutorials: '定向入门', notices: '名单公示'}[this.props.entry.get('collection')] || '中山大学定向队')),
        h('h1', {}, data.get('title') || '在左侧填写文章标题'),
        h('p', { className: 'meta' }, meta),
        cover ? h('img', { src: assetPreview(cover, this.props.getAsset), alt: data.get('cover_alt') || '' }) : null,
        h('div', { dangerouslySetInnerHTML: { __html: renderBody(data.get('body'), this.props.getAsset) } })
      );
    }
  });
  const ResourcesPreview = createClass({
    render() {
      const data = this.props.entry.get('data');
      const items = data.get('items');
      return h('article', { className: 'cms-preview' },
        h('p', { className: 'eyebrow' }, 'RESOURCES'),
        h('h1', {}, data.get('title') || '资料下载'),
        h('p', { className: 'meta' }, data.get('summary')),
        items ? items.map((item, index) => h('section', { className: 'cms-resource', key: index },
          h('h2', {}, item.get('title')), h('p', {}, item.get('description')),
          h('a', { className: 'download', href: filePreview(item.get('file'), this.props.getAsset), target: '_blank', rel: 'noopener noreferrer', download: '' }, item.get('button') || '下载文件 ↓'),
          (item.get('preview_file') || item.get('online_url') || window.TeamAttachments.isPDF(item.get('file'))) ? h('a', { href: filePreview(item.get('preview_file') || item.get('online_url') || item.get('file'), this.props.getAsset), target: '_blank', rel: 'noopener noreferrer' }, ' 在线预览 ↗') : null,
          h('p', {}, item.get('file') || '请选择附件')
        )).toArray() : null
      );
    }
  });
  CMS.registerPreviewStyle('preview.css');
  CMS.registerPreviewTemplate('posts', ArticlePreview);
  CMS.registerPreviewTemplate('rules', ArticlePreview);
  CMS.registerPreviewTemplate('tutorials', ArticlePreview);
  CMS.registerPreviewTemplate('notices', ArticlePreview);
  CMS.registerPreviewTemplate('resources', ResourcesPreview);
  // Adds an attachment picker to the Markdown insert menu; stores an ordinary
  // Markdown link so both the public site and other Markdown readers support it.
  CMS.registerEditorComponent({
    id: 'attachment', label: '附件 / PDF预览',
    fields: [
      { name: 'title', label: '链接文字', widget: 'string', default: '下载附件' },
      { name: 'file', label: '附件', widget: 'file' },
      { name: 'preview', label: 'PDF 预览版（可选）', widget: 'file', required: false }
    ],
    pattern: /^\[([^\]\n]+)\]\(<([^>\n]+)>\)(?: \[PDF预览\]\(<([^>\n]+)>\))?$/,
    fromBlock: match => ({ title: match[1], file: match[2], preview: match[3] || '' }),
    toBlock: data => `[${String(data.title || '下载附件').replace(/[\[\]\r\n]/g, '')}](<${String(data.file || '').replace(/[<>\r\n]/g, '')}>)` + (data.preview ? ` [PDF预览](<${String(data.preview).replace(/[<>\r\n]/g, '')}>)` : ''),
    toPreview: data => h('span', {}, '↓ ', data.title || '下载附件', ' · ', data.file || '请选择文件')
  });
  // Expose pure preview helpers for regression tests without an OAuth session.
  window.TeamCMSPreview = { assetPreview, renderBody };
})();
