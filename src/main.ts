/**
 * src/main.ts
 * Ponto de Entrada da Aplicação de Balcão Offline-First
 */

import './style.css';
import rawSeedData from './data/catalog-master-seed.json';
import { ProductItem, CatalogFilterState } from './types/catalog';
import { catalogDb } from './db/catalog-db';
import { CatalogSearchEngine } from './search/search-engine';
import { renderHeader } from './ui/header';
import { renderProductCard } from './ui/product-card';
import { renderMuralView } from './ui/mural-view';
import { renderBoxesMapView } from './ui/boxes-map-view';
import { productFormModal } from './ui/product-form-modal';
import { backupModal } from './ui/backup-modal';

class CatalogApp {
  private allItems: ProductItem[] = [];
  private searchEngine: CatalogSearchEngine = new CatalogSearchEngine();
  private state: CatalogFilterState = {
    query: '',
    category: 'Todos',
    manufacturer: 'Todos',
    spec: 'Todos',
    box: 'Todas',
    hasPhotoOnly: false,
    viewMode: 'grid',
    hidePrices: true, // Padrão: preços ocultos para privacidade de balcão
    darkMode: false,  // Padrão: Daylight Counter Mode
  };

  private headerContainer: HTMLElement;
  private mainContainer: HTMLElement;
  private statusBar: HTMLElement;

  constructor() {
    const root = document.getElementById('app');
    if (!root) throw new Error('Elemento #app não encontrado no DOM');

    root.innerHTML = `
      <div class="min-h-screen flex flex-col bg-counter-bg dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-150">
        <div id="header-root"></div>
        <main id="main-content" class="flex-1 max-w-7xl w-full mx-auto p-4"></main>
        <footer id="status-bar" class="sticky bottom-0 z-20 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-t border-neutral-300 dark:border-neutral-800 px-4 py-2 text-xs font-mono flex items-center justify-between text-neutral-500"></footer>
      </div>
    `;

    this.headerContainer = root.querySelector('#header-root') as HTMLElement;
    this.mainContainer = root.querySelector('#main-content') as HTMLElement;
    this.statusBar = root.querySelector('#status-bar') as HTMLElement;
  }

