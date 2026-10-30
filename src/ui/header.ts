/**
 * src/ui/header.ts
 * Header de Balcão com Componente Estável (Nunca Destrói o Input de Busca ao Digitar)
 */

import { CatalogFilterState, ViewMode } from '../types/catalog';
import { icons } from './icons';

export interface HeaderCallbacks {
  onFilterChange: (filters: Partial<CatalogFilterState>) => void;
  onOpenAddModal: () => void;
  onOpenBackupModal: () => void;
}

export class HeaderComponent {
  private container: HTMLElement;
  private state: CatalogFilterState;
  private callbacks: HeaderCallbacks;
  private omniInput!: HTMLInputElement;
  private clearBtn!: HTMLButtonElement;
  private viewBtns!: NodeListOf<HTMLButtonElement>;
  private catPills!: NodeListOf<HTMLButtonElement>;
  private makeFilter!: HTMLSelectElement;
  private specFilter!: HTMLSelectElement;
  private privacyBtn!: HTMLButtonElement;
  private themeBtn!: HTMLButtonElement;

  constructor(
    container: HTMLElement,
    state: CatalogFilterState,
    callbacks: HeaderCallbacks,
    categories: string[],
    manufacturers: string[],
    specs: string[]
  ) {
    this.container = container;
    this.state = { ...state };
    this.callbacks = callbacks;
    this.renderInitial(categories, manufacturers, specs);
  }

