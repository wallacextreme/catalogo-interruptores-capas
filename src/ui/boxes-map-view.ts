/**
 * src/ui/boxes-map-view.ts
 * Visualizador de Mapa Geral de Caixas Físicas (01 a 99+)
 */

import { ProductItem } from '../types/catalog';
import { icons } from './icons';

export interface BoxesMapViewCallbacks {
  onSelectBox: (boxNumber: string) => void;
  onEditItem: (item: ProductItem) => void;
}

export function renderBoxesMapView(
  items: ProductItem[],
  callbacks: BoxesMapViewCallbacks
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 p-4';

  // Agrupar produtos por Caixa
  const boxGroups = new Map<string, ProductItem[]>();

  items.forEach(item => {
    const boxKey = item.boxNumber || item.internalCode || 'S/CX';
    const list = boxGroups.get(boxKey) || [];
    list.push(item);
    boxGroups.set(boxKey, list);
  });

  // Ordenar caixas numericamente quando possível
  const sortedBoxKeys = Array.from(boxGroups.keys()).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });

  const headerSummary = `
    <div class="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl shadow-sm">
      <div class="flex items-center gap-3">
        <div class="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg">
          ${icons.boxes}
        </div>
        <div>
          <h2 class="text-base font-bold text-neutral-900 dark:text-white">Mapa Geral de Caixas Físicas do Balcão</h2>
          <p class="text-xs text-neutral-500">Total de <strong>${sortedBoxKeys.length} caixas ativas</strong> guardando <strong>${items.length} itens</strong> catalogados.</p>
        </div>
      </div>
    </div>
  `;

  const gridBoxes = document.createElement('div');
  gridBoxes.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';

  sortedBoxKeys.forEach(boxKey => {
    const boxItems = boxGroups.get(boxKey) || [];
    const boxCard = document.createElement('div');
    boxCard.className = 'flex flex-col bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm hover:border-blue-600 transition';

    let boxBadgeBg = 'bg-blue-700 text-white';
    const bNum = parseInt(boxKey, 10);
    if (!isNaN(bNum)) {
      if (bNum > 20 && bNum <= 50) boxBadgeBg = 'bg-emerald-700 text-white';
      else if (bNum > 50) boxBadgeBg = 'bg-amber-700 text-white';
    } else if (boxKey.startsWith('BO')) {
      boxBadgeBg = 'bg-indigo-700 text-white';
    }

    boxCard.innerHTML = `
      <div class="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center px-2.5 py-1 rounded-lg font-mono text-lg font-black shadow-sm ${boxBadgeBg}">
            CAIXA ${boxKey}
          </span>
          <span class="text-xs text-neutral-500 font-bold">
            ${boxItems.length} ${boxItems.length === 1 ? 'peça' : 'peças'}
          </span>
        </div>
        <button class="filter-this-box-btn px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition" data-box="${boxKey}">
          Filtrar nesta Caixa
        </button>
      </div>

      <div class="p-3 divide-y divide-neutral-100 dark:divide-neutral-800 flex-1 max-h-72 overflow-y-auto">
        ${boxItems.map(item => `
          <div class="py-2 flex items-center justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 px-1 rounded transition">
            <div class="flex items-center gap-2 min-w-0">
              <img
                src="${item.images[0] || '/placeholder-part.webp'}"
                alt="${item.commercialCode}"
                class="w-10 h-10 object-contain bg-white rounded border border-neutral-200 p-0.5 shrink-0"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="font-mono text-xs font-black text-neutral-900 dark:text-white">
                    ${item.commercialCode}
                  </span>
                  ${item.internalCode ? `
                    <span class="text-[10px] font-mono px-1 bg-neutral-200 dark:bg-neutral-700 rounded text-neutral-700 dark:text-neutral-300">
                      ${item.internalCode}
                    </span>
                  ` : ''}
                </div>
                <p class="text-[11px] text-neutral-500 truncate" title="${item.description}">
                  ${item.description || item.category}
                </p>
              </div>
            </div>
            <button class="edit-item-quick-btn p-1 text-neutral-400 hover:text-blue-600 rounded transition shrink-0" data-id="${item.id}" title="Editar Peça">
              ${icons.edit}
            </button>
          </div>
        `).join('')}
      </div>
    `;

    boxCard.querySelector('.filter-this-box-btn')?.addEventListener('click', () => {
      callbacks.onSelectBox(boxKey);
    });

    boxCard.querySelectorAll('.edit-item-quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const found = items.find(i => i.id === id);
        if (found) callbacks.onEditItem(found);
      });
    });

    gridBoxes.appendChild(boxCard);
  });

  container.innerHTML = headerSummary;
  container.appendChild(gridBoxes);
  return container;
}
