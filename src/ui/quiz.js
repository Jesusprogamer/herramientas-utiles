/**
 * Interfaz compartida del modo test.
 *
 * La usan la tabla periodica y el formulario: la logica (generar, comprobar
 * y puntuar) esta en src/lib/quiz/, aqui solo esta la pantalla.
 */
import { h, clear } from './dom.js';
import { button, field } from './components.js';
import { t, formatNumber } from '../core/i18n.js';
import * as audio from '../core/audio.js';
import * as sesionLib from '../lib/quiz/session.js';
import * as check from '../lib/quiz/check.js';

/** Comprueba una respuesta segun la clase de pregunta. */
export function comprobar(pregunta, dada, ajustes = {}) {
  switch (pregunta.clase) {
    case 'numero':
      return check.comprobarNumero(dada, Number(pregunta.respuesta), ajustes.tolerancia);
    case 'config':
      return check.comprobarConfig(dada, pregunta.formas, ajustes.formaConfig);
    case 'valencias':
      return check.comprobarValencias(dada, pregunta.respuesta, ajustes.valencias);
    case 'unidad':
      return check.comprobarUnidad(dada, pregunta.respuesta);
    case 'texto':
    default:
      return check.comprobarTexto(dada, pregunta.aceptadas || [pregunta.respuesta], ajustes.texto);
  }
}

/**
 * La pregunta tal cual se lee: «¿Cuál es el símbolo de Flúor?».
 * Quien genera la pregunta puede traer la frase ya hecha en `pide` cuando
 * no cabe en la plantilla de su tipo (los ejercicios del formulario, que
 * llevan los datos dentro).
 */
export function enunciadoCompleto(pregunta) {
  return pregunta.pide || t(`quiz.pide.${pregunta.tipo}`, { que: pregunta.enunciado });
}

/** Respuesta correcta en texto, para enseñarla al fallar. */
export function respuestaEnTexto(pregunta) {
  if (pregunta.clase === 'valencias') {
    return pregunta.respuesta.map(v => (v > 0 ? `+${v}` : String(v))).join(', ');
  }
  if (pregunta.clase === 'numero') return formatNumber(Number(pregunta.respuesta));
  return String(pregunta.respuesta);
}

/**
 * Monta el test. Devuelve un elemento y una funcion de limpieza.
 *
 * @param preguntas  las ya generadas
 * @param ajustes    { comentario: 'cada'|'final', segundos, tolerancia, ... }
 * @param alTerminar recibe el resultado, para guardarlo en el historial
 * @param alSalir    para volver a la configuracion
 */