  private renderInitial(categories: string[], manufacturers: string[], specs: string[]): void {
    this.container.innerHTML = `
      <header class="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b-2 border-neutral-300 dark:border-neutral-800 shadow-sm">
        <!-- Barra Superior Principal -->
        <div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <!-- Logo e Título -->
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-600 text-white rounded-xl shadow-md">
              ${icons.zap}
            </div>
            <div>
              <h1 class="text-base font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
                CATÁLOGO DE BALCÃO <span class="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded font-mono font-bold">INTERRUPTORES & CAPAS</span>
              </h1>
              <p class="text-[11px] text-neutral-500 font-medium">
                Localizador Visual de Caixas Físicas • Busca Sub-50ms • Multi-Ângulos WebP
              </p>
            </div>
          </div>

          <!-- Omnibox Central com Botão Limpar Proeminente -->
          <div class="flex-1 max-w-xl min-w-[280px]">
            <div class="relative flex items-center">
              <span class="absolute left-3 text-neutral-400 dark:text-neutral-500 pointer-events-none">
                ${icons.search}
              </span>
              <input
                type="text"
                id="omnibox-input"
                value="${this.state.query}"
                placeholder="Digite o Nº da Caixa (ex: 21, 01), Código (IM-34750, DP-7.078) ou Peça/Carro..."
                class="w-full pl-10 pr-28 py-2.5 text-sm font-semibold bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 focus:border-blue-600 dark:focus:border-blue-500 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-neutral-900 text-neutral-900 dark:text-white transition shadow-inner placeholder:text-neutral-400"
                autocomplete="off"
                spellcheck="false"
              />
              <button
                id="clear-search-btn"
                type="button"
                class="absolute right-2 flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-neutral-700 dark:text-neutral-200 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-lg transition shadow-sm ${this.state.query ? '' : 'hidden'}"
                title="Limpar pesquisa (Esc)"
              >
                <span class="w-3.5 h-3.5 flex items-center">${icons.close}</span>
                <span>Limpar</span>
              </button>
            </div>
          </div>

          <!-- Ações Rápidas: View Mode, Privacidade, Tema, Backup e Novo -->
          <div class="flex items-center gap-2">
            <!-- View Mode Switcher -->
            <div class="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-300 dark:border-neutral-700">
              <button
                class="view-mode-btn p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${this.state.viewMode === 'grid' ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}"
                data-mode="grid"
                title="Grade Detalhada de Balcão"
              >
                ${icons.grid} <span class="hidden sm:inline">Grade</span>
              </button>
              <button
                class="view-mode-btn p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${this.state.viewMode === 'mural' ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}"
                data-mode="mural"
                title="Mural Comparador de Amostra (Fotos Grandes)"
              >
                ${icons.mural} <span class="hidden sm:inline">Mural</span>
              </button>
              <button
                class="view-mode-btn p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${this.state.viewMode === 'boxes' ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}"
                data-mode="boxes"
                title="Mapa Geral de Caixas"
              >
                ${icons.boxes} <span class="hidden sm:inline">Caixas</span>
              </button>
            </div>

            <!-- Privacy Toggle (Ocultar / Mostrar Preços) -->
            <button
              id="toggle-privacy-btn"
              class="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 rounded-xl border border-neutral-300 dark:border-neutral-700 transition"
              title="${this.state.hidePrices ? 'Mostrar Preços ao Cliente' : 'Ocultar Preços no Balcão'}"
            >
              ${this.state.hidePrices ? icons.eyeOff : icons.eye}
            </button>

            <!-- Daylight Counter Mode / Dark Mode -->
            <button
              id="toggle-theme-btn"
              class="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 rounded-xl border border-neutral-300 dark:border-neutral-700 transition"
              title="Alternar Modo Claro (Daylight Industrial) / Modo Escuro"
            >
              ${this.state.darkMode ? icons.sun : icons.moon}
            </button>

            <!-- Backup -->
            <button
              id="open-backup-btn"
              class="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 rounded-xl border border-neutral-300 dark:border-neutral-700 transition"
              title="Backup e Restauração de Dados"
            >
              ${icons.shield}
            </button>

            <!-- Novo Produto -->
            <button
              id="open-add-btn"
              class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0"
            >
              ${icons.plus} <span>Cadastrar Peça</span>
            </button>
          </div>
        </div>

        <!-- Barra de Filtros Rápidos de 1 Clique -->
        <div class="max-w-7xl mx-auto px-4 py-2 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-2 overflow-x-auto text-xs">
          <span class="text-neutral-400 font-bold uppercase text-[10px] tracking-wider shrink-0">Categorias:</span>
          <button class="cat-pill px-2.5 py-1 rounded-full font-bold transition ${this.state.category === 'Todos' ? 'bg-blue-600 text-white shadow-sm' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'}" data-cat="Todos">
            Todas (${categories.length})
          </button>
          ${categories.map(c => `
            <button class="cat-pill px-2.5 py-1 rounded-full font-bold transition shrink-0 ${this.state.category === c ? 'bg-blue-600 text-white shadow-sm' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'}" data-cat="${c}">
              ${c}
            </button>
          `).join('')}

          <div class="h-4 w-[1px] bg-neutral-300 dark:bg-neutral-700 mx-1 shrink-0"></div>

          <!-- Filtro Montadoras -->
          <span class="text-neutral-400 font-bold uppercase text-[10px] tracking-wider shrink-0">Montadora:</span>
          <select id="header-make-filter" class="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-700 dark:text-neutral-300 focus:outline-none">
            <option value="Todos">Todas as Montadoras</option>
            ${manufacturers.map(m => `<option value="${m}" ${this.state.manufacturer === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>

          <!-- Filtro Especificações -->
          <span class="text-neutral-400 font-bold uppercase text-[10px] tracking-wider shrink-0">Espec:</span>
          <select id="header-spec-filter" class="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-700 dark:text-neutral-300 focus:outline-none">
            <option value="Todos">Todas as Especificações</option>
            ${specs.map(s => `<option value="${s}" ${this.state.spec === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </header>
    `;

    this.omniInput = this.container.querySelector('#omnibox-input') as HTMLInputElement;
    this.clearBtn = this.container.querySelector('#clear-search-btn') as HTMLButtonElement;
    this.viewBtns = this.container.querySelectorAll('.view-mode-btn');
    this.catPills = this.container.querySelectorAll('.cat-pill');
    this.makeFilter = this.container.querySelector('#header-make-filter') as HTMLSelectElement;
    this.specFilter = this.container.querySelector('#header-spec-filter') as HTMLSelectElement;
    this.privacyBtn = this.container.querySelector('#toggle-privacy-btn') as HTMLButtonElement;
    this.themeBtn = this.container.querySelector('#toggle-theme-btn') as HTMLButtonElement;
    const backupBtn = this.container.querySelector('#open-backup-btn') as HTMLButtonElement;
    const addBtn = this.container.querySelector('#open-add-btn') as HTMLButtonElement;

    // Digitação fluida ininterrupta (o input nunca perde o foco!)
    this.omniInput.addEventListener('input', () => {
      const val = this.omniInput.value;
      this.clearBtn.classList.toggle('hidden', val.length === 0);
      this.callbacks.onFilterChange({ query: val });
    });

    // Tecla Escape limpa instantaneamente
    this.omniInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.omniInput.value) {
        e.preventDefault();
        this.clearSearch();
      }
    });

    // Clique no botão Limpar
    this.clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.clearSearch();
    });

    // View Mode buttons
    this.viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as ViewMode;
        if (mode) this.callbacks.onFilterChange({ viewMode: mode });
      });
    });

    // Categorias
    this.catPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const cat = pill.getAttribute('data-cat') || 'Todos';
        this.callbacks.onFilterChange({ category: cat });
      });
    });

    // Select Montadoras
    this.makeFilter.addEventListener('change', () => {
      this.callbacks.onFilterChange({ manufacturer: this.makeFilter.value });
    });

    // Select Especificações
    this.specFilter.addEventListener('change', () => {
      this.callbacks.onFilterChange({ spec: this.specFilter.value });
    });

    // Privacidade
    this.privacyBtn.addEventListener('click', () => {
      this.callbacks.onFilterChange({ hidePrices: !this.state.hidePrices });
    });

    // Tema
    this.themeBtn.addEventListener('click', () => {
      this.callbacks.onFilterChange({ darkMode: !this.state.darkMode });
    });

    // Backup & Add
    backupBtn.addEventListener('click', () => this.callbacks.onOpenBackupModal());
    addBtn.addEventListener('click', () => this.callbacks.onOpenAddModal());
  }

  public clearSearch(): void {
    this.omniInput.value = '';
    this.clearBtn.classList.add('hidden');
    this.omniInput.focus();
    this.callbacks.onFilterChange({ query: '' });
  }

  public setQuery(query: string): void {
    if (this.omniInput.value !== query) {
      this.omniInput.value = query;
      this.clearBtn.classList.toggle('hidden', query.length === 0);
    }
  }

  /**
   * Atualiza os estados visuais (pills ativas, botões de modo, tema)
   * SEM destruir ou desfoque do input de busca!
   */
  public updateState(newState: CatalogFilterState): void {
    this.state = { ...newState };

    // Sincroniza query se foi alterada externamente
    if (this.omniInput.value !== this.state.query) {
      this.omniInput.value = this.state.query;
      this.clearBtn.classList.toggle('hidden', this.state.query.length === 0);
    }

    // Atualiza botões de modo
    this.viewBtns.forEach(btn => {
      const mode = btn.getAttribute('data-mode');
      const isActive = mode === this.state.viewMode;
      btn.className = `view-mode-btn p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${isActive ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}`;
    });

    // Atualiza pills de categoria
    this.catPills.forEach(pill => {
      const cat = pill.getAttribute('data-cat');
      const isActive = cat === this.state.category;
      pill.className = `cat-pill px-2.5 py-1 rounded-full font-bold transition shrink-0 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'}`;
    });

    // Atualiza selects
    if (this.makeFilter.value !== this.state.manufacturer) {
      this.makeFilter.value = this.state.manufacturer;
    }
    if (this.specFilter.value !== this.state.spec) {
      this.specFilter.value = this.state.spec;
    }

    // Atualiza ícones de tema e privacidade
    this.privacyBtn.innerHTML = this.state.hidePrices ? icons.eyeOff : icons.eye;
    this.privacyBtn.title = this.state.hidePrices ? 'Mostrar Preços ao Cliente' : 'Ocultar Preços no Balcão';

    this.themeBtn.innerHTML = this.state.darkMode ? icons.sun : icons.moon;
  }
}
