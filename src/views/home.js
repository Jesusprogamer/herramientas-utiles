/** Pantalla de inicio: buscador, favoritos y rejilla de herramientas. */
import { h, clear } from '../ui/dom.js';
import { icon, starFilled } from '../ui/icons.js';
import { iconButton, emptyState, button, segmented } from '../ui/components.js';
import { t, tn } from '../core/i18n.js';
import * as registry from '../core/registry.js';
import { navigate } from '../core/router.js';
import { toast } from '../ui/toast.js';
import { on } from '../core/events.js';
import * as widgetRegistry from '../core/widgets.js';

/** Normaliza para buscar sin tildes ni mayusculas. */
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let query = '';
let category = 'todas';   // se conserva al ir y volver, se reinicia al recargar

function toolCard(tool) {
  const name = t(`tools.${tool.id}.name`);
  const desc = t(`tools.${tool.id}.desc`);
  const fav = registry.isFavorite(tool.id);

  const star = iconButton('star', fav ? t('home.removeFavorite', { name }) : t('home.addFavorite', { name }), {
    pressed: fav,
    class: 'tool-card__star',
    onClick: e => {
      e.preventDefault();
      e.stopPropagation();
      const now = registry.toggleFavorite(tool.id);
      toast(t(now ? 'home.favoriteAdded' : 'home.favoriteRemoved', { name }));
    }
  });
  if (fav) { clear(star); star.appendChild(starFilled()); }

  const card = h(`article.tool-card${tool.ready ? '' : '.tool-card--soon'}`,
    h('span.tool-card__icon', icon(tool.icon)),
    h('a.tool-card__link', { href: `#/h/${tool.id}` },
      h('span.tool-card__name', { text: name }),
      h('span.tool-card__desc', { text: desc }),
      tool.ready ? null : h('span.chip.tool-card__badge', { text: t('home.soon') })
    ),
    star
  );
  return card;
}

function grid(tools) {
  return h('div.tool-grid', { role: 'list' },
    tools.map(tool => h('div', { role: 'listitem' }, toolCard(tool)))
  );
}

function section(titleKey, tools, { count = false } = {}) {
  return h('section',
    h('div.section__head',
      h('h2.section__title', { text: t(titleKey) }),
      count ? h('span.section__count', { text: tn('home.count', tools.length) }) : null
    ),
    grid(tools)
  );
}

