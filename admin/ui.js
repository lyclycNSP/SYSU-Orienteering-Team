// Decap 3.16 can retain a pending deploy button even with show_preview_links:false.
// Hide deployment-link and unused scroll-sync controls; the editor's live preview toggle is untouched.
(() => {
  const labels = new Set(['点击以预览', '查看预览', '查看发布', '同步滚动', 'Check for Preview', 'View Preview', 'View Live', 'Sync Scrolling']);
  function getControlLabel(control) {
    return [
      control.textContent,
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
    ].map(value => (value || '').trim()).find(value => labels.has(value)) || '';
  }
  function hideDeployControls() {
    for (const control of document.querySelectorAll('button, a')) {
      if (getControlLabel(control) && !control.hidden) {
        control.hidden = true;
        control.style.setProperty('display', 'none', 'important');
      }
    }
  }
  new MutationObserver(hideDeployControls).observe(document.body, { childList: true, subtree: true, characterData: true });
  hideDeployControls();
})();
