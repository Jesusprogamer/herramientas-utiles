/**
 * Borrar con deshacer, en una sola llamada.
 *
 * Las herramientas no hablan directamente con la papelera: pasan por aqui,
 * que manda lo borrado a la papelera y saca el aviso con «Deshacer».
 */
import { undoToast } from './toast.js';
import { t } from '../core/i18n.js';
import * as trash from '../core/trash.js';

/**
 * @param elementos uno o varios { clave, ruta, pos, tool, tipo, etiqueta, datos }
 * @param onRestore  se llama tras deshacer, para que la vista se repinte
 */
export function borrarConDeshacer(elementos, { onRestore } = {}) {
  const lista = Array.isArray(elementos) ? elementos : [elementos];
  if (!lista.length) return;

  const grupo = trash.enviar(lista);
  const mensaje = lista.length === 1
    ? t('papelera.borrado.uno', { que: lista[0].etiqueta || t(`papelera.tipo.${lista[0].tipo}`) })
    : t('papelera.borrado.varios', { n: lista.length });

  undoToast(mensaje, {
    label: t('papelera.deshacer'),
    onUndo: () => {
      trash.restaurar(grupo);
      onRestore?.();
    }
  });
}
