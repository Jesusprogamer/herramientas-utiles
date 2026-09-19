# A mano

Aplicación web instalable (PWA) con herramientas útiles para el día a día.
HTML, CSS y JavaScript puro con módulos ES: **sin frameworks y sin paso de compilación**.
Los archivos que hay en el repositorio son exactamente los que se publican.

- Funciona sin conexión una vez abierta la primera vez.
- Tema oscuro por defecto, con tema claro y opción «Sistema».
- Español e inglés, con cambio en directo.
- Todos los datos se guardan en el dispositivo. No hay analítica ni seguimiento.

## Estado

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Base: diseño, tema, idiomas, ajustes, almacenamiento, PWA, inicio | Terminada |
| 2 | Las 12 herramientas | Pendiente |
| 3 | Cuenta y sincronización (Supabase) | Pendiente |

## Probar en local

No hace falta instalar nada. Con Node ya instalado:

```bash
node scripts/serve.js        # http://localhost:4173
```

Se necesita un servidor (no vale abrir `index.html` con doble clic) porque la app
usa módulos ES y un service worker.

## Estructura

```
index.html              Punto de entrada. En la raíz, para GitHub Pages.
404.html, offline.html  Páginas autónomas (sin dependencias externas).
manifest.json           Datos de instalación.
sw.js                   Service worker: caché con versión y aviso de actualización.
assets/icons/           Iconos, incluidos los "maskable".
styles/                 Sistema de diseño:
  tokens.css              variables base (espaciado, tipografía, radios…)
  themes.css              temas oscuro y claro + 6 acentos
  base.css                reset, foco visible, reducir movimiento
  components.css          botones, tarjetas, campos, interruptores, avisos…
  layout.css              estructura, rejilla de inicio, ajustes
locales/                 Todo el texto de la interfaz (es.json, en.json).
src/
  main.js                 arranque, rutas y barra superior
  core/                   almacenamiento, ajustes, idiomas, tema, registro,
                          enrutador, eventos, PWA, versión
  ui/                     dom, iconos, componentes, avisos, diálogos
  views/                  inicio, ajustes, páginas informativas
  tools/<id>/index.js     una carpeta por herramienta
  standalone.js           textos de 404.html y offline.html
scripts/serve.js         servidor estático de pruebas
```

### Rutas relativas

Todo el proyecto usa rutas relativas (`./…`), nunca rutas que empiecen por `/`,
para que funcione igual en la raíz de un dominio que en
`https://usuario.github.io/repositorio/`.

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

2. Añadir la entrada en `src/core/registry.js` (`TOOLS`), con `ready: true`.
3. Añadir `tools.<id>.name` y `tools.<id>.desc` a **todos** los archivos de `locales/`.
4. Añadir los archivos nuevos a la lista `PRECACHE` de `sw.js` y subir la versión.

Las herramientas con `ready: false` salen en el inicio con la etiqueta
«Próximamente» y abren una pantalla explicativa.

## Añadir un idioma

1. Copiar `locales/es.json` a `locales/<código>.json` y traducirlo.
2. Añadir el código a `AVAILABLE` en `src/core/i18n.js`.
3. Añadir el archivo a `PRECACHE` en `sw.js`.

No hay texto fijo en el HTML ni en el JS: todo sale de esos archivos.

## Almacenamiento

Un único módulo (`src/core/storage.js`). Claves con prefijo y versión
(`amano:v1:<nombre>`), migraciones al arrancar y todas las lecturas y
escrituras envueltas en `try/catch`: si el navegador bloquea el
almacenamiento, la app sigue funcionando en memoria y avisa en Ajustes.

## Accesibilidad

Navegación completa con teclado, foco visible, etiquetas aria, contraste AA
comprobado en los dos temas y en los seis acentos, y respeto a
«reducir movimiento» tanto del sistema como del ajuste propio.
