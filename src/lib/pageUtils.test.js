import { describe, it, expect } from 'vitest';
import {
  childrenOf,
  isDescendant,
  getDescendantIds,
  getAncestorChain,
  countWords,
  pageMatchesQuery,
  detectMarkdownShortcut,
  isHttpUrl,
  parseEmbedUrl,
  getBacklinks,
  getBacklinkCounts,
  getOrphanPages,
  getPageMaturity,
  movePage,
  movePageToRootEnd,
  resolvePropertyValue,
  newProperty,
  getDefaultPropertyValues,
  emptyPage,
  welcomePageBlocks,
} from './pageUtils';

// Pequeño helper para armar páginas de prueba sin repetir todos los campos
// cada vez — solo los que cada test realmente necesita.
function page(overrides = {}) {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    title: 'Sin título',
    icon: null,
    parentId: null,
    order: 0,
    blocks: [],
    isArchived: false,
    ...overrides,
  };
}

describe('childrenOf', () => {
  it('devuelve solo los hijos directos, ordenados por order', () => {
    const pages = [
      page({ id: 'a', parentId: null, order: 0 }),
      page({ id: 'b', parentId: 'a', order: 1 }),
      page({ id: 'c', parentId: 'a', order: 0 }),
      page({ id: 'd', parentId: 'b', order: 0 }), // nieto de a, no debe aparecer
    ];
    const result = childrenOf(pages, 'a');
    expect(result.map((p) => p.id)).toEqual(['c', 'b']);
  });

  it('devuelve vacío si no hay hijos', () => {
    expect(childrenOf([page({ id: 'a' })], 'a')).toEqual([]);
  });
});

describe('isDescendant / getDescendantIds', () => {
  // a → b → c (c es nieto de a)
  const pages = [
    page({ id: 'a', parentId: null }),
    page({ id: 'b', parentId: 'a' }),
    page({ id: 'c', parentId: 'b' }),
    page({ id: 'x', parentId: null }), // sin relación
  ];

  it('isDescendant reconoce un nieto, no solo un hijo directo', () => {
    expect(isDescendant(pages, 'a', 'c')).toBe(true);
    expect(isDescendant(pages, 'a', 'b')).toBe(true);
  });

  it('isDescendant es false para páginas sin relación', () => {
    expect(isDescendant(pages, 'a', 'x')).toBe(false);
    expect(isDescendant(pages, 'x', 'a')).toBe(false);
  });

  it('getDescendantIds trae todos los niveles, no solo el primero', () => {
    expect(getDescendantIds(pages, 'a').sort()).toEqual(['b', 'c']);
  });

  it('getDescendantIds de una hoja es vacío', () => {
    expect(getDescendantIds(pages, 'c')).toEqual([]);
  });
});

