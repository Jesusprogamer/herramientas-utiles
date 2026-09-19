/**
 * Sorteo de equipos.
 *
 * El reparto usa una mezcla Fisher-Yates alimentada por crypto.getRandomValues
 * (src/core/random.js) y luego se van repartiendo uno a uno, asi los equipos
 * quedan equilibrados con diferencia maxima de una persona.
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { button, iconButton, field, select, notice, emptyState, segmented } from '../../ui/components.js';
import { toastOk, toastError, toast } from '../../ui/toast.js';
import { shuffle } from '../../core/random.js';
import * as storage from '../../core/storage.js';
import { t, tn, formatNumber } from '../../core/i18n.js';

const KEY = 'equipos';

/** Reparte por turnos: con 7 personas y 3 equipos salen 3, 2 y 2. */
function split(people, groups) {
  const teams = Array.from({ length: groups }, () => []);
  people.forEach((person, i) => teams[i % groups].push(person));
  return teams;
}

export default {
  id: 'equipos',

  mount(container) {
    const saved = storage.get(KEY, null) || {};
    let names = Array.isArray(saved.names) ? saved.names.filter(n => typeof n === 'string') : [];
    let inactive = new Set(Array.isArray(saved.inactive) ? saved.inactive : []);
    let mode = saved.mode === 'tamano' ? 'tamano' : 'equipos';
    let teamCount = Number.isInteger(saved.teamCount) ? saved.teamCount : 2;
    let teamSize = Number.isInteger(saved.teamSize) ? saved.teamSize : 2;
    let teamNames = {};
    let result = null;

    const persist = () => storage.set(KEY, {
      names, inactive: [...inactive], mode, teamCount, teamSize
    });

    const peopleBox = h('div.people');
    const countLabel = h('p.small.muted', { 'aria-live': 'polite' });
    const resultBox = h('div.stack');

    const textarea = h('textarea.textarea', {
      rows: '6',
      placeholder: t('equipos.namesPlaceholder'),
      'aria-label': t('equipos.namesLabel')
    });
    textarea.value = names.join('\n');

    function readNames() {
      const seen = new Set();
      names = textarea.value.split('\n').map(s => s.trim()).filter(name => {
        if (!name || seen.has(name.toLowerCase())) return false;
        seen.add(name.toLowerCase());
        return true;
      }).slice(0, 200);
      inactive = new Set([...inactive].filter(n => names.includes(n)));
      persist();
      paintPeople();
    }

    const active = () => names.filter(n => !inactive.has(n));

    function paintPeople() {
      clear(peopleBox);
      if (!names.length) {
        peopleBox.appendChild(h('p.small.muted', { text: t('equipos.noNames') }));
      } else {
        for (const name of names) {
          const on = !inactive.has(name);
          const input = h('input', {
            type: 'checkbox', checked: on,
            'aria-label': t('equipos.toggle', { name }),
            onChange: e => {
              if (e.target.checked) inactive.delete(name); else inactive.add(name);
              persist();
              updateCount();
            }
          });
          peopleBox.appendChild(h(`div.person${on ? '' : '.person--off'}`,
            h('label.check', input, icon('check')),
            h('span.person__name', { text: name })
          ));
        }
      }
      updateCount();
    }

    function groupsFor(total) {
      if (mode === 'equipos') return Math.max(1, Math.min(teamCount, total));
      return Math.max(1, Math.ceil(total / Math.max(1, teamSize)));
    }

    function updateCount() {
      const total = active().length;
      const groups = groupsFor(total);
      countLabel.textContent = total
        ? t('equipos.summary', {
            people: tn('equipos.people', total),
            teams: tn('equipos.teams', groups),
            min: formatNumber(Math.floor(total / groups)),
            max: formatNumber(Math.ceil(total / groups))
          })
        : t('equipos.noneActive');
      drawBtn.disabled = total < 2;
    }

    function paintResult() {
      clear(resultBox);
      if (!result) {
        resultBox.appendChild(emptyState({
          iconName: 'users',
          title: t('equipos.empty.title'),
          message: t('equipos.empty.message')
        }));
        return;
      }

      const grid = h('div.teams-grid');
      result.forEach((members, i) => {
        const defaultName = t('equipos.teamName', { n: i + 1 });
        const nameInput = h('input.team__name-input', {
          type: 'text', value: teamNames[i] || defaultName,
          'aria-label': t('equipos.teamNameLabel', { n: i + 1 }),
          onInput: e => { teamNames[i] = e.target.value; }
        });
        grid.appendChild(h('div.team',
          nameInput,
          h('div.team__members', members.map(m => h('span', { text: m })))
        ));
      });

      resultBox.append(grid, h('div.row',
        button(t('equipos.again'), { variant: 'primary', icon: 'refresh', onClick: draw }),
        button(t('equipos.share'), {
          icon: 'upload',
          onClick: async () => {
            const text = result.map((members, i) =>
              `${teamNames[i] || t('equipos.teamName', { n: i + 1 })}:\n${members.map(m => `  · ${m}`).join('\n')}`
            ).join('\n\n');
            if (navigator.share) {
              try { await navigator.share({ title: t('tools.equipos.name'), text }); return; }
              catch { /* cancelado: copiamos */ }
            }
            (await copyText(text)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
          }
        })
      ));
    }

    function draw() {
      const people = active();
      if (people.length < 2) { toast(t('equipos.needTwo'), { kind: 'error' }); return; }
      const groups = groupsFor(people.length);
      result = split(shuffle(people), groups);
      teamNames = {};
      paintResult();
    }

    const drawBtn = button(t('equipos.draw'), { variant: 'primary', icon: 'dice', onClick: draw });

    const countField = field({
      label: t('equipos.teamCount'),
      type: 'number', min: '2', max: '50', value: String(teamCount),
      onInput: e => {
        const n = Number(e.target.value);
        if (!Number.isInteger(n) || n < 2 || n > 50) { countField.setError(t('equipos.countInvalid')); return; }
        countField.setError('');
        teamCount = n; persist(); updateCount();
      }
    });

    const sizeField = field({
      label: t('equipos.teamSize'),
      type: 'number', min: '2', max: '50', value: String(teamSize),
      onInput: e => {
        const n = Number(e.target.value);
        if (!Number.isInteger(n) || n < 2 || n > 50) { sizeField.setError(t('equipos.sizeInvalid')); return; }
        sizeField.setError('');
        teamSize = n; persist(); updateCount();
      }
    });

    function applyMode() {
      countField.hidden = mode !== 'equipos';
      sizeField.hidden = mode !== 'tamano';
      updateCount();
    }

    const modeSwitch = segmented({
      label: t('equipos.modeLabel'),
      value: mode,
      options: [
        { value: 'equipos', label: t('equipos.mode.teams') },
        { value: 'tamano', label: t('equipos.mode.size') }
      ],
      onChange: v => { mode = v; persist(); applyMode(); }
    });

    const pairsBtn = button(t('equipos.pairs'), {
      onClick: () => {
        mode = 'tamano'; teamSize = 2;
        sizeField.input.value = '2';
        modeSwitch.setValue('tamano');
        persist(); applyMode(); draw();
      }
    });

    textarea.addEventListener('input', readNames);

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.equipos.name') }),
        h('p.page__lead', { text: t('tools.equipos.desc') })
      ),
      h('div.stack',
        h('div.field',
          h('label.field__label', { text: t('equipos.namesLabel') }),
          textarea,
          h('p.field__hint', { text: t('equipos.namesHint') })
        ),
        h('div.stack',
          h('span.field__label', { text: t('equipos.whoPlays') }),
          peopleBox
        ),
        modeSwitch,
        countField,
        sizeField,
        countLabel,
        h('div.row', drawBtn, pairsBtn),
        resultBox,
        notice(t('equipos.hint'), { kind: 'info' })
      )
    ));

    readNames();
    applyMode();
    paintResult();
  },

  unmount() {}
};
