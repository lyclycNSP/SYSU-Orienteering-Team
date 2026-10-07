/* global CMS, h, createClass */
(() => {
  const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const Control = createClass({
    getInitialState() { return { password: '', editing: false, pending: false, error: '' }; },
    isValid() {
      if (this.state.editing || this.state.pending || this.state.error) return { error: '请完成阅读密码设置后再保存。' };
      if (this.props.entry?.getIn(['data', 'password_protected']) && !/^v1:[a-f0-9]{32}:[a-f0-9]{64}$/.test(this.props.value || '')) return { error: '启用密码阅读前，请先设置阅读密码。' };
      return true;
    },
    async savePassword() {
      const password = this.state.password;
      if (!this.state.editing) return;
      if (password.length < 6) { this.setState({ error: '阅读密码至少需要 6 个字符。' }); return; }
      this.setState({ pending: true, error: '' });
      try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const key = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, material, 256);
        this.props.onChange(`v1:${hex(salt)}:${hex(key)}`);
        this.setState({ password: '', editing: false, error: '' });
      } catch { this.setState({ error: '密码设置失败，请使用 HTTPS 地址和新版浏览器重试。' }); }
      finally { this.setState({ pending: false }); }
    },
    render() {
      return h('div', { className: 'team-article-password' },
        h('p', {}, this.props.value ? '已设置密码。留空保留原密码；填写后点击“设置密码”更换。' : '尚未设置阅读密码。'),
        h('input', { id: this.props.forID, type: 'password', autoComplete: 'new-password', value: this.state.password, disabled: this.state.pending,
          onChange: event => this.setState({ password: event.target.value, editing: true, error: '' }) }),
        h('button', { type: 'button', disabled: !this.state.editing || this.state.pending, onClick: this.savePassword }, this.state.pending ? '正在设置…' : '设置密码'),
        this.props.value ? h('button', { type: 'button', disabled: this.state.pending, onClick: () => { this.props.onChange(''); this.setState({ password: '', editing: false, error: '' }); } }, '清除密码') : null,
        this.state.error ? h('p', { role: 'alert' }, this.state.error) : null
      );
    }
  });
  CMS.registerWidget('article-password', Control);
})();
