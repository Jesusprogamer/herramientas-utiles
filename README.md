# A mano

Aplicación web instalable (PWA) con herramientas útiles para el día a día.
HTML, CSS y JavaScript puro con módulos ES: **sin frameworks y sin paso de compilación**.
Los archivos del repositorio son exactamente los que se publican.

- 12 herramientas, todas funcionando sin conexión.
- Tema oscuro por defecto, con tema claro y opción «Sistema».
- Español e inglés, con cambio en directo.
- Sin analítica ni seguimiento. Sin cuenta, nada sale del dispositivo.
- Cuenta opcional (Supabase) para usar los mismos datos en el móvil y en el PC.

## Herramientas

| Herramienta | Qué hace |
|---|---|
| Temporizador | Cuenta atrás y pomodoro. Sigue contando al cambiar de pantalla y avisa con sonido, vibración o notificación. |
| Tareas y notas | Tres pestañas: tareas (con fecha límite, filtros y reordenar), lista de la compra (cantidad, categoría, autocompletado) y notas con guardado automático. |
| Conversor de unidades | 10 magnitudes y 80 unidades, con tabla de equivalencias. |
| Contraseñas | Longitud, tipos de caracteres, sin caracteres confusos y medidor de entropía. |
| Contador de texto | Palabras, caracteres, frases, párrafos, tiempo de lectura y palabras repetidas. |
| Porcentajes | Siete cálculos: porcentajes, descuentos, subidas, variación e IVA. |
| Conversor de monedas | Cualquier par de monedas, tasa guardada para uso sin conexión y tipo de cambio manual. |
| Zonas horarias | Relojes en vivo de varias ciudades y convertidor de horas. Solo con `Intl`. |
| Elegir al azar | Moneda, dados, ruleta en canvas y números aleatorios. |
| Códigos QR | Texto, enlaces y wifi. Descarga en PNG. Se genera en el dispositivo. |
| Selector de colores | HEX/RGB/HSL sincronizados, tonos, colores guardados y contraste WCAG. |
| Sorteo de equipos | Reparto aleatorio y equilibrado, nombres de equipo editables. |

Todo lo que necesita azar (contraseñas, dados, ruleta, números, equipos) usa
`crypto.getRandomValues` con muestreo por rechazo, para evitar el sesgo que
introduce el resto de la división.

## Probar en local

No hay dependencias que instalar. Con Node ya instalado:

```bash
npm run serve            # http://localhost:4173
npm test                 # pruebas de los motores de cálculo y de los datos
npm run check-locales    # comprueba que todos los idiomas cuadran
npm run icons            # regenera los iconos (solo si cambias el diseño)
```

Se necesita un servidor (no vale abrir `index.html` con doble clic) porque la
app usa módulos ES y un service worker.

`package.json` no tiene dependencias: solo declara módulos ES y estos atajos.
`npm run icons` sí necesita Playwright, pero los iconos ya están en el
repositorio, así que no hace falta salvo que cambies el diseño.

**Antes de cada commit** se ejecutan `npm run check-locales` y `npm test`.

## Publicar en GitHub Pages

1. **Settings → Pages** en el repositorio.
2. *Source*: **Deploy from a branch**.
3. *Branch*: la rama de trabajo, carpeta **`/ (root)`**. Guardar.
4. En uno o dos minutos estará en `https://<usuario>.github.io/<repositorio>/`.

El archivo `.nojekyll` evita que GitHub Pages pase el sitio por Jekyll.
Todas las rutas del proyecto son relativas (`./…`), nunca absolutas (`/…`),
para que funcione igual en la raíz de un dominio que en un subdirectorio.

## Estructura

```
index.html                 Punto de entrada, en la raíz.
404.html, offline.html     Páginas autónomas, sin dependencias externas.
manifest.json              Instalación con el acento por defecto.
manifest-<acento>.json     Uno por acento; el JS cambia el <link rel=manifest>.
sw.js                      Service worker: caché con versión y aviso de actualización.
config.js                  Datos de Supabase (vacío = modo invitado).
package.json               Sin dependencias: módulos ES y atajos npm.
assets/icons/<acento>/     Iconos ya renderizados de cada acento (incl. maskable).
styles/
  tokens.css                 variables base (espaciado, tipografía, radios…)
  themes.css                 temas oscuro y claro + 6 acentos
  base.css                   reset, foco visible, reducir movimiento, transiciones
  components.css             botones, tarjetas, campos, interruptores, avisos…
  layout.css                 estructura, rejilla de inicio, ajustes
  tools.css                  estilos de las herramientas (carga diferida)
locales/                   Todo el texto de la interfaz (es.json, en.json).
src/
  main.js                    arranque, rutas y barra superior
  core/
    accents.js                 degradados de la marca (fuente única)
    audio.js                   sonidos de la interfaz, sintetizados
    transitions.js             transiciones entre pantallas
    storage.js, settings.js, i18n.js, theme.js, registry.js, router.js,
    events.js, pwa.js, random.js, account.js, licenses.js, version.js
  ui/                        dom, iconos, componentes, avisos, diálogos
  views/                     inicio, ajustes, páginas informativas
  tools/<id>/index.js        una carpeta por herramienta
  standalone.js              textos de 404.html y offline.html
vendor/                    Librerías de terceros, con su licencia.
tests/                     Pruebas con `node --test`, sin dependencias.
scripts/
  serve.js                   servidor estático de pruebas
  check-locales.js           compara las claves de todos los idiomas
  build-icons.js             genera los iconos y manifest de cada acento
```

