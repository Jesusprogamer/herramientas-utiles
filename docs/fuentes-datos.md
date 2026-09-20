# Fuentes de los datos de referencia

Este archivo dice de dónde salen los datos que la app muestra como ciertos,
qué licencia tienen y cómo se han comprobado. Si alguno se regenera, hay que
actualizar también esta página.

## Tabla periódica (`src/data/elements.js`)

**Origen principal.** [PubChem Periodic Table of Elements][pubchem], del
National Center for Biotechnology Information (NCBI), National Library of
Medicine, National Institutes of Health (Estados Unidos).

**Licencia.** Los datos de PubChem son de dominio público: como obra del
gobierno federal de los Estados Unidos no están sujetos a derechos de autor
dentro del país. PubChem pide que se cite la fuente, y eso es lo que hace
esta página.

**Cómo se ha traído.** Con el paquete npm [`pubchem-elements`][npm-pubchem]
1.0.0, que reempaqueta esa tabla sin cambiarla (licencia Unlicense, dominio
público). El archivo se genera con `scripts/build-elements.mjs`, que no se
ejecuta en la app: solo se usa a mano cuando hay que regenerar la tabla.

**Segunda fuente para comprobar.** El paquete npm
[`periodic-table`][npm-pt] 0.0.8 de Chris Andrejewski (licencia ISC). Se han
comparado los 118 elementos campo a campo.

### Resultado de la comprobación (118 elementos)

| Campo | Coinciden | Comentario |
|---|---|---|
| Símbolo | 118 / 118 | — |
| Nombre (inglés) | 118 / 118 | — |
| Año de descubrimiento | 118 / 118 | — |
| Configuración electrónica | 107 / 118 | Los 11 restantes son elementos superpesados (Z ≥ 103) cuya configuración es **predicha**, no medida; cada fuente publica una predicción distinta. Los marcamos con `predicha: true`. |
| Masa atómica | 104 / 118 | Ver más abajo. |
| Electronegatividad | 117 / 118 | Ver más abajo. |

Las dos fuentes escriben la configuración en orden distinto (PubChem sigue el
orden de llenado, `[Ar]4s2 3d1`; la otra el orden de capa, `[Ar] 3d1 4s2`).
No es un desacuerdo: al comparar se ordenan los subniveles.

### Diferencias reales y qué hemos hecho

- **Litio (Z = 3).** PubChem redondea la masa a `7`; la otra fuente da
  `6.941(2)`. El valor convencional de la IUPAC (2021) es **6.94**, y es el
  que usamos. Es la única corrección sobre el origen, y está declarada en
  `CORRECCIONES` dentro de `scripts/build-elements.mjs`.
- **Tecnecio (Z = 43) y los 12 elementos con Z ≥ 103.** No tienen isótopos
  estables, así que no existe una «masa atómica» única: PubChem publica la
  masa del isótopo más estable conocido (96,906 para el tecnecio) y la otra
  fuente el número másico entre corchetes (`[98]`). Mantenemos el criterio de
  PubChem en todos ellos para no mezclar convenios.
- **Talio (Z = 81).** PubChem da una electronegatividad de Pauling de 1,62 y
  la otra fuente 2,04. Las dos circulan: 1,62 corresponde al talio(I) y 2,04
  al talio(III). Mantenemos 1,62, que es el valor de PubChem y el que recoge
  el CRC Handbook para el elemento.

### Lo que hemos añadido nosotros

- **Grupo y periodo.** No vienen en el origen; se calculan en
  `scripts/build-elements.mjs` a partir del número atómico, con lantánidos y
  actínidos fuera de la rejilla principal (grupo `null`), como en la tabla
  estándar de la IUPAC.
- **Nombres de los elementos.** Están en `locales/*.json`, bajo
  `elementos.<símbolo>`, como cualquier otro texto de la app. Los nombres en
  español siguen la nomenclatura de la IUPAC adaptada al castellano
  («wolframio» para el W, «azufre», «estaño»…).

### Unidades

masa en u · energía de ionización y afinidad electrónica en eV · radio de
van der Waals en pm · fusión y ebullición en K · densidad en g/cm³.

[pubchem]: https://pubchem.ncbi.nlm.nih.gov/periodic-table/
[npm-pubchem]: https://www.npmjs.com/package/pubchem-elements
[npm-pt]: https://www.npmjs.com/package/periodic-table
