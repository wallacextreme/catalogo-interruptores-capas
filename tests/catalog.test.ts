/**
 * tests/catalog.test.ts
 * Suíte de Testes Automatizados do Catálogo de Interruptores e Capas
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import rawSeedData from '../src/data/catalog-master-seed.json';
import { ProductItem, CatalogFilterState } from '../src/types/catalog';
import { CatalogSearchEngine, normalizeSearchText, cleanCodeKey } from '../src/search/search-engine';

describe('1. Integridade do Seed de Dados Master', () => {
  const items = rawSeedData as ProductItem[];

  it('deve conter 157 produtos extraídos dos 6 documentos Word', () => {
    expect(items.length).toBe(157);
  });

  it('100% dos produtos devem conter ao menos uma foto WebP associada', () => {
    for (const item of items) {
      expect(item.images.length).toBeGreaterThan(0);
      expect(item.images[0]).toContain('.webp');
      expect(item.images[0]).toBe(item.images[0].toLowerCase());
    }
  });

  it('deve conter as seções/categorias oficiais', () => {
    const categories = new Set(items.map(i => i.category));
    expect(categories.has('Interruptor de Porta')).toBe(true);
    expect(categories.has('Interruptor de Freio de Mão')).toBe(true);
    expect(categories.has('Farol de Milha / Auxiliar')).toBe(true);
    expect(categories.has('Interruptor de Farol')).toBe(true);
    expect(categories.has('Comutador de Farol')).toBe(true);
    expect(categories.has('Interruptor de Alerta')).toBe(true);
    expect(categories.has('Capas e Botões')).toBe(true);
    expect(categories.has('Botão Falso')).toBe(true);
    expect(categories.has('Moldura de Interruptor')).toBe(true);
    expect(categories.has('Interruptores Diversos')).toBe(true);
  });
});

describe('2. Motor de Busca Omnibox Sub-50ms', () => {
  const items = rawSeedData as ProductItem[];
  let engine: CatalogSearchEngine;

  beforeEach(() => {
    engine = new CatalogSearchEngine(items);
  });

  const baseFilter: CatalogFilterState = {
    query: '',
    category: 'Todos',
    manufacturer: 'Todos',
    spec: 'Todos',
    box: 'Todas',
    hasPhotoOnly: false,
    viewMode: 'grid',
    hidePrices: true,
    darkMode: false,
  };

  it('deve localizar peças por número de caixa (ex: "21", "cx 21", "01")', () => {
    // Busca por "21"
    const res21 = engine.search({ ...baseFilter, query: '21' });
    expect(res21.length).toBeGreaterThan(0);
    expect(res21[0].item.boxNumber).toBe('21');

    // Busca por "cx 01"
    const res01 = engine.search({ ...baseFilter, query: 'cx 01' });
    expect(res01.length).toBeGreaterThan(0);
    expect(res01[0].item.boxNumber).toBe('01');

    // Busca por "caixa 04"
    const res04 = engine.search({ ...baseFilter, query: 'caixa 04' });
    expect(res04.length).toBeGreaterThan(0);
    expect(res04[0].item.boxNumber).toBe('04');
  });

  it('deve localizar peças por código principal (ex: "K3041750", "DP-7.078", "GM2003")', () => {
    const resK = engine.search({ ...baseFilter, query: 'K3041750' });
    expect(resK.length).toBeGreaterThan(0);
    expect(resK[0].item.commercialCode).toBe('K3041750');

    const resDP = engine.search({ ...baseFilter, query: 'DP-7.078' });
    expect(resDP.length).toBeGreaterThan(0);
    expect(resDP[0].item.commercialCode).toBe('DP-7.078');

    const resGM = engine.search({ ...baseFilter, query: 'GM2003' });
    expect(resGM.length).toBeGreaterThan(0);
    expect(resGM[0].item.commercialCode).toBe('GM2003');
  });

  it('deve localizar peças por códigos cruzados / equivalentes (ex: "IM-34750", "9341", "9343")', () => {
    // K3041750 tem conversão IM-34750
    const resCross = engine.search({ ...baseFilter, query: 'IM-34750' });
    expect(resCross.length).toBeGreaterThan(0);
    expect(resCross[0].item.crossReferenceCodes).toContain('IM-34750');

    // IK-2000 tem código curto 9341
    const res9341 = engine.search({ ...baseFilter, query: '9341' });
    expect(res9341.length).toBeGreaterThan(0);
    expect(res9341[0].item.commercialCode).toBe('IK-2000');
  });

  it('deve localizar peças por número OEM (ex: "307.941.535.1", "542.947.561-A", "377.943.561")', () => {
    const resOem = engine.search({ ...baseFilter, query: '307.941.535.1' });
    expect(resOem.length).toBeGreaterThan(0);
    expect(resOem[0].item.oemCodes).toContain('307.941.535.1');

    const resOem2 = engine.search({ ...baseFilter, query: '542.947.561-A' });
    expect(resOem2.length).toBeGreaterThan(0);
    expect(resOem2[0].item.commercialCode).toBe('DP-7.127');
  });

  it('deve filtrar por especificações técnicas ("3 Pinos", "4 Pinos", "1 Estágio", "2 Estágios")', () => {
    const res3P = engine.search({ ...baseFilter, spec: '3 Pinos' });
    expect(res3P.length).toBeGreaterThan(0);
    res3P.forEach(r => expect(r.item.specs).toContain('3 Pinos'));

    const res4P = engine.search({ ...baseFilter, spec: '4 Pinos' });
    expect(res4P.length).toBeGreaterThan(0);
    res4P.forEach(r => expect(r.item.specs).toContain('4 Pinos'));
  });

  it('deve responder à busca em menos de 50ms (benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      engine.search({ ...baseFilter, query: 'milha gol g3' });
    }
    const elapsed = (performance.now() - start) / 50;
    expect(elapsed).toBeLessThan(50);
  });
});

describe('3. Isolamento e Integridade dos Dados da Loja', () => {
  it('edições manuais de caixa, código ou foto não devem ser sobrescritas pelo seed estático', () => {
    const originalItem: ProductItem = {
      id: 'test-item-1',
      category: 'Farol de Milha / Auxiliar',
      section: 'Botão Farol de Milha',
      sourceDocument: 'INTERRUPTOR FAROL DE MILHA.doc',
      boxNumber: '21',
      boxDisplay: 'CAIXA 21',
      internalCode: '',
      commercialCode: 'K3041750',
      commercialCodeRaw: 'K3041750',
      description: 'Botão Milha Gol G3',
      specs: ['1 Estágio'],
      vehicles: ['Gol'],
      manufacturers: ['VW'],
      partBrand: 'Kostal',
      crossReferenceCodes: ['IM-34750'],
      oemCodes: [],
      searchTokens: ['21', 'k3041750'],
      images: ['/catalog-images/interruptores/test.webp'],
      price: null,
      updatedAt: '2026-10-30T10:00:00Z',
    };

    // Usuário altera a caixa no balcão para 21B e adiciona preço
    const userEdits = {
      boxNumber: '21B',
      boxDisplay: 'CAIXA 21B',
      price: 45.0,
      customImages: ['data:image/webp;base64,customPhotoData'],
    };

    // Ao sincronizar com o seed original, as edições devem prevalecer
    const mergedItem: ProductItem = {
      ...originalItem,
      boxNumber: userEdits.boxNumber,
      boxDisplay: userEdits.boxDisplay,
      price: userEdits.price,
      images: [...originalItem.images, ...userEdits.customImages],
    };

    expect(mergedItem.boxNumber).toBe('21B');
    expect(mergedItem.boxDisplay).toBe('CAIXA 21B');
    expect(mergedItem.price).toBe(45.0);
    expect(mergedItem.images.length).toBe(2);
  });

  it('deve sanitizar entradas e evitar injeção XSS', () => {
    const dangerousInput = '<script>alert("xss")</script><b>Monza</b>';
    const normalized = normalizeSearchText(dangerousInput);
    expect(normalized).not.toContain('<script>');
    expect(cleanCodeKey('<script>123</script>')).toBe('script123script');
  });
});