describe('getAncestorChain', () => {
  it('arma la cadena en orden raíz → hoja', () => {
    const pages = [
      page({ id: 'a', parentId: null, title: 'A' }),
      page({ id: 'b', parentId: 'a', title: 'B' }),
      page({ id: 'c', parentId: 'b', title: 'C' }),
    ];
    const chain = getAncestorChain(pages, 'c');
    expect(chain.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('no entra en loop infinito si hay un ciclo corrupto en los datos', () => {
    // parentId cruzado (a→b, b→a) — no debería colgarse ni tirar error
    const pages = [
      page({ id: 'a', parentId: 'b' }),
      page({ id: 'b', parentId: 'a' }),
    ];
    expect(() => getAncestorChain(pages, 'a')).not.toThrow();
  });

  it('página raíz (sin padre) tiene cadena vacía', () => {
    expect(getAncestorChain([page({ id: 'a', parentId: null })], 'a')).toEqual([]);
  });
});

describe('countWords', () => {
  it('cuenta palabras de content y body juntos', () => {
    const p = page({
      blocks: [
        { type: 'text', content: 'una dos tres' },
        { type: 'toggle', content: 'seis', body: 'cuatro cinco' },
      ],
    });
    // El "content" del toggle es el texto de su encabezado clickeable — cuenta
    // como palabras igual que el body, no solo el body.
    expect(countWords(p)).toBe(6);
  });

  it('cuenta celdas de tabla también', () => {
    const p = page({ blocks: [{ type: 'table', rows: [['uno', 'dos'], ['tres']] }] });
    expect(countWords(p)).toBe(3);
  });

  it('página vacía tiene 0 palabras', () => {
    expect(countWords(page({ blocks: [] }))).toBe(0);
  });
});

describe('pageMatchesQuery', () => {
  it('encuentra por título', () => {
    expect(pageMatchesQuery(page({ title: 'Notas de reunión' }), 'reunión')).toBe(true);
  });

  it('encuentra por contenido, no solo por título', () => {
    const p = page({ title: 'Sin título', blocks: [{ type: 'text', content: 'palabra clave escondida' }] });
    expect(pageMatchesQuery(p, 'escondida')).toBe(true);
  });

  it('no matchea texto que no está en ningún lado', () => {
    expect(pageMatchesQuery(page({ title: 'Algo' }), 'nada-que-ver')).toBe(false);
  });
});

describe('detectMarkdownShortcut', () => {
  it.each([
    ['# Título', 'heading', 'Título'],
    ['## Subtítulo', 'heading', 'Subtítulo'],
    ['- [] pendiente', 'todo', 'pendiente'],
    ['- viñeta', 'bullet', 'viñeta'],
    ['1. numerado', 'numbered', 'numerado'],
    ['> una cita', 'quote', 'una cita'],
  ])('reconoce %s como %s', (input, expectedType, expectedContent) => {
    const result = detectMarkdownShortcut(input);
    expect(result).toEqual({ type: expectedType, content: expectedContent });
  });

  it('--- exacto se convierte en divisor', () => {
    expect(detectMarkdownShortcut('---')).toEqual({ type: 'divider', content: '' });
  });

  it('texto normal no dispara ningún atajo', () => {
    expect(detectMarkdownShortcut('esto es texto común')).toBeNull();
  });
});

describe('isHttpUrl', () => {
  it('acepta http y https', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  it('rechaza javascript: y otros protocolos — el motivo de que exista esta función', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,hola')).toBe(false);
  });

  it('rechaza texto que ni siquiera es una URL', () => {
    expect(isHttpUrl('no es una url')).toBe(false);
  });
});

describe('parseEmbedUrl', () => {
  it('reconoce YouTube con ?v=', () => {
    const r = parseEmbedUrl('https://www.youtube.com/watch?v=abc123');
    expect(r.kind).toBe('youtube');
    expect(r.embedSrc).toBe('https://www.youtube.com/embed/abc123');
  });

  it('reconoce youtu.be corto', () => {
    const r = parseEmbedUrl('https://youtu.be/abc123');
    expect(r.embedSrc).toBe('https://www.youtube.com/embed/abc123');
  });

  it('URL desconocida cae al genérico, no explota', () => {
    expect(parseEmbedUrl('https://un-sitio-cualquiera.com/pagina')).toEqual({ kind: 'generic', embedSrc: null, ratio: null });
  });

  it('URL inválida no tira error', () => {
    expect(() => parseEmbedUrl('no es una url')).not.toThrow();
  });
});

describe('getBacklinks / getBacklinkCounts / getOrphanPages', () => {
  it('detecta un backlink vía mención [[página]]', () => {
    const target = page({ id: 'target', title: 'Destino' });
    const source = page({ id: 'source', blocks: [{ type: 'text', content: 'mirá [[Destino]]' }] });
    const backlinks = getBacklinks([target, source], 'target');
    expect(backlinks.map((p) => p.id)).toEqual(['source']);
  });

  it('una página archivada nunca cuenta como backlink', () => {
    const target = page({ id: 'target', title: 'Destino' });
    const archivedSource = page({ id: 'src', isArchived: true, blocks: [{ type: 'text', content: '[[Destino]]' }] });
    expect(getBacklinks([target, archivedSource], 'target')).toEqual([]);
  });

  it('una página que menciona lo mismo dos veces cuenta una sola vez en getBacklinkCounts', () => {
    const target = page({ id: 'target', title: 'Destino' });
    const source = page({ id: 'source', blocks: [{ type: 'text', content: '[[Destino]] y de nuevo [[Destino]]' }] });
    const counts = getBacklinkCounts([target, source]);
    expect(counts['target']).toBe(1);
  });

  it('getOrphanPages solo trae páginas sin ningún backlink', () => {
    const linked = page({ id: 'linked', title: 'Con backlink' });
    const orphan = page({ id: 'orphan', title: 'Huérfana' });
    const source = page({ id: 'source', blocks: [{ type: 'text', content: '[[Con backlink]]' }] });
    const orphans = getOrphanPages([linked, orphan, source]);
    expect(orphans.map((p) => p.id).sort()).toEqual(['orphan', 'source']);
  });
});

describe('getPageMaturity', () => {
  it('sin backlinks es siempre "fugaz", sin importar el largo', () => {
    const longPage = page({ blocks: [{ type: 'text', content: 'palabra '.repeat(100) }] });
    expect(getPageMaturity(longPage, 0)).toBe('fugaz');
  });

  it('con backlinks pero corta es "en_proceso"', () => {
    const shortPage = page({ blocks: [{ type: 'text', content: 'corta' }] });
    expect(getPageMaturity(shortPage, 1)).toBe('en_proceso');
  });

  it('con backlinks y suficiente contenido es "permanente"', () => {
    const longPage = page({ blocks: [{ type: 'text', content: 'palabra '.repeat(50) }] });
    expect(getPageMaturity(longPage, 1)).toBe('permanente');
  });
});

describe('movePage (drag-and-drop en el árbol) — la función con la que casi hubo un choque de nombres real', () => {
  it('mueve una página a ser hija de otra ("inside")', () => {
    const pages = [
      page({ id: 'a', parentId: null, order: 0 }),
      page({ id: 'b', parentId: null, order: 1 }),
    ];
    const result = movePage(pages, 'b', 'a', 'inside');
    const moved = result.find((p) => p.id === 'b');
    expect(moved.parentId).toBe('a');
  });

  it('reordena entre hermanos con "before"/"after"', () => {
    const pages = [
      page({ id: 'a', parentId: null, order: 0 }),
      page({ id: 'b', parentId: null, order: 1 }),
      page({ id: 'c', parentId: null, order: 2 }),
    ];
    const result = movePage(pages, 'c', 'a', 'before');
    const rootOrder = result.filter((p) => p.parentId === null).sort((x, y) => x.order - y.order).map((p) => p.id);
    expect(rootOrder).toEqual(['c', 'a', 'b']);
  });

  it('previene el ciclo: no deja mover una página adentro de su propio descendiente', () => {
    const pages = [
      page({ id: 'a', parentId: null }),
      page({ id: 'b', parentId: 'a' }), // b es hijo de a
    ];
    // intentar mover 'a' adentro de 'b' (su propio hijo) crearía un ciclo
    const result = movePage(pages, 'a', 'b', 'inside');
    expect(result).toBe(pages); // sin cambios — la función debe devolver el array intacto
  });

  it('moverse a sí misma no hace nada', () => {
    const pages = [page({ id: 'a' })];
    expect(movePage(pages, 'a', 'a', 'inside')).toBe(pages);
  });
});

describe('movePageToRootEnd', () => {
  it('manda la página al final del nivel principal', () => {
    const pages = [
      page({ id: 'a', parentId: null, order: 0 }),
      page({ id: 'b', parentId: 'a', order: 0 }),
    ];
    const result = movePageToRootEnd(pages, 'b');
    const moved = result.find((p) => p.id === 'b');
    expect(moved.parentId).toBeNull();
  });
});

describe('resolvePropertyValue — el rollup con detección de ciclos (Fase C, bug real ya encontrado una vez)', () => {
  it('una propiedad normal (no rollup) devuelve su valor tal cual', () => {
    const record = { id: 'r1', properties: { p1: 'hola' } };
    const prop = { id: 'p1', type: 'text' };
    const result = resolvePropertyValue([], [], record, prop, null);
    expect(result).toEqual({ value: 'hola', error: null });
  });

  it('detecta un ciclo A→B→A en vez de devolver 0 silenciosamente', () => {
    // Dos bases de datos que se referencian entre sí en un rollup circular.
    const dbA = {
      id: 'dbA',
      properties: [
        { id: 'relA', type: 'relation', relatedDatabaseId: 'dbB' },
        { id: 'rollupA', type: 'rollup', relationPropertyId: 'relA', targetPropertyId: 'rollupB', aggregation: 'sum' },
      ],
    };
    const dbB = {
      id: 'dbB',
      properties: [
        { id: 'relB', type: 'relation', relatedDatabaseId: 'dbA' },
        { id: 'rollupB', type: 'rollup', relationPropertyId: 'relB', targetPropertyId: 'rollupA', aggregation: 'sum' },
      ],
    };
    const recordA = { id: 'recA', databaseId: 'dbA', properties: { relA: ['recB'] } };
    const recordB = { id: 'recB', databaseId: 'dbB', properties: { relB: ['recA'] } };
    const pages = [recordA, recordB];
    const databases = [dbA, dbB];

    const result = resolvePropertyValue(pages, databases, recordA, dbA.properties[1], dbA);
    // Antes del fix real: Number(null) === 0 hacía que esto devolviera { value: 0 }
    // en vez de marcar el error — este test existe específicamente para que
    // ese bug no pueda volver sin que un test lo note.
    expect(result.error).toBe('ciclo');
    expect(result.value).toBeNull();
  });

  it('rollup de tipo "count" cuenta los registros relacionados', () => {
    const db = { id: 'db1', properties: [{ id: 'rel1', type: 'relation', relatedDatabaseId: 'db2' }] };
    const relatedDb = { id: 'db2', properties: [{ id: 'p1', type: 'text' }] };
    const rollupProp = { id: 'rollup1', type: 'rollup', relationPropertyId: 'rel1', targetPropertyId: 'p1', aggregation: 'count' };
    const rel1 = page({ id: 'rel1item', properties: {} });
    const rel2 = page({ id: 'rel2item', properties: {} });
    const record = { id: 'rec1', properties: { rel1: ['rel1item', 'rel2item'] } };
    const result = resolvePropertyValue([rel1, rel2, record], [db, relatedDb], record, rollupProp, db);
    expect(result).toEqual({ value: 2, error: null });
  });
});

describe('newProperty / getDefaultPropertyValues', () => {
  it('una propiedad select nueva viene con opciones vacías, no undefined', () => {
    const prop = newProperty('select');
    expect(Array.isArray(prop.options)).toBe(true);
  });

  it('getDefaultPropertyValues aplica el valor por defecto de cada propiedad', () => {
    const properties = [
      { id: 'p1', type: 'text', defaultValue: 'valor inicial' },
      { id: 'p2', type: 'checkbox', defaultValue: true },
    ];
    const values = getDefaultPropertyValues(properties);
    expect(values).toEqual({ p1: 'valor inicial', p2: true });
  });

  it('propiedades sin valor por defecto no aparecen en el resultado', () => {
    const properties = [{ id: 'p1', type: 'text' }];
    expect(getDefaultPropertyValues(properties)).toEqual({});
  });
});

describe('emptyPage', () => {
  it('arma una página nueva con los campos básicos esperados', () => {
    const p = emptyPage('Mi título', 'parent1', 3);
    expect(p.title).toBe('Mi título');
    expect(p.parentId).toBe('parent1');
    expect(p.order).toBe(3);
    expect(Array.isArray(p.blocks)).toBe(true);
    expect(typeof p.id).toBe('string');
  });
});

describe('welcomePageBlocks', () => {
  it('nunca está vacía — el problema real que la trajo a existir', () => {
    const blocks = welcomePageBlocks();
    expect(blocks.length).toBeGreaterThan(1);
    const totalText = blocks.map((b) => b.content || '').join(' ');
    expect(totalText.trim().length).toBeGreaterThan(0);
  });

  it('cada bloque tiene un id único', () => {
    const blocks = welcomePageBlocks();
    const ids = blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