  async init(): Promise<void> {
    // 1. Sincronização do Seed com IndexedDB (Isolamento Inviolável)
    const seed = (rawSeedData as unknown) as ProductItem[];
    this.allItems = await catalogDb.syncStaticCatalogUpdates(seed);
    this.searchEngine.setItems(this.allItems);

    // 2. Registro do Service Worker (Offline-First)
    this.registerServiceWorker();

    // 3. Render Inicial
    this.applyTheme();
    this.render();
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator && !window.location.host.includes('localhost:1420')) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Registro do Service Worker falhou:', err);
      });
    }
  }

  private applyTheme(): void {
    if (this.state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  private getUniqueCategories(): string[] {
    const set = new Set<string>();
    this.allItems.forEach(i => { if (i.category) set.add(i.category); });
    return Array.from(set).sort();
  }

  private getUniqueManufacturers(): string[] {
    const set = new Set<string>();
    this.allItems.forEach(i => {
      i.manufacturers.forEach(m => set.add(m));
    });
    return Array.from(set).sort();
  }

  private getUniqueSpecs(): string[] {
    const set = new Set<string>();
    this.allItems.forEach(i => {
      i.specs.forEach(s => set.add(s));
    });
    return Array.from(set).sort();
  }

  private render(): void {
    const categories = this.getUniqueCategories();
    const manufacturers = this.getUniqueManufacturers();
    const specs = this.getUniqueSpecs();

    // 1. Render Header
    this.headerContainer.innerHTML = '';
    const headerEl = renderHeader(
      this.state,
      {
        onFilterChange: (changes) => {
          this.state = { ...this.state, ...changes };
          if (changes.darkMode !== undefined) this.applyTheme();
          this.render();
        },
        onOpenAddModal: () => {
          productFormModal.open(undefined, async (saved) => {
            await this.refreshItems();
          });
        },
        onOpenBackupModal: () => {
          backupModal.open(async () => {
            await this.refreshItems();
          });
        },
      },
      categories,
      manufacturers,
      specs
    );
    this.headerContainer.appendChild(headerEl);

    // 2. Executa busca
    const searchStartTime = performance.now();
    const searchResults = this.searchEngine.search(this.state);
    const searchElapsed = performance.now() - searchStartTime;
    const filteredItems = searchResults.map(r => r.item);

    // 3. Render Main View
    this.mainContainer.innerHTML = '';

    if (this.state.viewMode === 'grid') {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

      if (filteredItems.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full py-16 text-center text-neutral-400 font-medium">
            Nenhum interruptor ou capa encontrada para o termo "${this.state.query}".
          </div>
        `;
      } else {
        filteredItems.forEach(item => {
          const card = renderProductCard(item, this.state.hidePrices, {
            onEdit: (prod) => {
              productFormModal.open(prod, async () => {
                await this.refreshItems();
              });
            },
            onQuickBoxChange: async (prod, newBox) => {
              const updated: ProductItem = {
                ...prod,
                boxNumber: newBox,
                boxDisplay: `CAIXA ${newBox}`,
                updatedAt: new Date().toISOString(),
              };
              await catalogDb.saveProduct(updated);
              await this.refreshItems();
            },
          });
          grid.appendChild(card);
        });
      }

      this.mainContainer.appendChild(grid);
    } else if (this.state.viewMode === 'mural') {
      const mural = renderMuralView(filteredItems, {
        onEdit: (prod) => {
          productFormModal.open(prod, async () => {
            await this.refreshItems();
          });
        },
        onQuickBoxChange: async (prod, newBox) => {
          const updated: ProductItem = {
            ...prod,
            boxNumber: newBox,
            boxDisplay: `CAIXA ${newBox}`,
            updatedAt: new Date().toISOString(),
          };
          await catalogDb.saveProduct(updated);
          await this.refreshItems();
        },
      });
      this.mainContainer.appendChild(mural);
    } else if (this.state.viewMode === 'boxes') {
      const boxMap = renderBoxesMapView(filteredItems, {
        onSelectBox: (boxNumber) => {
          this.state.query = `cx ${boxNumber}`;
          this.state.viewMode = 'grid';
          this.render();
        },
        onEditItem: (prod) => {
          productFormModal.open(prod, async () => {
            await this.refreshItems();
          });
        },
      });
      this.mainContainer.appendChild(boxMap);
    }

    // 4. Status Bar
    const uniqueBoxes = new Set(this.allItems.map(i => i.boxNumber || i.internalCode).filter(Boolean));
    this.statusBar.innerHTML = `
      <div class="flex items-center gap-3">
        <span>Catálogo: <strong>${this.allItems.length} itens</strong></span>
        <span>•</span>
        <span>Caixas: <strong>${uniqueBoxes.size} ativas</strong></span>
        <span>•</span>
        <span>Exibindo: <strong>${filteredItems.length} peças</strong></span>
      </div>
      <div class="flex items-center gap-2">
        <span>Busca: <strong>${searchElapsed.toFixed(1)}ms</strong></span>
        <span>•</span>
        <span class="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-bold">
          <span class="w-2 h-2 rounded-full bg-green-500"></span> 100% Offline
        </span>
      </div>
    `;
  }

  private async refreshItems(): Promise<void> {
    this.allItems = await catalogDb.getAllProducts();
    this.searchEngine.setItems(this.allItems);
    this.render();
  }
}

// Inicializar quando o DOM estiver pronto ou imediatamente se já carregado
function startApp(): void {
  const app = new CatalogApp();
  app.init().catch(err => {
    console.error('Falha ao inicializar CatalogApp:', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
