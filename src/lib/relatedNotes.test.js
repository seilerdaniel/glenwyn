import { describe, it, expect } from 'vitest';
import { pageText, findRelatedPages } from './relatedNotes';

// Pequeño helper para armar páginas de prueba sin repetir todos los campos.
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

describe('pageText', () => {
  it('junta el título con el contenido de todos los bloques', () => {
    const p = page({
      title: 'Recetas de otoño',
      blocks: [
        { id: 'b1', type: 'text', content: 'Hoy cociné una sopa de calabaza.' },
        { id: 'b2', type: 'todo', content: 'probar el pan de calabaza' },
      ],
    });
    const text = pageText(p);
    expect(text).toContain('Recetas de otoño');
    expect(text).toContain('calabaza');
    expect(text).toContain('pan');
  });

  it('aplana las filas de una tabla', () => {
    const p = page({
      title: 'Inventario',
      blocks: [{ id: 'b1', type: 'table', rows: [['harina', '1kg'], ['levadura', '100g']] }],
    });
    expect(pageText(p)).toContain('harina');
    expect(pageText(p)).toContain('levadura');
  });

  it('no explota sin bloques ni título', () => {
    expect(pageText(undefined)).toBe('');
    expect(pageText(page({ title: '' }))).toBe('');
  });
});

describe('findRelatedPages', () => {
  it('destaca parejas por términos compartidos', () => {
    const currentPage = page({
      id: 'cur',
      title: 'Jardinería de otoño',
      blocks: [{ id: 'b', type: 'text', content: 'Los tomates tardan en madurar en otoño.' }],
    });
    const related = page({
      id: 'rel',
      title: 'Calendario de siembra',
      blocks: [{ id: 'b', type: 'text', content: 'El otoño es ideal para sembrar tomates.' }],
    });
    const unrelated = page({
      id: 'unrel',
      title: 'Recetas de pastas',
      blocks: [{ id: 'b', type: 'text', content: 'El fettuccine se cocina en agua con sal, de la salsa pesto le va bien un poco de albahaca.' }],
    });
    const pages = [currentPage, related, unrelated];
    const suggestions = findRelatedPages(pages, currentPage, { limit: 5, minScore: 0 });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].page.id).toBe('rel');
  });

  it('no sugiere la propia página ni las ya enlazadas', () => {
    const currentPage = page({
      id: 'cur',
      title: 'Plan de estudios',
      blocks: [
        { id: 'b1', type: 'text', content: 'fisica cuantica teoria matematicas' },
        { id: 'b2', type: 'page-link', linkedPageId: 'ya-ligada' },
      ],
    });
    const alreadyLinked = page({ id: 'ya-ligada', title: 'Ya ligada nota', blocks: [{ id: 'b', type: 'text', content: 'fisica cuantica teoria matematicas' }] });
    const fresh = page({ id: 'fresh', title: 'Física', blocks: [{ id: 'b', type: 'text', content: 'teoria cuantica fisica matematicas' }] });
    const pages = [currentPage, alreadyLinked, fresh];
    const result = findRelatedPages(pages, currentPage, { minScore: 0 });
    const ids = result.map((r) => r.page.id);
    expect(ids).not.toContain('cur');
    expect(ids).not.toContain('ya-ligada');
    expect(ids).toContain('fresh');
  });

  it('respeta el límite y el score mínimo', () => {
    const currentPage = page({ id: 'cur', title: 'Base', blocks: [{ id: 'b', type: 'text', content: 'alpha beta gamma delta' }] });
    const others = Array.from({ length: 6 }, (_, i) =>
      page({ id: 'p' + i, title: `Nota ${i}`, blocks: [{ id: 'b', type: 'text', content: 'alpha beta gamma delta' }] })
    );
    const pages = [currentPage, ...others];
    expect(findRelatedPages(pages, currentPage, { limit: 3 }).length).toBe(3);
    expect(findRelatedPages(pages, currentPage, { minScore: 999 }).length).toBe(0);
  });

  it('ignora páginas archivadas', () => {
    const currentPage = page({ id: 'cur', title: 'A', blocks: [{ id: 'b', type: 'text', content: 'sistema solar nebulosa galaxias' }] });
    const archived = page({ id: 'arch', title: 'Astrofísica', isArchived: true, blocks: [{ id: 'b', type: 'text', content: 'sistema solar nebulosa galaxias' }] });
    const pages = [currentPage, archived];
    expect(findRelatedPages(pages, currentPage, { minScore: 0 })).toEqual([]);
  });
});