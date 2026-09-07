// Decap 3.16 can retain a pending deploy button even with show_preview_links:false.
// Hide only deployment-link controls; the editor's live preview toggle is untouched.
(() => {
  const labels = new Set(['点击以预览', '查看预览', '查看发布', 'Check for Preview', 'View Preview', 'View Live']);
  function hideDeployControls() {
    for (const control of document.querySelectorAll('button, a')) {
      if (labels.has(control.textContent.trim()) && !control.hidden) {
        control.hidden = true;
        control.style.setProperty('display', 'none', 'important');
      }
    }
  }
  new MutationObserver(hideDeployControls).observe(document.body, { childList: true, subtree: true, characterData: true });
  hideDeployControls();
})();
