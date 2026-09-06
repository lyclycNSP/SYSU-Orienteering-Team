const buttons = document.querySelectorAll('[data-filter]');
const cards = document.querySelectorAll('[data-category]');
buttons.forEach(button => button.addEventListener('click', () => {
  const selected = button.dataset.filter;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  let count = 0;
  cards.forEach(card => {
    card.hidden = selected !== 'all' && card.dataset.category !== selected;
    if (!card.hidden) count += 1;
  });
  document.querySelector('#result-count').textContent = `共 ${count} 篇`;
}));
