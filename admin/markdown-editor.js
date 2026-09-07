/* global CMS, h, createClass */
(() => {
  const native = CMS.getWidget('markdown');
  const clamp = (value, length) => Math.max(0, Math.min(value, length));
  function edit(text, start, end, action, target = '') {
    start = clamp(start, text.length);
    end = Math.max(start, clamp(end, text.length));
    const selected = text.slice(start, end);
    let replacement;
    let offset = 0;
    let selectedLength;
    const marks = { bold: '**', italic: '*', strike: '~~', code: '`' };
    if (marks[action]) {
      const mark = marks[action];
      replacement = mark + (selected || '文字') + mark;
      offset = mark.length;
      selectedLength = (selected || '文字').length;
    } else if (['h2', 'h3', 'quote', 'ul', 'ol'].includes(action)) {
      start = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
      if (end > start && text[end - 1] === '\n') end -= 1;
      const lineEnd = text.indexOf('\n', end);
      end = lineEnd < 0 ? text.length : lineEnd;
      const lines = text.slice(start, end).split('\n');
      replacement = lines.map((line, index) => {
        const prefix = { h2: '## ', h3: '### ', quote: '> ', ul: '- ', ol: `${index + 1}. ` }[action];
        return prefix + line;
      }).join('\n');
    } else if (action === 'block') {
      const fence = '`'.repeat(Math.max(3, ...((selected.match(/`+/g) || []).map(run => run.length + 1))));
      replacement = `\n${fence}\n${selected || '代码'}\n${fence}\n`;
    } else if (['link', 'image', 'file'].includes(action)) {
      if (!target || !/^(https?:\/\/|mailto:|uploads\/|\/uploads\/|#)/i.test(target) || /[<>\r\n]/.test(target)) throw new Error('请输入 http(s) 链接或选择上传文件。');
      const label = (selected || (action === 'image' ? '图片说明' : action === 'file' ? '下载附件' : '链接文字')).replace(/[\[\]\r\n]/g, '');
      const destination = action === 'image' ? target.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29') : `<${target}>`;
      replacement = `${action === 'image' ? '!' : ''}[${label}](${destination})`;
      if (action !== 'link') replacement = `\n\n${replacement}\n\n`;
      offset = replacement.length;
      selectedLength = 0;
    } else throw new Error(`未知编辑操作：${action}`);
    return { value: text.slice(0, start) + replacement + text.slice(end), start: start + offset, end: start + offset + (selectedLength ?? replacement.length) };
  }

  const Control = createClass({
    getInitialState() { return { mode: 'rich', pending: null, error: '' }; },
    // Decap's outer Widget otherwise ignores mediaPaths-only changes.
    shouldComponentUpdate() { return true; },
    componentDidMount() {
      this.mediaID = `team-markdown-${crypto.randomUUID()}`;
      this.undoStack = [];
      this.redoStack = [];
    },
    componentDidUpdate() {
      const path = this.props.mediaPaths?.get(this.mediaID);
      if (path && this.state.pending) {
        const pending = this.state.pending;
        this.props.onRemoveInsertedMedia(this.mediaID);
        this.setState({ pending: null });
        this.apply(pending.action, String(path), pending);
      }
    },
    componentWillUnmount() { this.props.onRemoveMediaControl(this.mediaID); },
    focus() { if (this.raw) this.raw.focus(); else this.rich?.focus(); },
    richAsset(path, field) {
      let value = String(path || '').replace(/^<(.+)>$/, '$1');
      try { value = decodeURIComponent(value); } catch { /* Let Decap handle malformed paths. */ }
      value = value.replace(/^\/(?:SYSU-Orienteering-Team\/)?uploads\//, 'uploads/');
      return this.props.getAsset(value, field);
    },
    selection() {
      const text = this.props.value || '';
      return { start: this.raw?.selectionStart ?? text.length, end: this.raw?.selectionEnd ?? text.length };
    },
    change(value, selection) {
      if (this.props.isDisabled) return;
      this.undoStack.push({ value: this.props.value || '', ...this.selection() });
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack = [];
      this.props.onChange(value);
      if (selection) requestAnimationFrame(() => { this.raw?.focus(); this.raw?.setSelectionRange(selection.start, selection.end); });
    },
    history(redo) {
      const source = redo ? this.redoStack : this.undoStack;
      const dest = redo ? this.undoStack : this.redoStack;
      if (!source.length || this.props.isDisabled) return;
      const previous = source.pop();
      dest.push({ value: this.props.value || '', ...this.selection() });
      this.props.onChange(previous.value);
      requestAnimationFrame(() => { this.raw?.focus(); this.raw?.setSelectionRange(previous.start, previous.end); });
    },
    apply(action, target, selection = this.selection()) {
      try {
        const result = edit(this.props.value || '', selection.start, selection.end, action, target);
        this.setState({ error: '' });
        this.change(result.value, result);
      } catch (error) { this.setState({ error: error.message }); }
    },
    pick(action) {
      this.setState({ pending: { ...this.selection(), action } });
      this.props.onOpenMediaLibrary({ controlID: this.mediaID, forImage: action === 'image', allowMultiple: false, value: '', field: this.props.field.set('widget', action === 'image' ? 'image' : 'file') });
    },
    switchMode(mode) {
      this.props.onClearMediaControl(this.mediaID);
      this.undoStack = [];
      this.redoStack = [];
      this.setState({ mode, pending: null, error: '' });
    },
    render() {
      const rawMode = this.state.mode === 'raw';
      const button = (label, run) => h('button', { key: label, type: 'button', disabled: this.props.isDisabled, onMouseDown: event => event.preventDefault(), onClick: run }, label);
      const richField = this.props.field.set('widget', 'markdown').set('modes', this.props.field.toList().clear().push('rich_text'));
      return h('div', { className: 'team-editor' },
        h('div', { className: 'team-editor-modes', role: 'group', 'aria-label': '编写模式' },
          h('button', { type: 'button', 'aria-pressed': !rawMode, onClick: () => this.switchMode('rich') }, '富文本'),
          h('button', { type: 'button', 'aria-pressed': rawMode, onClick: () => this.switchMode('raw') }, 'Markdown')),
        rawMode ? h('div', {},
          h('div', { className: 'team-markdown-toolbar', role: 'toolbar', 'aria-label': 'Markdown 快捷操作' },
            ...[['加粗', 'bold'], ['斜体', 'italic'], ['删除线', 'strike'], ['行内代码', 'code'], ['二级标题', 'h2'], ['三级标题', 'h3'], ['引用', 'quote'], ['无序列表', 'ul'], ['有序列表', 'ol'], ['代码块', 'block']].map(([label, action]) => button(label, () => this.apply(action))),
            button('链接', () => { const selection = this.selection(); const url = window.prompt('请输入链接地址', 'https://'); if (url) this.apply('link', url.trim(), selection); }),
            button('图片', () => this.pick('image')), button('附件', () => this.pick('file')),
            button('撤销', () => this.history(false)), button('重做', () => this.history(true))),
          this.state.error ? h('p', { role: 'alert' }, this.state.error) : null,
          h('textarea', { ref: node => { this.raw = node; }, 'aria-label': 'Markdown 正文', value: this.props.value || '', disabled: this.props.isDisabled,
            onChange: event => this.change(event.target.value), onKeyDown: event => {
              if (!(event.ctrlKey || event.metaKey)) return;
              const key = event.key.toLowerCase();
              if (key === 'z' || key === 'y') { event.preventDefault(); this.history(key === 'y' || event.shiftKey); }
              if (key === 'b' || key === 'i') { event.preventDefault(); this.apply(key === 'b' ? 'bold' : 'italic'); }
            } }))
          : h(native.control, { ...this.props, getAsset: this.richAsset, ref: node => { this.rich = node; }, field: richField })
      );
    }
  });
  CMS.registerWidget({ name: 'team-markdown', controlComponent: Control, previewComponent: native.preview, schema: native.schema, globalStyles: native.globalStyles });
  window.TeamMarkdownEdit = edit;
})();
