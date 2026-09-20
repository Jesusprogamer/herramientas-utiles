/**
 * Analizador de expresiones matemáticas: tokenizador + árbol de sintaxis.
 *
 * NO se usa eval ni new Function en ningún sitio. Todo lo que se escribe se
 * convierte en un árbol y se evalúa recorriéndolo, así una expresión nunca
 * puede ejecutar código.
 *
 * Módulo puro, sin DOM.
 */

export const FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'sqrt', 'abs', 'log', 'ln', 'exp', 'round', 'floor', 'ceil'];
export const CONSTANTS = { pi: Math.PI, 'π': Math.PI, e: Math.E };

/* ---------------- Tokenizador ---------------- */

export function tokenize(source) {
  const tokens = [];
  const src = String(source).replace(/,/g, '.');   // coma decimal
  let i = 0;

  const isDigit = c => c >= '0' && c <= '9';
  const isLetter = c => /[a-zA-Zπ]/.test(c);

  while (i < src.length) {
    const c = src[i];

    if (c === ' ' || c === '\t') { i++; continue; }

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let j = i;
      while (j < src.length && (isDigit(src[j]) || src[j] === '.')) j++;
      const texto = src.slice(i, j);
      if ((texto.match(/\./g) || []).length > 1) {
        throw new SyntaxError(`número mal escrito: ${texto}`);
      }
      tokens.push({ type: 'number', value: Number(texto), text: texto });
      i = j;
      continue;
    }

    if (isLetter(c)) {
      let j = i;
      while (j < src.length && (isLetter(src[j]) || isDigit(src[j]))) j++;
      const nombre = src.slice(i, j);
      tokens.push({ type: 'name', value: nombre, text: nombre });
      i = j;
      continue;
    }

    if ('+-*/^%()'.includes(c) || c === '×' || c === '÷' || c === '−') {
      const normal = c === '×' ? '*' : c === '÷' ? '/' : c === '−' ? '-' : c;
      tokens.push({ type: normal === '(' || normal === ')' ? normal : 'op', value: normal, text: c });
      i++;
      continue;
    }

    throw new SyntaxError(`carácter no permitido: "${c}"`);
  }
  return tokens;
}

/* ---------------- Analizador (precedencia por ascenso) ---------------- */

const BINARY = {
  '+': { prec: 1, right: false },
  '-': { prec: 1, right: false },
  '*': { prec: 2, right: false },
  '/': { prec: 2, right: false },
  '^': { prec: 4, right: true }
};

export function parse(source) {
  const tokens = typeof source === 'string' ? tokenize(source) : source;
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = type => {
    const token = next();
    if (!token || (token.type !== type && token.value !== type)) {
      throw new SyntaxError(type === ')' ? 'falta un paréntesis de cierre' : `se esperaba ${type}`);
    }
    return token;
  };

  /** ¿Hay multiplicación implícita? 2π, 3(4), 2sin(x) */
  const implicitMul = () => {
    const token = peek();
    if (!token) return false;
    return token.type === 'number' || token.type === 'name' || token.type === '(';
  };

  function parsePrimary() {
    const token = next();
    if (!token) throw new SyntaxError('la expresión se corta');

    if (token.type === 'op' && (token.value === '-' || token.value === '+')) {
      const operand = parseExpression(3);   // el menos unario aprieta más que * y /
      return token.value === '-' ? { type: 'neg', operand } : operand;
    }

    if (token.type === 'number') return { type: 'number', value: token.value };

    if (token.type === '(') {
      const inner = parseExpression(0);
      expect(')');
      return inner;
    }

    if (token.type === 'name') {
      const nombre = token.value.toLowerCase();
      if (FUNCTIONS.includes(nombre)) {
        expect('(');
        const arg = parseExpression(0);
        expect(')');
        return { type: 'call', name: nombre, arg };
      }
      if (nombre in CONSTANTS || token.value === 'π') {
        return { type: 'const', name: token.value === 'π' ? 'π' : nombre };
      }
      return { type: 'var', name: token.value };
    }

    throw new SyntaxError(`no se esperaba "${token.text}"`);
  }

  function parsePostfix(node) {
    let salida = node;
    while (peek()?.type === 'op' && peek().value === '%') {
      next();
      salida = { type: 'percent', operand: salida };
    }
    return salida;
  }

  function parseExpression(minPrec) {
    let left = parsePostfix(parsePrimary());

    for (;;) {
      const token = peek();

      // Multiplicación implícita: 2π, 3(4)
      if (token && minPrec <= 2 && implicitMul() && !(token.type === 'op')) {
        const right = parseExpression(3);
        left = { type: 'binary', op: '*', left, right, implicit: true };
        continue;
      }

      if (!token || token.type !== 'op' || !BINARY[token.value]) break;
      const info = BINARY[token.value];
      if (info.prec < minPrec) break;
      next();
      const right = parseExpression(info.right ? info.prec : info.prec + 1);
      left = parsePostfix({ type: 'binary', op: token.value, left, right });
    }
    return left;
  }

  const ast = parseExpression(0);
  if (pos < tokens.length) throw new SyntaxError(`sobra "${tokens[pos].text}"`);
  return ast;
}

/* ---------------- Evaluación ---------------- */

const toRad = (value, degrees) => (degrees ? (value * Math.PI) / 180 : value);
const fromRad = (value, degrees) => (degrees ? (value * 180) / Math.PI : value);

