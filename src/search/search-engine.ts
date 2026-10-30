/**
 * src/search/search-engine.ts
 * Motor de Busca Omnibox Ultrarrápido (< 50ms) Especializado em Interruptores e Caixas
 */

import { ProductItem, CatalogFilterState, SearchResult } from '../types/catalog';

export function normalizeSearchText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function cleanCodeKey(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class CatalogSearchEngine {
  private items: ProductItem[] = [];

  constructor(items: ProductItem[] = []) {
    this.items = items;
  }

  setItems(items: ProductItem[]): void {
    this.items = items;
  }

  /**
   * Executa busca omnibox ponderada com tempo de resposta < 50ms
   */
  search(filter: CatalogFilterState): SearchResult[] {
    const startTime = performance.now();
    const rawQuery = filter.query.trim();
    const normQuery = normalizeSearchText(rawQuery);
    const keyQuery = cleanCodeKey(rawQuery);

    // Detecção de busca direta por caixa (ex: "21", "cx 21", "caixa 01", "04")
    let targetBox: string | null = null;
    const boxMatch = normQuery.match(/^(?:cx|caixa)?\s*([0-9]{1,4}[a-z]?)$/i);
    if (boxMatch) {
      targetBox = boxMatch[1].toUpperCase();
    }

    const queryTokens = normQuery.split(/\s+/).filter(t => t.length > 0);

    const results: SearchResult[] = [];

    for (const item of this.items) {
      // 1. Filtros Rápidos de 1 Clique
      if (filter.category && filter.category !== 'Todos') {
        if (item.category !== filter.category) continue;
      }

      if (filter.manufacturer && filter.manufacturer !== 'Todos') {
        const hasMake = item.manufacturers.some(m =>
          normalizeSearchText(m).includes(normalizeSearchText(filter.manufacturer))
        );
        if (!hasMake) continue;
      }

      if (filter.spec && filter.spec !== 'Todos') {
        const hasSpec = item.specs.some(s =>
          normalizeSearchText(s).includes(normalizeSearchText(filter.spec))
        );
        if (!hasSpec) continue;
      }

      if (filter.box && filter.box !== 'Todas') {
        const bClean = filter.box.replace(/^CAIXA\s*/i, '').trim();
        if (item.boxNumber !== bClean && item.internalCode !== bClean) continue;
      }

      if (filter.hasPhotoOnly) {
        if (!item.images || item.images.length === 0) continue;
      }

      // Se não há texto digitado na omnibox, adiciona com score neutro
      if (queryTokens.length === 0) {
        results.push({ item, score: 10, matchedField: 'all' });
        continue;
      }

      // 2. Pontuação e Relevância
      let score = 0;
      let matchedField = '';

      // Match direto de caixa (prioridade máxima industrial)
      const normBox = item.boxNumber.toUpperCase();
      const normInternal = item.internalCode.toUpperCase();
      const normBoxNoZero = normBox.replace(/^0+/, '');

      if (targetBox) {
        const targetNoZero = targetBox.replace(/^0+/, '');
        if (normBox === targetBox || normInternal === targetBox || (normBoxNoZero && normBoxNoZero === targetNoZero)) {
          score += 1500;
          matchedField = `CAIXA ${item.boxNumber || item.internalCode}`;
        }
      }

      // Match exato ou parcial por código comercial
      const commKey = cleanCodeKey(item.commercialCode);
      if (commKey === keyQuery && keyQuery.length > 1) {
        score += 1000;
        matchedField = `Código: ${item.commercialCode}`;
      } else if (commKey.includes(keyQuery) && keyQuery.length >= 2) {
        score += 600;
        matchedField = `Código: ${item.commercialCode}`;
      }

      // Match em códigos cruzados (K3041750 -> IM-34750, 9341, 9336, etc.)
      for (const cross of item.crossReferenceCodes) {
        const crossKey = cleanCodeKey(cross);
        if (crossKey === keyQuery && keyQuery.length > 1) {
          score += 900;
          matchedField = `Cruzado: ${cross}`;
          break;
        } else if (crossKey.includes(keyQuery) && keyQuery.length >= 2) {
          score += 450;
          matchedField = `Cruzado: ${cross}`;
          break;
        }
      }

      // Match em números OEM
      for (const oem of item.oemCodes) {
        const oemKey = cleanCodeKey(oem);
        if (oemKey === keyQuery && keyQuery.length > 2) {
          score += 950;
          matchedField = `OEM: ${oem}`;
          break;
        } else if (oemKey.includes(keyQuery) && keyQuery.length >= 3) {
          score += 500;
          matchedField = `OEM: ${oem}`;
          break;
        }
      }

      // Match de tokens de texto (Veículo + Função + Especificação)
      const normDesc = normalizeSearchText(item.description);
      const normSpecs = item.specs.map(s => normalizeSearchText(s)).join(' ');
      const normVehicles = item.vehicles.map(v => normalizeSearchText(v)).join(' ');
      const combinedText = `${normDesc} ${normSpecs} ${normVehicles} ${item.category.toLowerCase()}`;

      let allTokensMatched = true;
      let tokenScore = 0;

      for (const token of queryTokens) {
        const tokenKey = cleanCodeKey(token);

        // Verifica se o token dá match em caixa
        if (token === normBox.toLowerCase() || token === normBoxNoZero.toLowerCase()) {
          tokenScore += 80;
          continue;
        }

        // Verifica em códigos
        if (commKey.includes(tokenKey) && tokenKey.length >= 2) {
          tokenScore += 70;
          continue;
        }

        // Verifica em texto combinado
        if (combinedText.includes(token)) {
          tokenScore += 40;
          continue;
        }

        // Verifica se o token está em tokens de busca indexados
        const foundInIndex = item.searchTokens.some(t => t.includes(token));
        if (foundInIndex) {
          tokenScore += 30;
          continue;
        }

        allTokensMatched = false;
        break;
      }

      if (allTokensMatched) {
        score += tokenScore;
        if (!matchedField) matchedField = 'Aplicação / Especificação';
      }

      if (score > 0) {
        results.push({ item, score, matchedField });
      }
    }

    // Ordenação por maior relevância
    results.sort((a, b) => b.score - a.score);

    const elapsed = performance.now() - startTime;
    if (elapsed > 50) {
      console.warn(`[Search Engine] Busca demorou ${elapsed.toFixed(2)}ms (acima de 50ms)`);
    }

    return results;
  }
}
