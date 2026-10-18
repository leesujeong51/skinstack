import { t, fmtDate, getLocale } from '../i18n.js';
import { html, icon, info, emptyState } from '../ui.js';
import { buildWeek, dayReport } from '../domain/routine.js';
import { startOfWeek, weekStartDay } from '../domain/dates.js';
import { update, loadDemo } from '../store.js';
import { stepList, applyMove, comboList, considerList, similarList, needsCheckList, productName, catLabel } from './common.js';
import { maskUsedOn, useMask } from './masks.js';

export const live = true;
export const title = (ctx) => (ctx.params.date && ctx.params.date !== ctx.today ? fmtDate(ctx.params.date, { weekday: 'long', month: 'long', day: 'numeric' }) : t('home.title'));
export const back = (ctx) => (ctx.params.date ? '/week' : null);

export function computeWeek(state, date, today) {
  return buildWeek({
    products: state.products,
    profile: state.profile,
    maskPlan: state.maskPlan,
    orderOverrides: state.orderOverrides,
    weekStart: startOfWeek(date, weekStartDay(getLocale())),
    todayISO: today,
  });
}

export function render(ctx) {
  const s = ctx.state;
  const date = ctx.params.date || ctx.today;
  const week = computeWeek(s, date, ctx.today);
  const day = week.days.find((d) => d.date === date);
  const byId = new Map(s.products.map((p) => [p.id, p]));
  const isToday = date === ctx.today;

  const header = html`
    <section class="hero">
      <p class="eyebrow">${fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      <h2 class="hero-title">${isToday ? t('home.todayRoutine') : t('home.dayRoutine')}</h2>
      ${!week.noRoutineReason ? html`<p class="muted">${t('home.summary', { am: day.am.length, pm: day.pm.length })}${day.maskDay ? html` · ${t('home.maskDay')}` : ''}</p>` : ''}
    </section>`;

  if (week.noRoutineReason === 'no_products') {
    return html`${header}${emptyState({
      iconName: 'box',
      title: t('home.emptyTitle'),
      text: t('home.emptyText'),
      actions: html`<a class="btn btn-primary" href="#/add">${icon('plus')} ${t('home.addFirst')}</a><button type="button" class="btn btn-ghost" data-action="demo">${t('home.loadDemo')}</button>`,
    })}`;
  }

  const total = s.products.filter((p) => !p.archived).length;
  const ready = total - week.excluded.length;

  if (week.noRoutineReason === 'none_eligible') {
    return html`${header}
      <section class="card">
        <h3 class="card-title">${t('home.verifyTitle')} ${info(t('home.verifyInfo'))}</h3>
        <p class="muted">${t('home.verifyText')}</p>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${ready}" aria-label="${t('home.verifyProgress', { done: ready, total })}"><span style="width:${total ? (ready / total) * 100 : 0}%"></span></div>
        <p class="small muted">${t('home.verifyProgress', { done: ready, total })}</p>
        ${needsCheckList(week.excluded)}
      </section>
      <p class="disclaimer">${t('home.disclaimer')}</p>`;
  }

  const report = dayReport(day, s.products, s.profile);
  const maskProduct = day.maskProductId ? byId.get(day.maskProductId) : null;
  const maskDone = maskProduct && maskUsedOn(s, date);
  const stepWarnings = [...day.am, ...day.pm]
    .filter((st, i, arr) => st.warnings.length && arr.findIndex((x) => x.productId === st.productId) === i)
    .map((st) => ({ product: byId.get(st.productId), warnings: st.warnings }));

  return html`${header}
    ${week.excluded.length ? html`<a class="notice notice-check link-notice" href="#needs-check">${icon('alert')}<span>${t('home.someExcluded', { n: week.excluded.length })}</span></a>` : ''}

    <section class="card routine-card" aria-labelledby="am-title">
      <h3 class="card-title" id="am-title">${icon('sun', 'accent')} ${t('routine.am')}</h3>
      ${stepList(day.am, 'am', byId)}
    </section>

    <section class="card routine-card" aria-labelledby="pm-title">
      <h3 class="card-title" id="pm-title">${icon('moon', 'accent')} ${t('routine.pm')}</h3>
      ${day.maskDay ? html`
        <div class="mask-banner">
          ${icon('mask')}
          <div>
            <p><strong>${t('home.maskDay')}</strong> ${maskProduct ? html`· ${productName(maskProduct)}` : html`· ${t('masks.outOfStock')}`}</p>
            ${maskProduct && !maskDone && date <= ctx.today ? html`<button type="button" class="btn btn-primary btn-sm" data-action="mask-done" data-id="${maskProduct.id}">${icon('check')} ${t('masks.done')}</button>` : ''}
            ${maskDone ? html`<span class="chip chip-ok">${t('masks.doneLabel')}</span>` : ''}
            <a class="small" href="#/masks">${t('masks.change')}</a>
          </div>
        </div>` : ''}
      ${stepList(day.pm, 'pm', byId)}
    </section>

    <section class="card" aria-labelledby="r1">
      <h3 class="card-title" id="r1">${t('report.today')}</h3>
      <ul class="pill-list">${report.today.map((p) => html`<li><a href="#/product/${p.id}"><span class="muted small">${catLabel(p.category)}</span> ${productName(p)}</a></li>`)}</ul>
    </section>

    <section class="card" aria-labelledby="r2">
      <h3 class="card-title" id="r2">${t('report.combos')} ${info(t('report.combosInfo'))}</h3>
      <h4 class="sub">${t('routine.am')}</h4>
      ${comboList(report.combos.am, byId)}
      <h4 class="sub">${t('routine.pm')}</h4>
      ${comboList(report.combos.pm, byId)}
      ${considerList(report.considers, byId)}
      <p class="notice notice-caution small">${t('report.stopIfIrritation')}</p>
    </section>

    <section class="card" aria-labelledby="r3">
      <h3 class="card-title" id="r3">${t('report.similar')} ${info(t('report.similarInfo'))}</h3>
      ${similarList(report.similar)}
    </section>

    <section class="card" aria-labelledby="needs-check">
      <h3 class="card-title" id="needs-check" tabindex="-1">${t('report.needsCheck')}</h3>
      ${needsCheckList(week.excluded, stepWarnings)}
    </section>

    <p class="disclaimer">${t('home.disclaimer')}</p>`;
}

export function mount(root, ctx) {
  root.querySelector('main').addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'demo') loadDemo(ctx.state.settings.region);
    if (action === 'move') {
      const date = ctx.params.date || ctx.today;
      const day = computeWeek(ctx.state, date, ctx.today).days.find((d) => d.date === date);
      update((s) => applyMove(s, day[el.dataset.slot], el.dataset.id, Number(el.dataset.dir)));
    }
    if (action === 'mask-done') useMask(el.dataset.id, ctx.params.date || ctx.today);
  });
}