export default async function home({ outlet }) {
  const results = h('div.stack');
  /* Recuadro de la agenda: se carga aparte para no pesar en el arranque y
     desaparece solo cuando no hay ningun examen proximo. */
  const widgets = h('div.stack');
  /* Se les reserva lo que ocuparon la ultima vez para que, al llegar, no
     empujen hacia abajo la lista de herramientas. */
  const altoReservado = widgetRegistry.altoRecordado();
  if (altoReservado) widgets.style.minHeight = `${altoReservado}px`;

  /* Cada recuadro se carga solo si esta activado, y guarda su propia
     limpieza por si necesita apagar un reloj o un suscriptor. */
  let limpiezas = [];
  let pintando = 0;

  async function pintarWidgets() {
    const turno = ++pintando;
    for (const fn of limpiezas) { try { fn(); } catch { /* da igual */ } }
    limpiezas = [];

    const activos = widgetRegistry.activos();
    const cajas = await Promise.all(activos.map(async w => {
      try {
        const mod = await import(`../tools/${w.tool}/widget.js`);
        return mod.default?.() || null;
      } catch (err) {
        console.warn(`[inicio] el recuadro "${w.id}" no se ha podido cargar`, err);
        return null;
      }
    }));

    // Si ha entrado otro repintado mientras cargabamos, este ya no vale.
    if (turno !== pintando) {
      for (const c of cajas) { try { c?.cleanup?.(); } catch { /* da igual */ } }
      return;
    }

    clear(widgets);
    for (const c of cajas) {
      if (!c) continue;
      widgets.appendChild(c);
      if (typeof c.cleanup === 'function') limpiezas.push(c.cleanup);
    }

    // El sitio reservado ya no hace falta: lo ocupa el contenido de verdad.
    widgets.style.minHeight = '';
    widgetRegistry.recordarAlto(widgets.offsetHeight);
  }

  const input = h('input.input', {
    type: 'search',
    id: 'home-search',
    value: query,
    placeholder: t('home.searchPlaceholder'),
    'aria-label': t('home.searchLabel'),
    autocomplete: 'off',
    onInput: e => { query = e.target.value; paint(); }
  });

  const clearBtn = iconButton('x', t('home.clearSearch'), {
    class: 'search__clear',
    onClick: () => { query = ''; input.value = ''; paint(); input.focus(); }
  });

  const searchIcon = icon('search');
  searchIcon.classList.add('search__icon');

  /* Chips de categoria: solo aparecen las que tienen alguna herramienta. */
  function buildChips(visible) {
    const counts = new Map();
    for (const tool of visible) counts.set(tool.category, (counts.get(tool.category) || 0) + 1);

    const options = [{ value: 'todas', label: `${t('categories.all')} · ${visible.length}` }];
    for (const id of registry.CATEGORIES) {
      if (!counts.has(id)) continue;
      options.push({ value: id, label: `${t(`categories.${id}`)} · ${counts.get(id)}` });
    }
    if (options.length <= 2) return null;        // una sola categoria: no aporta nada

    if (!counts.has(category)) category = 'todas';
    const group = segmented({
      label: t('categories.filterLabel'),
      value: category,
      options,
      onChange: value => { category = value; paint(); }
    });
    group.classList.add('segmented--chips');
    return group;
  }

  function paint() {
    // Al repintar se destruyen los chips. Si uno tenia el foco (teclado),
    // hay que devolverselo al equivalente o el foco se cae al body.
    const chipsHadFocus = Boolean(document.activeElement?.closest?.('.segmented--chips'));

    clear(results);
    clearBtn.hidden = !query;

    const visible = registry.list();
    if (!visible.length) {
      results.appendChild(emptyState({
        iconName: 'eyeOff',
        title: t('home.allHidden.title'),
        message: t('home.allHidden.message'),
        action: button(t('home.allHidden.action'), { variant: 'primary', onClick: () => navigate('/ajustes') })
      }));
      return;
    }

    const chips = buildChips(visible);
    if (chips) {
      results.appendChild(chips);
      if (chipsHadFocus) chips.querySelector('[aria-checked="true"]')?.focus();
    }

    const inCategory = category === 'todas'
      ? visible
      : visible.filter(tool => tool.category === category);

    const q = norm(query.trim());
    if (q) {
      // El buscador manda: busca en todas las herramientas visibles, no solo
      // en la categoria elegida, para que nadie "pierda" un resultado.
      const found = visible.filter(tool =>
        norm(t(`tools.${tool.id}.name`)).includes(q) || norm(t(`tools.${tool.id}.desc`)).includes(q)
      );
      if (!found.length) {
        results.appendChild(emptyState({
          iconName: 'search',
          title: t('home.noResults.title'),
          message: t('home.noResults.message', { q: query.trim() }),
          action: button(t('home.noResults.action'), { onClick: () => { query = ''; input.value = ''; paint(); input.focus(); } })
        }));
      } else {
        results.appendChild(section('home.results', found, { count: true }));
      }
      return;
    }

    const favIds = registry.favoriteIds();
    const favs = inCategory.filter(tool => favIds.includes(tool.id));
    const rest = inCategory.filter(tool => !favIds.includes(tool.id));

    if (favs.length) results.appendChild(section('home.favorites', favs));
    if (rest.length) {
      results.appendChild(section(
        category === 'todas' ? 'home.all' : `categories.${category}`,
        rest,
        { count: true }
      ));
    } else if (!favs.length) {
      results.appendChild(emptyState({
        iconName: 'package',
        title: t('categories.empty.title'),
        message: t('categories.empty.message'),
        action: button(t('categories.empty.action'), { onClick: () => { category = 'todas'; paint(); } })
      }));
    }
  }

  outlet.appendChild(h('div.page',
    h('header.page__header',
      h('h1.page__title', { text: t('home.title') }),
      h('p.page__lead', { text: t('app.tagline') })
    ),
    h('div.home__search', h('div.search', searchIcon, input, clearBtn)),
    widgets,
    results
  ));

  paint();
  /* Los recuadros se piden antes de enseñar la pantalla: son modulos
     pequeños y ya precacheados, y asi entran de una vez en su sitio en vez
     de aparecer luego empujando la lista de herramientas hacia abajo. Si
     tardan demasiado se sigue adelante y llegaran cuando lleguen: para eso
     esta el sitio reservado. */
  await Promise.race([pintarWidgets(), new Promise(r => setTimeout(r, 1200))]);

  const offFav = on('favorites:change', paint);
  const offTools = on('tools:change', paint);
  const offLang = on('i18n:change', () => {
    input.placeholder = t('home.searchPlaceholder');
    input.setAttribute('aria-label', t('home.searchLabel'));
    paint();
    pintarWidgets();
  });
  const offAsig = on('asignaturas:change', pintarWidgets);
  const offWidgets = on('widgets:change', pintarWidgets);
  const offStorage = on('storage:write', ({ name }) => {
    // Un cambio en los datos que enseña un recuadro lo repinta.
    if (['tareas', 'agenda', 'horario', 'zonas-horarias'].includes(name)) pintarWidgets();
  });
  // Y un refresco por minuto: el horario y las horas cambian solos.
  const reloj = setInterval(pintarWidgets, 60 * 1000);

  return () => {
    offFav(); offTools(); offLang(); offAsig(); offWidgets(); offStorage();
    clearInterval(reloj);
    for (const fn of limpiezas) { try { fn(); } catch { /* da igual */ } }
    limpiezas = [];
  };
}
