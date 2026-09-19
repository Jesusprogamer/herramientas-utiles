/** Paginas informativas: privacidad, licencias, no encontrada y "proximamente". */
import { h } from '../ui/dom.js';
import { button, notice, emptyState } from '../ui/components.js';
import { t, section } from '../core/i18n.js';
import { navigate } from '../core/router.js';
import * as registry from '../core/registry.js';
import { LIBRARIES } from '../core/licenses.js';

/** Las listas de la pagina de privacidad vienen como array en los JSON. */
function bulletBlock(path) {
  const block = section(path) || {};
  const items = Array.isArray(block.items) ? block.items : [];
  return h('section.stack',
    h('h2', { text: block.title || path }),
    h('ul', items.map(text => h('li', { text })))
  );
}

export function privacy({ outlet }) {
  outlet.appendChild(h('div.page',
    h('header.page__header',
      h('h1.page__title', { text: t('privacy.title') }),
      h('p.page__lead', { text: t('privacy.lead') })
    ),
    h('div.prose',
      bulletBlock('privacy.local'),
      bulletBlock('privacy.none'),
      bulletBlock('privacy.account'),
      bulletBlock('privacy.network'),
      bulletBlock('privacy.control'),
      h('p.muted.small', { text: t('privacy.contact') })
    )
  ));
}

export function licenses({ outlet }) {
  const list = LIBRARIES.length
    ? h('div.stack', LIBRARIES.map(lib => h('section.card', h('div.card__body.stack',
        h('h2.card__title', { text: `${lib.name} ${lib.version}` }),
        h('p.muted.small', { text: t(lib.useKey) }),
        h('div.kv',
          h('div.kv__row', h('span.kv__key', { text: t('licenses.license') }), h('span.kv__val', { text: lib.license })),
          h('div.kv__row', h('span.kv__key', { text: t('licenses.author') }), h('span.kv__val', { text: lib.author }))
        ),
        h('div.row',
          h('a.btn.btn--sm', { href: lib.path, target: '_blank', rel: 'noopener', text: t('licenses.readFull') }),
          h('a.btn.btn--sm.btn--ghost', { href: lib.url, target: '_blank', rel: 'noopener noreferrer', text: t('licenses.project') })
        )
      ))))
    : notice(t('licenses.empty'), { kind: 'info' });

  outlet.appendChild(h('div.page',
    h('header.page__header',
      h('h1.page__title', { text: t('licenses.title') }),
      h('p.page__lead', { text: t('licenses.lead') })
    ),
    h('div.prose',
      list,
      h('p.small.faint', { text: t('licenses.ownCode') })
    )
  ));
}

export function notFound({ outlet }) {
  outlet.appendChild(h('div.page',
    emptyState({
      iconName: 'search',
      title: t('notfound.title'),
      message: t('notfound.message'),
      action: button(t('notfound.action'), { variant: 'primary', onClick: () => navigate('/') })
    })
  ));
}

/** Herramienta declarada pero todavia no implementada. */
export function toolPlaceholder({ outlet, params }) {
  const tool = registry.byId(params.id);
  if (!tool) return notFound({ outlet });
  outlet.appendChild(h('div.page',
    h('header.page__header',
      h('h1.page__title', { text: t(`tools.${tool.id}.name`) }),
      h('p.page__lead', { text: t(`tools.${tool.id}.desc`) })
    ),
    emptyState({
      iconName: tool.icon,
      title: t('tool.soon.title'),
      message: t('tool.soon.message'),
      action: button(t('tool.soon.back'), { variant: 'primary', icon: 'arrowLeft', onClick: () => navigate('/') })
    })
  ));
}
