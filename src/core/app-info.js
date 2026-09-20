/**
 * Identidad de la app en un solo sitio.
 *
 * El nombre visible NO esta aqui: vive en los archivos de idioma
 * (`app.name`), como el resto de los textos. Aqui solo lo que no se
 * traduce: la version, el repositorio y las direcciones que salen de el.
 */
import { APP_VERSION } from './version.js';

export const VERSION = APP_VERSION;
export const REPO = 'jesusprogamer/herramientas-utiles';
export const REPO_URL = `https://github.com/${REPO}`;

export const ISSUES_URL = `${REPO_URL}/issues`;
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new`;

/** Tope de la URL: por encima, los navegadores y GitHub empiezan a cortarla. */
export const MAX_URL = 6000;

/**
 * Direccion para abrir un aviso nuevo ya relleno.
 * Si se pasa de largo, se recorta el cuerpo y se avisa de ello.
 */
export function issueUrl({ title, body, labels = [] }) {
  const construir = cuerpo => {
    const params = new URLSearchParams({ title, body: cuerpo });
    if (labels.length) params.set('labels', labels.join(','));
    return `${NEW_ISSUE_URL}?${params}`;
  };

  let url = construir(body);
  if (url.length <= MAX_URL) return { url, recortado: false };

  // Se va quitando cuerpo hasta que quepa; lo primero que sobra es el final.
  let cuerpo = body;
  while (cuerpo.length > 200 && construir(cuerpo).length > MAX_URL) {
    cuerpo = cuerpo.slice(0, Math.floor(cuerpo.length * 0.8));
  }
  url = construir(`${cuerpo}\n\n…`);
  return { url, recortado: true };
}