## Dónde se cambian las cosas

**El nombre de la app** vive en dos sitios y en ninguno más:

- `locales/es.json` y `locales/en.json` → `app.name` y `app.short`
- `manifest.json` → `name` y `short_name`

El `<title>` del HTML está vacío a propósito: lo rellena `i18n` al arrancar.

**La versión** está en `src/core/version.js` y en `APP_VERSION` de `sw.js`
(hay que subir las dos: al cambiar la de `sw.js` se invalida la caché y
aparece el aviso «Hay una actualización disponible»).

## Añadir una herramienta

1. Crear `src/tools/<id>/index.js`:

   ```js
   export default {
     id: '<id>',
     mount(contenedor, ctx) { /* pinta la herramienta */ },
     unmount() { /* limpia intervalos y listeners */ }
   };
   ```

2. Añadir la entrada en `src/core/registry.js` (`TOOLS`), con su `category`
   (una de `CATEGORIES`) y `ready: true`.
3. Añadir `tools.<id>.name` y `tools.<id>.desc` a **todos** los archivos de `locales/`.
4. Añadir el archivo nuevo a la lista `PRECACHE` de `sw.js` y subir la versión.
   Hay una prueba que falla si se olvida: sin eso la herramienta no funciona
   sin conexión.
5. Si hay que sincronizar sus datos, añadir su clave a `SYNC_KEYS` en `src/core/account.js`.
6. Ejecutar `npm run check-locales` y `npm test`.

Las herramientas con `ready: false` salen en el inicio con la etiqueta
«Próximamente» y abren una pantalla explicativa.

## Añadir un idioma

1. Copiar `locales/es.json` a `locales/<código>.json` y traducirlo.
2. Añadir el código a `AVAILABLE` en `src/core/i18n.js`.
3. Añadir el archivo a `PRECACHE` en `sw.js`.
4. Ejecutar `npm run check-locales`, que falla si falta alguna clave, si
   sobra, si cambia la forma o si se pierde un marcador como `{name}`.

No hay texto fijo en el HTML ni en el JS: todo sale de esos archivos.
El **español es el idioma de respaldo**: si a otro le falta una clave, se
muestra en español en lugar de enseñar la clave cruda.

## Almacenamiento

Un único módulo (`src/core/storage.js`). Claves con prefijo y versión
(`amano:v1:<nombre>`), migraciones al arrancar y todas las lecturas y
escrituras envueltas en `try/catch`: si el navegador bloquea el
almacenamiento, la app sigue funcionando en memoria y avisa en Ajustes.

---

# Cuenta y sincronización

Es **opcional**: mientras `config.js` esté vacío, la app funciona en modo
invitado y no se envía nada a ningún sitio.

## Lo que tienes que hacer tú (una sola vez)

### 1. Crear el proyecto en Supabase

1. Entra en <https://supabase.com> y crea una cuenta gratuita.
2. **New project**. Elige un nombre, una contraseña de base de datos (guárdala)
   y la región más cercana. Tarda un par de minutos en crearse.

### 2. Crear la tabla y las políticas de seguridad

En el panel de Supabase abre **SQL Editor → New query**, pega esto tal cual y
pulsa **Run**:

```sql
-- Tabla donde se guardan los datos sincronizados.
-- Una fila por usuario y clave; el valor es JSON.
create table if not exists public.user_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Row Level Security: sin esto, cualquiera con la clave pública podría
-- leer las filas de los demás.
alter table public.user_data enable row level security;

-- Cada usuario solo ve y toca SUS filas.
drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_data_delete_own" on public.user_data;
create policy "user_data_delete_own" on public.user_data
  for delete using (auth.uid() = user_id);
```

### 3. Comprobar que la seguridad está puesta

Pega esta consulta en el SQL Editor y pulsa **Run**:

```sql
select
  c.relname                                   as tabla,
  c.relrowsecurity                            as rls_activado,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'user_data') as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'user_data';
```

