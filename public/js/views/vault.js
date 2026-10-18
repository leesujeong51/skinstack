import { t } from '../i18n.js';
import { html, icon, info, emptyState, confirmDialog } from '../ui.js';
import { update, loadDemo } from '../store.js';
import { eligibility, isEmpty, isMask } from '../domain/product.js';
import { findSimilar } from '../domain/duplicates.js';
import { productRow, productName, similarReason } from './common.js';

export const live = true;
export const title = () => t('vault.title');

const FILTERS = ['all', 'check', 'routine', 'masks', 'empty'];

export function render(ctx) {
  const s = ctx.state;
  const filter = FILTERS.includes(ctx.query.f) ? ctx.query.f : 'all';
  const q = (ctx.query.q || '').toLowerCase();
  const products = s.products.filter((p) => !p.archived);

  if (!products.length && !s.wishlist.length) {
    return emptyState({
      iconName: 'box',
      title: t('vault.emptyTitle'),
      text: t('vault.emptyText'),
      actions: html`<a class="btn btn-primary" href="#/add">${icon('plus')} ${t('home.addFirst')}</a><button type="button" class="btn btn-ghost" data-action="demo">${t('home.loadDemo')}</button>`,
    });
  }

  const match = (p) => {
    if (q && !productName(p).toLowerCase().includes(q)) return false;
    const e = eligibility(p, s.profile, ctx.today);
    if (filter === 'check') return !e.ok && !isEmpty(p);
    if (filter === 'routine') return e.ok;
    if (filter === 'masks') return isMask(p);
    if (filter === 'empty') return isEmpty(p);
    return true;
  };
  const list = products.filter(match).sort((a, b) => productName(a).localeCompare(productName(b)));
  const counts = Object.fromEntries(FILTERS.map((f) => [f, products.filter((p) => {
    const e = eligibility(p, s.profile, ctx.today);
    return f === 'all' || (f === 'check' && !e.ok && !isEmpty(p)) || (f === 'routine' && e.ok) || (f === 'masks' && isMask(p)) || (f === 'empty' && isEmpty(p));
  }).length]));

  return html`
    <form class="search-bar" role="search" data-action="search">
      ${icon('search')}
      <label class="sr-only" for="vault-q">${t('vault.search')}</label>
      <input id="vault-q" name="q" type="search" value="${ctx.query.q || ''}" placeholder="${t('vault.search')}">
    </form>
    <div class="tabs" role="tablist" aria-label="${t('vault.filters')}">
      ${FILTERS.map((f) => html`<a role="tab" aria-selected="${f === filter}" class="tab ${f === filter ? 'active' : ''}" href="#/vault?f=${f}">${t(`vault.filter.${f}`)} <span class="count">${counts[f]}</span></a>`)}
    </div>
    ${list.length ? html`<ul class="product-list">${list.map((p) => productRow(p, ctx.today))}</ul>`
      : html`<p class="muted center">${t('vault.noMatch')}</p>`}

    <section class="card">
      <h3 class="card-title">${icon('cart')} ${t('wishlist.title')} ${info(t('wishlist.info'))}</h3>
      ${s.wishlist.length ? html`<ul class="wish-list">${s.wishlist.map((w) => {
        const sims = findSimilar(w, products);
        return html`<li>
          <div class="wish-head"><strong>${productName(w)}</strong>
            <button type="button" class="icon-btn sm" data-action="wish-remove" data-id="${w.id}" aria-label="${t('common.delete')}">${icon('trash')}</button></div>
          ${sims.length && s.settings.duplicateAlerts ? html`<p class="notice notice-check small">${t('wishlist.similarOwned', { n: sims.length })}: ${sims.slice(0, 3).map((x) => html`<a href="#/product/${x.product.id}">${productName(x.product)}</a> (${x.result.reasons.map(similarReason).join(', ')}) `)}</p>` : ''}
        </li>`;
      })}</ul>` : html`<p class="muted small">${t('wishlist.empty')}</p>`}
      <a class="btn btn-ghost btn-sm" href="#/add?mode=wishlist">${icon('plus')} ${t('wishlist.add')}</a>
    </section>
    <p class="center"><a href="#/requests" class="small">${t('requests.link')}</a></p>`;
}

export function mount(root, ctx) {
  const main = root.querySelector('main');
  main.addEventListener('submit', (e) => {
    if (e.target.dataset.action !== 'search') return;
    e.preventDefault();
    const q = e.target.q.value.trim();
    ctx.navigate(`/vault?f=${ctx.query.f || 'all'}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  });
  main.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'demo') loadDemo(ctx.state.settings.region);
    if (el.dataset.action === 'wish-remove') {
      if (await confirmDialog({ title: t('wishlist.removeTitle'), message: t('wishlist.removeText'), confirmLabel: t('common.delete'), danger: true })) {
        update((s) => { s.wishlist = s.wishlist.filter((w) => w.id !== el.dataset.id); });
      }
    }
  });
}
