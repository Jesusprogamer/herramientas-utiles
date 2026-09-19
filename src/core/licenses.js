/**
 * Librerías de terceros incluidas en el proyecto.
 * El texto completo de cada licencia esta en vendor/<nombre>/LICENSE.
 */
export const LIBRARIES = [
  {
    name: 'qrcode-generator',
    version: '2.0.4',
    license: 'MIT',
    author: 'Kazuhiko Arase',
    url: 'https://github.com/kazuhikoarase/qrcode-generator',
    path: './vendor/qrcode/LICENSE',
    useKey: 'licenses.use.qrcode'
  },
  {
    name: '@supabase/supabase-js',
    version: '2.116.0',
    license: 'MIT',
    author: 'Supabase',
    url: 'https://github.com/supabase/supabase-js',
    path: './vendor/supabase/LICENSE',
    useKey: 'licenses.use.supabase'
  }
];