Tiene que devolver `rls_activado = true` y `politicas = 4`.
Si `rls_activado` sale `false`, **no sigas**: vuelve al paso 2.

### 4. Decirle a Supabase cuál es la dirección de la app

**Authentication → URL Configuration**:

- *Site URL*: `https://<usuario>.github.io/<repositorio>/`
- *Redirect URLs*: añade esa misma dirección (y `http://localhost:4173/` si
  vas a probar en local).

Sin esto, los enlaces de los correos de confirmación y de recuperación de
contraseña no vuelven a la app.

### 5. Pegar las dos claves en la app

**Project Settings → API**. Copia:

- *Project URL* → `SUPABASE_URL`
- *anon public* → `SUPABASE_ANON_KEY`

y pégalas en `config.js`:

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi…';
```

La clave *anon public* **está pensada para publicarse**: es la que usan las
webs, y lo que protege los datos es RLS. La que **nunca** debe salir de
Supabase es la *service_role*.

Sube el cambio y listo: en Ajustes → Cuenta aparecerá el formulario.

## Qué se sincroniza

Ajustes, favoritos, orden de herramientas, tareas, lista de la compra (y su
autocompletado), notas, zonas horarias guardadas, opciones de la ruleta,
preferencias de monedas, colores guardados y nombres del sorteo de equipos.

El resto (texto del contador, estado del temporizador, contador de la moneda)
se queda en el dispositivo a propósito.

## Cómo funciona

- **Primero local.** Todo se guarda en el dispositivo al instante; la subida va
  detrás y nunca bloquea la interfaz.
- **Sin conexión** se sigue trabajando con normalidad; los cambios se envían
  cuando vuelve la conexión.
- **Conflictos:** gana el cambio más reciente según `updated_at`.
- La app **no guarda contraseñas ni tokens**: de la sesión se ocupa la librería
  de Supabase.
- El service worker **nunca** cachea las peticiones a Supabase.

## Borrar datos y borrar la cuenta

- **Ajustes → Cuenta → Borrar mis datos de la nube** borra todas tus filas del
  servidor. Lo del dispositivo no se toca.
- **Borrar el usuario entero** no se puede hacer desde una web estática: la API
  pública no lo permite por seguridad. Tienes dos opciones:
  1. **Manual:** panel de Supabase → *Authentication → Users* → borrar el
     usuario. Al tener `on delete cascade`, sus filas se van con él.
  2. **Automático:** crear una *Edge Function* en Supabase que use la clave
     `service_role` (que vive en el servidor, nunca en el navegador) y llame a
     `auth.admin.deleteUser()`. Si lo quieres, dímelo y te la preparo.

## Inicio de sesión con Google

No está incluido porque necesita configuración fuera de este repositorio y no
aporta nada que el correo y la contraseña no den ya. Si lo quieres, los pasos
serían: crear un proyecto en Google Cloud, configurar la pantalla de
consentimiento OAuth, crear credenciales *OAuth client ID* de tipo aplicación
web con el *redirect URI* que indica Supabase, y pegar el ID y el secreto en
**Authentication → Providers → Google**. En el código sería añadir un botón que
llame a `signInWithOAuth({ provider: 'google' })`. Dímelo y lo añado.

## El icono y el color de acento

Los dos tonos del degradado de cada acento viven **solo** en
`src/core/accents.js`. De ahí salen el logo de la cabecera, la pantalla de
carga, «Acerca de», el favicon, el apple-touch-icon y los iconos de
instalación que genera `npm run icons`.

Al cambiar de acento se actualizan el favicon, el apple-touch-icon y el
`<link rel="manifest">`. **El icono de una app ya instalada lo fija el
sistema al instalarla:** en Android puede tardar en actualizarse y en iPhone
no se actualiza nunca. Para verlo cambiar hay que reinstalar la app.

Los tonos no se eligen a ojo: el símbolo es blanco, así que ambos extremos
del degradado deben quedar como mínimo a 3:1 de contraste con el blanco, o a
tamaño de favicon el símbolo se pierde. Hay una prueba que lo comprueba.

## Sonido

`src/core/audio.js` sintetiza todos los avisos con la Web Audio API: no hay
ni un archivo de audio. Un solo `AudioContext`, creado tras el primer gesto,
límite de voces simultáneas y silencio total si la pestaña está oculta.
El sonido **nunca es la única señal**: siempre acompaña a algo visible.

## Accesibilidad

Navegación completa con teclado, foco visible, etiquetas aria, contraste AA
comprobado en los dos temas y en los seis acentos, y respeto a
«reducir movimiento» tanto del sistema como del ajuste propio, que además
desactiva las transiciones entre pantallas.