export function montarTest(preguntas, ajustes, { alTerminar, alSalir, senuelos = () => [] } = {}) {
  const caja = h('div.stack');
  let sesion = sesionLib.crear(preguntas);
  let cuenta = 0;
  let reloj = 0;

  const limpiar = () => { clearInterval(reloj); reloj = 0; };

  function pintarResultado() {
    limpiar();
    clear(caja);
    const r = sesionLib.resultado(sesion);
    alTerminar?.(r, sesion);

    const barra = h('div.quiz__barra', h('span'));
    barra.firstChild.style.width = `${r.porcentaje}%`;

    caja.append(
      h('h2.quiz__nota', { text: `${r.porcentaje} %` }),
      barra,
      h('p', {
        text: t('quiz.resumen', {
          aciertos: r.aciertos, total: r.total, media: (r.mediaMs / 1000).toFixed(1)
        })
      })
    );

    if (r.listaFallos.length) {
      caja.appendChild(h('h3.form__nombre', { text: t('quiz.tusFallos') }));
      const ul = h('ul.quiz__fallos');
      for (const f of r.listaFallos) {
        ul.appendChild(h('li.quiz__fallo',
          h('p.widget__nombre', { text: enunciadoCompleto(f.pregunta) }),
          h('p.small', {
            class: 'small nc--rojo',
            text: f.saltada ? t('quiz.saltada') : t('quiz.tuRespuesta', { r: f.dada || '—' })
          }),
          h('p.small.nc--verde', { text: t('quiz.correcta', { r: respuestaEnTexto(f.pregunta) }) })
        ));
      }
      caja.appendChild(ul);
      caja.appendChild(h('div.row',
        button(t('quiz.repasarFallos'), {
          variant: 'primary', icon: 'refresh',
          onClick: () => {
            sesion = sesionLib.crear(sesionLib.soloFallos(sesion));
            pintarPregunta();
          }
        }),
        button(t('quiz.salir'), { onClick: () => { limpiar(); alSalir?.(); } })
      ));
    } else {
      caja.appendChild(h('p.nc--verde', { text: t('quiz.perfecto') }));
      caja.appendChild(h('div.row', button(t('quiz.salir'), { variant: 'primary', onClick: () => { limpiar(); alSalir?.(); } })));
    }
  }

  function pintarPregunta() {
    limpiar();
    clear(caja);
    const pregunta = sesionLib.actual(sesion);
    if (!pregunta) { pintarResultado(); return; }

    const n = sesion.indice + 1;
    const total = sesion.preguntas.length;
    const progreso = h('div.quiz__barra', h('span'));
    progreso.firstChild.style.width = `${((n - 1) / total) * 100}%`;
    progreso.setAttribute('role', 'img');
    progreso.setAttribute('aria-label', t('quiz.progreso', { n, total }));

    const comentario = h('p.quiz__comentario', { 'aria-live': 'polite' });
    let respondida = false;

    const terminar = (dada, acierto, saltada = false) => {
      if (respondida) return;
      respondida = true;
      limpiar();
      audio.play(acierto ? 'success' : 'error');

      const pasar = () => {
        sesion = sesionLib.responder(sesion, { dada, acierto, saltada });
        pintarPregunta();
      };

      if (ajustes.comentario === 'cada') {
        // El sonido no es la unica señal: tambien se ve y se lee.
        comentario.textContent = acierto
          ? t('quiz.bien')
          : t('quiz.mal', { r: respuestaEnTexto(pregunta) });
        comentario.className = `quiz__comentario ${acierto ? 'nc--verde' : 'nc--rojo'}`;
        clear(botones);
        const seguir = button(t('quiz.siguiente'), { variant: 'primary', onClick: pasar });
        botones.appendChild(seguir);
        seguir.focus();
      } else {
        pasar();
      }
    };

    const botones = h('div.row');
    let entrada = null;

    if (pregunta.formato === 'opciones') {
      const lista = h('div.quiz__opciones');
      for (const opcion of sesionLib.opciones(pregunta.respuesta, senuelos(pregunta), 4)) {
        lista.appendChild(button(opcion, {
          class: 'btn quiz__opcion',
          onClick: () => terminar(opcion, opcion === String(pregunta.respuesta))
        }));
      }
      caja.append(progreso, h('p.quiz__enunciado', { text: enunciadoCompleto(pregunta) }), lista, comentario, botones);
      lista.querySelector('button')?.focus();
    } else {
      entrada = field({
        label: enunciadoCompleto(pregunta),
        hint: pregunta.clase === 'valencias' ? t('quiz.pistaValencias') : undefined
      });
      entrada.input.setAttribute('autocomplete', 'off');
      entrada.input.setAttribute('autocapitalize', 'off');
      entrada.input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); enviar(); }
      });
      caja.append(progreso, entrada, comentario, botones);
      entrada.input.focus();
    }

    const enviar = () => terminar(entrada.input.value, comprobar(pregunta, entrada.input.value, ajustes));

    if (entrada) botones.appendChild(button(t('quiz.responder'), { variant: 'primary', onClick: enviar }));
    botones.appendChild(button(t('quiz.saltar'), { onClick: () => terminar('', false, true) }));
    botones.appendChild(h('span.grow'));
    botones.appendChild(h('span.small.muted', { text: t('quiz.progreso', { n, total }) }));

    // Tiempo por pregunta, si se ha pedido.
    if (Number.isFinite(ajustes.segundos) && ajustes.segundos > 0) {
      cuenta = ajustes.segundos;
      const marcador = h('span.small.muted.tnum', { 'aria-hidden': 'true' });
      botones.appendChild(marcador);
      const tic = () => {
        marcador.textContent = t('quiz.quedan', { n: cuenta });
        if (cuenta <= 0) { terminar('', false, true); return; }
        cuenta -= 1;
      };
      tic();
      reloj = setInterval(tic, 1000);
    }
  }

  pintarPregunta();
  return { caja, limpiar };
}
