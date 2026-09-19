/**
 * ============================================================
 *  CONFIGURACIÓN DE LA CUENTA (Supabase)
 * ============================================================
 *
 * Aquí y SOLO aquí van los datos de tu proyecto de Supabase.
 *
 * Pega las dos cadenas que te da Supabase en
 *   Project Settings → API:
 *
 *   SUPABASE_URL       -> "Project URL"      (https://xxxxx.supabase.co)
 *   SUPABASE_ANON_KEY  -> "anon public" key
 *
 * ------------------------------------------------------------
 *  IMPORTANTE
 * ------------------------------------------------------------
 *  · La clave "anon public" está PENSADA para publicarse: es la que
 *    usan las webs. Lo que protege tus datos es Row Level Security
 *    (RLS) en la base de datos, no ocultar esta clave.
 *  · NO pongas aquí nunca la clave "service_role" ni ninguna otra
 *    clave secreta: este archivo se publica tal cual en internet.
 *  · Mientras estos valores estén vacíos, la app funciona con normalidad
 *    en modo invitado y la sección Cuenta explica qué falta.
 * ------------------------------------------------------------
 */

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

/** Nombre de la tabla donde se guardan los datos sincronizados. */
export const SUPABASE_TABLE = 'user_data';
