const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
menu?.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(expanded));
  nav.classList.toggle('is-open', expanded);
});
nav?.querySelectorAll('a').forEach(link => {
  const target = new URL(link.href);
  if (!target.hash && target.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, '')) link.setAttribute('aria-current', 'page');
});
const buttons = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('[data-category]')];
const input = document.querySelector('#article-search');
let selected = 'all';
const normalize = value => value.normalize('NFKC').toLocaleLowerCase();
function update() {
  const terms = normalize(input?.value || '').trim().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const card of cards) {
    const text = normalize(card.textContent + ' ' + (card.dataset.search || ''));
    card.hidden = (selected !== 'all' && card.dataset.category !== selected) || !terms.every(term => text.includes(term));
    let excerpt = card.querySelector('.search-excerpt');
    if (!excerpt) { excerpt = document.createElement('p'); excerpt.className = 'search-excerpt'; card.querySelector('.card-body')?.append(excerpt); }
    excerpt.hidden = !terms.length;
    const body = card.dataset.search || '';
    const index = terms.length ? normalize(body).indexOf(terms[0]) : -1;
    excerpt.textContent = index >= 0 ? '…' + body.slice(Math.max(0, index - 25), index + 100) + '…' : '';
    if (!card.hidden) count++;
  }
  const counter = document.querySelector('#result-count');
  if (counter) counter.textContent = `共 ${count} 篇`;
  const empty = document.querySelector('#search-empty');
  if (empty) empty.hidden = count !== 0;
}
buttons.forEach(button => button.addEventListener('click', () => {
  selected = button.dataset.filter;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  update();
}));
input?.addEventListener('input', update);
