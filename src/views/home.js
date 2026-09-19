/** Pantalla de inicio: buscador, favoritos y rejilla de herramientas. */
import { h, clear } from '../ui/dom.js';
import { icon, starFilled } from '../ui/icons.js';
import { iconButton, emptyState, button } from '../ui/components.js';
import { t, tn } from '../core/i18n.js';
import * as registry from '../core/registry.js';
import { navigate } from '../core/router.js';
import { toast } from '../ui/toast.js';
import { on } from '../core/events.js';

/** Normaliza para buscar sin tildes ni mayusculas. */
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let query = '';

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

export default function home({ outlet }) {
  const results = h('div.stack');

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

  function paint() {
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

    const q = norm(query.trim());
    if (q) {
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
    const favs = visible.filter(tool => favIds.includes(tool.id));
    if (favs.length) results.appendChild(section('home.favorites', favs));
    results.appendChild(section('home.all', visible.filter(tool => !favIds.includes(tool.id)), { count: true }));
  }

  outlet.appendChild(h('div.page',
    h('header.page__header',
      h('h1.page__title', { text: t('home.title') }),
      h('p.page__lead', { text: t('app.tagline') })
    ),
    h('div.home__search', h('div.search', searchIcon, input, clearBtn)),
    results
  ));

  paint();

  const offFav = on('favorites:change', paint);
  const offTools = on('tools:change', paint);
  const offLang = on('i18n:change', () => {
    input.placeholder = t('home.searchPlaceholder');
    input.setAttribute('aria-label', t('home.searchLabel'));
    paint();
  });

  return () => { offFav(); offTools(); offLang(); };
}
