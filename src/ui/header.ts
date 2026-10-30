/**
 * src/ui/header.ts
 * Header de Balcão de Alta Produtividade e Filtros Rápidos de 1 Clique
 */

import { CatalogFilterState, ViewMode } from '../types/catalog';
import { icons } from './icons';

export interface HeaderCallbacks {
  onFilterChange: (filters: Partial<CatalogFilterState>) => void;
  onOpenAddModal: () => void;
  onOpenBackupModal: () => void;
}

export function renderHeader(
  state: CatalogFilterState,
  callbacks: HeaderCallbacks,
  categories: string[],
  manufacturers: string[],
  specs: string[]
): HTMLElement {
  const header = document.createElement('header');
  header.className = 'sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b-2 border-neutral-300 dark:border-neutral-800 shadow-sm';

  header.innerHTML = `
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

      <!-- Omnibox Central -->
      <div class="flex-1 max-w-xl min-w-[280px]">
        <div class="relative flex items-center">
          <span class="absolute left-3 text-neutral-400 dark:text-neutral-500 pointer-events-none">
            ${icons.search}
          </span>
          <input
            type="text"
            id="omnibox-input"
            value="${state.query}"
            placeholder="Digite o Nº da Caixa (ex: 21, 01), Código (IM-34750, DP-7.078) ou Peça/Carro..."
            class="w-full pl-10 pr-24 py-2.5 text-sm font-semibold bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 focus:border-blue-600 dark:focus:border-blue-500 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-neutral-900 text-neutral-900 dark:text-white transition shadow-inner placeholder:text-neutral-400"
            autocomplete="off"
            spellcheck="false"
          />
          <button
            id="clear-search-btn"
            class="absolute right-3 px-2 py-1 text-[11px] font-mono font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition ${state.query ? '' : 'hidden'}"
          >
            LIMPAR
          </button>
        </div>
      </div>

      <!-- Ações Rápidas: View Mode, Privacidade, Tema, Backup e Novo -->
      <div class="flex items-center gap-2">
        <!-- View Mode Switcher -->
        <div class="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-300 dark:border-neutral-700">
          <button
            class="view-mode-btn p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${state.viewMode === 'grid' ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}"
            data-mode="grid"
            title="Grade Detalhada de Balcão"
          >
            ${icons.grid} <span class="hidden sm:inline">Grade</span>
          </button>
          <button
            class="view-mode-btn p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${state.viewMode === 'mural' ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}"
            data-mode="mural"
            title="Mural Comparador de Amostra (Fotos Grandes)"
          >
            ${icons.mural} <span class="hidden sm:inline">Mural</span>
          </button>
          <button
            class="view-mode-btn p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${state.viewMode === 'boxes' ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'}"
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
          title="${state.hidePrices ? 'Mostrar Preços ao Cliente' : 'Ocultar Preços no Balcão'}"
        >
          ${state.hidePrices ? icons.eyeOff : icons.eye}
        </button>

        <!-- Daylight Counter Mode / Dark Mode -->
        <button
          id="toggle-theme-btn"
          class="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 rounded-xl border border-neutral-300 dark:border-neutral-700 transition"
          title="Alternar Modo Claro (Daylight Industrial) / Modo Escuro"
        >
          ${state.darkMode ? icons.sun : icons.moon}
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
      <button class="cat-pill px-2.5 py-1 rounded-full font-bold transition ${state.category === 'Todos' ? 'bg-blue-600 text-white shadow-sm' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'}" data-cat="Todos">
        Todas (${categories.length})
      </button>
      ${categories.map(c => `
        <button class="cat-pill px-2.5 py-1 rounded-full font-bold transition shrink-0 ${state.category === c ? 'bg-blue-600 text-white shadow-sm' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'}" data-cat="${c}">
          ${c}
        </button>
      `).join('')}

      <div class="h-4 w-[1px] bg-neutral-300 dark:bg-neutral-700 mx-1 shrink-0"></div>

      <!-- Filtro Montadoras -->
      <span class="text-neutral-400 font-bold uppercase text-[10px] tracking-wider shrink-0">Montadora:</span>
      <select id="header-make-filter" class="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-700 dark:text-neutral-300 focus:outline-none">
        <option value="Todos">Todas as Montadoras</option>
        ${manufacturers.map(m => `<option value="${m}" ${state.manufacturer === m ? 'selected' : ''}>${m}</option>`).join('')}
      </select>

      <!-- Filtro Especificações -->
      <span class="text-neutral-400 font-bold uppercase text-[10px] tracking-wider shrink-0">Espec:</span>
      <select id="header-spec-filter" class="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-700 dark:text-neutral-300 focus:outline-none">
        <option value="Todos">Todas as Especificações</option>
        ${specs.map(s => `<option value="${s}" ${state.spec === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
  `;

  // Listeners
  const omniInput = header.querySelector('#omnibox-input') as HTMLInputElement;
  const clearBtn = header.querySelector('#clear-search-btn') as HTMLElement;
  const viewBtns = header.querySelectorAll('.view-mode-btn');
  const catPills = header.querySelectorAll('.cat-pill');
  const makeFilter = header.querySelector('#header-make-filter') as HTMLSelectElement;
  const specFilter = header.querySelector('#header-spec-filter') as HTMLSelectElement;
  const privacyBtn = header.querySelector('#toggle-privacy-btn');
  const themeBtn = header.querySelector('#toggle-theme-btn');
  const backupBtn = header.querySelector('#open-backup-btn');
  const addBtn = header.querySelector('#open-add-btn');

  omniInput.addEventListener('input', () => {
    const val = omniInput.value;
    clearBtn.classList.toggle('hidden', val.length === 0);
    callbacks.onFilterChange({ query: val });
  });

  clearBtn.addEventListener('click', () => {
    omniInput.value = '';
    clearBtn.classList.add('hidden');
    omniInput.focus();
    callbacks.onFilterChange({ query: '' });
  });

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode') as ViewMode;
      if (mode) callbacks.onFilterChange({ viewMode: mode });
    });
  });

  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const cat = pill.getAttribute('data-cat') || 'Todos';
      callbacks.onFilterChange({ category: cat });
    });
  });

  makeFilter.addEventListener('change', () => {
    callbacks.onFilterChange({ manufacturer: makeFilter.value });
  });

  specFilter.addEventListener('change', () => {
    callbacks.onFilterChange({ spec: specFilter.value });
  });

  privacyBtn?.addEventListener('click', () => {
    callbacks.onFilterChange({ hidePrices: !state.hidePrices });
  });

  themeBtn?.addEventListener('click', () => {
    callbacks.onFilterChange({ darkMode: !state.darkMode });
  });

  backupBtn?.addEventListener('click', () => callbacks.onOpenBackupModal());
  addBtn?.addEventListener('click', () => callbacks.onOpenAddModal());

  return header;
}
