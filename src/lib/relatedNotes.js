// Related-notes suggestions for Glenwyn.
//
// Pure logic — no React, no external libs. A deliberately lightweight semantic
// match: it turns every page (and the current one) into a term vector of word
// n-grams (unigrams + bigrams), then ranks other pages by weighted overlap with
// the current page. Terms that are rarer across the workspace count more (a
// simplified document-frequency weight, in the same spirit as TF-IDF), and
// shared words in titles count extra since titles are the strongest signal.
//
// This is intentionally not a full TF-IDF (no cosine over normalized vectors,
// no heavy corpus). It's a small, deterministic scorer good enough to surface
// "these notes are talking about the same thing" using only what's already in
// `pages` — zero network calls, zero deps.

// Common Spanish stopwords dropped so they don't pollute similarity.
const STOPWORDS = new Set(
  [
    'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'u',
    'que', 'a', 'al', 'en', 'por', 'para', 'con', 'sin', 'sobre', 'entre',
    'del', 'es', 'son', 'ser', 'estoy', 'estamos', 'mi', 'mis', 'tu', 'tus',
    'su', 'sus', 'nuestro', 'esto', 'este', 'esta', 'estos', 'estas', 'ese',
    'esa', 'uno', 'dos', 'como', 'cual', 'cuando', 'donde', 'mas', 'más',
    'menos', 'muy', 'bien', 'mal', 'todo', 'toda', 'mucho', 'poca',
    'hacer', 'hace', 'hay', 'tiene', 'tienen', 'puede', 'pueden',
    'cada', 'me', 'te', 'se', 'le', 'lo', 'tres',
  ]
);

// Strips markdown/wiki syntax and punctuation, returns lowercase word tokens.
function tokenize(text) {
  return String(text || '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // unwrap [[links]] so their titles count
    .replace(/[#*_>\-\d.,;:!¡¿?()"'`´~\u2026]/g, ' ') // drop punctuation/markdown
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Builds a term -> count map with unigrams and bigrams of the given tokens.
function buildTermMap(tokens) {
  const terms = new Map();
  const bump = (term) => terms.set(term, (terms.get(term) || 0) + 1);
  for (const w of tokens) bump(w);
  for (let i = 0; i < tokens.length - 1; i++) bump(`${tokens[i]} ${tokens[i + 1]}`);
  return terms;
}

// All text of a page (title + every block's content) as a single raw string.
export function pageText(page) {
  if (!page) return '';
  const blockTexts = (page.blocks || [])
    .map((b) => {
      if (b.type === 'table') {
        return (b.rows || []).map((row) => (Array.isArray(row) ? row.join(' ') : String(row))).join(' ');
      }
      return b.content || '';
    })
    .join(' ')
    .trim();
  return `${page.title || ''} ${blockTexts}`.trim();
}

// Scores one candidate's term map against the current page's term map.
// `titleBonus` is the number of title words both pages share.
// Returns { score, matchedTerms } — score is weighted overlap, matchedTerms are
// the distinctive shared terms (to explain *why* the two notes relate).
function scoreTerms(currentTerms, candidateTerms, idfMap, titleBonus) {
  let score = 0;
  const matchCounts = new Map();
  for (const [term, count] of candidateTerms) {
    if (!currentTerms.has(term)) continue;
    const shared = Math.min(count, currentTerms.get(term));
    const docCount = idfMap.get(term) || 1;
    const weight = 1 + Math.log1p(1 / docCount); // rarer terms carry more weight
    score += shared * weight;
    matchCounts.set(term, (matchCounts.get(term) || 0) + shared);
  }
  // Distinct shared terms beat one repeated term (broader topical overlap).
  score *= 1 + Math.log1p(matchCounts.size) * 0.2;
  if (titleBonus > 0) score *= 1 + 0.15 * titleBonus; // shared title words are a stronger signal

  const matchedTerms = [...matchCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([term]) => term);

  return { score: Math.round(score * 100) / 100, matchedTerms };
}

// A page is a *suggestion* only if it's not the current page, not archived, and
// not already linked out from the current page (those are known connections,
// not "related but undiscovered" ones).
function isAlreadyConnected(entryId, currentId, currentLinkedIds) {
  if (entryId === currentId) return true;
  return currentLinkedIds.has(entryId);
}

// Main entry point. Returns up to `limit` candidate pages ranked by similarity
// to the `currentPage`'s own text, plus the terms that made them match.
//
// options: { limit = 5, minScore = 0.5 }
export function findRelatedPages(pages, currentPage, options = {}) {
  const { limit = 5, minScore = 0.5 } = options;
  if (!currentPage || !Array.isArray(pages) || currentPage.isArchived) return [];

  // Single pass: per-doc term maps + the document-frequency map (how many docs
  // contain each term), which powers the rarity weighting below.
  const docTerms = new Map(); // pageId -> { page, terms }
  const idfMap = new Map(); // term -> number of docs containing it

  for (const p of pages) {
    if (p.isArchived) continue;
    const terms = buildTermMap(tokenize(pageText(p)));
    docTerms.set(p.id, { page: p, terms });
    const seen = new Set();
    for (const term of terms.keys()) {
      if (!seen.has(term)) {
        idfMap.set(term, (idfMap.get(term) || 0) + 1);
        seen.add(term);
      }
    }
  }

  const current = docTerms.get(currentPage.id);
  if (!current) return [];

  const currentTitleTokens = new Set(tokenize(currentPage.title || ''));
  const currentLinkedIds = new Set();
  for (const b of currentPage.blocks || []) {
    if (b.type === 'page-link' && b.linkedPageId) currentLinkedIds.add(b.linkedPageId);
  }

  const results = [];
  for (const [id, entry] of docTerms) {
    if (isAlreadyConnected(id, currentPage.id, currentLinkedIds)) continue;
    const candidateTitleTokens = tokenize(entry.page?.title || '');
    const titleBonus = [...currentTitleTokens].filter((t) => candidateTitleTokens.includes(t)).length;
    const { score, matchedTerms } = scoreTerms(current.terms, entry.terms, idfMap, titleBonus);
    if (score >= minScore) results.push({ page: entry.page, score, matchedTerms });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}