export function evaluate(node, { vars = {}, degrees = false } = {}) {
  switch (node.type) {
    case 'number': return node.value;
    case 'const': return CONSTANTS[node.name] ?? CONSTANTS[node.name.toLowerCase()];
    case 'var': {
      const nombre = node.name;
      if (nombre in vars) return vars[nombre];
      if (nombre.toLowerCase() in vars) return vars[nombre.toLowerCase()];
      throw new ReferenceError(`no sé qué vale "${nombre}"`);
    }
    case 'neg': return -evaluate(node.operand, { vars, degrees });
    case 'percent': return evaluate(node.operand, { vars, degrees }) / 100;
    case 'binary': {
      const a = evaluate(node.left, { vars, degrees });
      const b = evaluate(node.right, { vars, degrees });
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/':
          if (b === 0) throw new RangeError('división entre cero');
          return a / b;
        case '^': return Math.pow(a, b);
        default: throw new SyntaxError(`operador desconocido ${node.op}`);
      }
    }
    case 'call': {
      const x = evaluate(node.arg, { vars, degrees });
      switch (node.name) {
        case 'sin': return Math.sin(toRad(x, degrees));
        case 'cos': return Math.cos(toRad(x, degrees));
        case 'tan': return Math.tan(toRad(x, degrees));
        case 'asin': return fromRad(Math.asin(x), degrees);
        case 'acos': return fromRad(Math.acos(x), degrees);
        case 'atan': return fromRad(Math.atan(x), degrees);
        case 'sqrt':
          if (x < 0) throw new RangeError('raíz cuadrada de un número negativo');
          return Math.sqrt(x);
        case 'abs': return Math.abs(x);
        case 'log':
          if (x <= 0) throw new RangeError('logaritmo de un número no positivo');
          return Math.log10(x);
        case 'ln':
          if (x <= 0) throw new RangeError('logaritmo de un número no positivo');
          return Math.log(x);
        case 'exp': return Math.exp(x);
        case 'round': return Math.round(x);
        case 'floor': return Math.floor(x);
        case 'ceil': return Math.ceil(x);
        default: throw new SyntaxError(`función desconocida ${node.name}`);
      }
    }
    default: throw new SyntaxError(`nodo desconocido ${node.type}`);
  }
}

/** Atajo: calcula una expresión escrita. */
export function calc(source, options) {
  return evaluate(parse(source), options);
}

/* ---------------- Pasos ---------------- */

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
const nice = value => {
  if (!Number.isFinite(value)) return String(value);
  const redondeado = Math.round(value * 1e10) / 1e10;
  return String(redondeado);
};

/** Devuelve la expresión como texto, con los paréntesis justos. */
export function format(node, parentPrec = 0) {
  switch (node.type) {
    case 'number': return nice(node.value);
    case 'const': return node.name === 'pi' ? 'π' : node.name;
    case 'var': return node.name;
    case 'neg': return `-${format(node.operand, 3)}`;
    case 'percent': return `${format(node.operand, 5)}%`;
    case 'call': return `${node.name}(${format(node.arg, 0)})`;
    case 'binary': {
      const prec = PREC[node.op];
      const texto = `${format(node.left, prec)} ${node.op === '*' ? '×' : node.op === '/' ? '÷' : node.op} ${format(node.right, prec + 1)}`;
      return prec < parentPrec ? `(${texto})` : texto;
    }
    default: return '?';
  }
}

const isLeaf = node => node.type === 'number';

/**
 * Reduce la expresión paso a paso respetando el orden de operaciones.
 * Devuelve [{ expresion, operacion }] terminando en el resultado.
 */
export function reduceSteps(source, options = {}) {
  let ast = typeof source === 'string' ? parse(source) : source;
  const pasos = [{ expresion: format(ast), operacion: null }];
  let vueltas = 0;

  /** Busca el nodo reducible que toca según el orden de operaciones. */
  function findNext(node) {
    if (node.type === 'binary') {
      // Primero lo de dentro; entre hermanos, mayor precedencia y luego izquierda.
      const izquierda = findNext(node.left);
      const derecha = findNext(node.right);
      if (izquierda && derecha) {
        const pi = PREC[izquierda.node?.op] ?? 9;
        const pd = PREC[derecha.node?.op] ?? 9;
        return pi >= pd ? izquierda : derecha;
      }
      if (izquierda) return izquierda;
      if (derecha) return derecha;
      if (isLeaf(node.left) && isLeaf(node.right)) return { node };
      return null;
    }
    if (node.type === 'neg' || node.type === 'percent') {
      const dentro = findNext(node.operand);
      if (dentro) return dentro;
      return isLeaf(node.operand) ? { node } : null;
    }
    if (node.type === 'call') {
      const dentro = findNext(node.arg);
      if (dentro) return dentro;
      return isLeaf(node.arg) ? { node } : null;
    }
    if (node.type === 'const') return { node };
    return null;
  }

  function replace(root, target, value) {
    if (root === target) return { type: 'number', value };
    if (root.type === 'binary') {
      return { ...root, left: replace(root.left, target, value), right: replace(root.right, target, value) };
    }
    if (root.type === 'neg' || root.type === 'percent') {
      return { ...root, operand: replace(root.operand, target, value) };
    }
    if (root.type === 'call') return { ...root, arg: replace(root.arg, target, value) };
    return root;
  }

  while (!isLeaf(ast) && vueltas++ < 200) {
    const encontrado = findNext(ast);
    if (!encontrado) break;
    const valor = evaluate(encontrado.node, options);
    const antes = format(encontrado.node);
    ast = replace(ast, encontrado.node, valor);
    pasos.push({ expresion: format(ast), operacion: `${antes} = ${nice(valor)}` });
  }

  return pasos;
}
