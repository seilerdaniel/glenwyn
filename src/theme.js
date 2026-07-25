// ---- Design tokens — shared across every component file ----
// "Miel dorada" — dorado como acento principal en vez de verde, elegido para
// diferenciarse de la competencia (Notion=gris, Obsidian=violeta, Todoist=rojo,
// Bear=rojo, Craft=azul, Reflect=oscuro — ninguno usa dorado/miel). fern y moss
// se oscurecieron respecto de la primera propuesta para pasar WCAG AA en texto
// normal (4.5:1) — la propuesta inicial fallaba en fern/canvas (2.87:1) y
// quedaba al límite en moss/canvas (3.16:1, solo válido para UI/texto grande).
export const tokens = {
  light: {
    canvas: '#FCF6EA',
    canvasAlt: '#F5EAD3',
    bark: '#362916',
    fern: '#7A6647',
    moss: '#8C5F1E',
    clay: '#EEDFBE',
    sun: '#D9A542',
    sidebarBg: '#F5EAD3',
    error: '#A8432E',
  },
  dark: {
    canvas: '#211A0D',
    canvasAlt: '#2A2110',
    bark: '#F0E4CE',
    fern: '#C2A97C',
    moss: '#E0A83E',
    clay: '#3A2E18',
    sun: '#E8B563',
    sidebarBg: '#1C160B',
    error: '#E08A65',
  },
};

export const displayFont = "'Fraunces', Georgia, serif";
export const bodyFont = "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const monoFont = "'JetBrains Mono', ui-monospace, monospace";
