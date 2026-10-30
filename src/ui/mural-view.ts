/**
 * src/ui/mural-view.ts
 * Modo Mural Visual Comparador de Amostra (Fotos Grandes para Comparação Lado a Lado)
 */

import { ProductItem } from '../types/catalog';
import { icons } from './icons';
import { lightbox } from './lightbox';

export interface MuralViewCallbacks {
  onEdit: (item: ProductItem) => void;
  onQuickBoxChange: (item: ProductItem, newBox: string) => void;
}

export function renderMuralView(
  items: ProductItem[],
  callbacks: MuralViewCallbacks
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-2';

  if (items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-neutral-400 font-medium">
        Nenhum interruptor ou capa encontrada para esta busca.
      </div>
    `;
    return container;
  }

  items.forEach(item => {
    const tile = document.createElement('div');
    tile.className = 'group relative flex flex-col bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 hover:border-blue-600 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition duration-150 cursor-pointer';

    const primaryImage = item.images && item.images.length > 0 ? item.images[0] : '/placeholder-part.webp';

    // Seleção de cor de alto contraste para a Caixa
    let boxBadgeBg = 'bg-blue-700 text-white';
    const bNum = parseInt(item.boxNumber, 10);
    if (!isNaN(bNum)) {
      if (bNum > 20 && bNum <= 50) boxBadgeBg = 'bg-emerald-700 text-white';
      else if (bNum > 50) boxBadgeBg = 'bg-amber-700 text-white';
    }

    tile.innerHTML = `
      <!-- Badge Gigante Sobreposto -->
      <div class="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <span class="inline-flex items-center px-2 py-0.5 rounded font-mono text-sm font-black shadow-md ${boxBadgeBg}">
          ${item.boxDisplay || (item.boxNumber ? 'CX ' + item.boxNumber : 'S/CX')}
        </span>
      </div>

      <div class="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition">
        <button class="mural-edit-btn p-1.5 bg-neutral-900/80 hover:bg-blue-600 text-white rounded-lg backdrop-blur transition shadow-md" title="Editar Peça">
          ${icons.edit}
        </button>
      </div>

      <!-- Foto Grande de Estúdio -->
      <div class="relative w-full aspect-square bg-white flex items-center justify-center p-3 overflow-hidden">
        <img
          src="${primaryImage}"
          alt="${item.commercialCode}"
          loading="lazy"
          class="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-110"
        />
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
          <span class="opacity-0 group-hover:opacity-100 bg-neutral-900/80 text-white text-xs px-2.5 py-1 rounded-full font-mono flex items-center gap-1 backdrop-blur shadow-md transition">
            ${icons.zoomIn} Zoom 400%
          </span>
        </div>
      </div>

      <!-- Barra Inferior Compacta -->
      <div class="p-2 bg-neutral-50 dark:bg-neutral-800/90 border-t border-neutral-200 dark:border-neutral-700 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs font-black text-neutral-900 dark:text-white truncate">
            ${item.commercialCode}
          </span>
          <span class="text-[10px] text-neutral-500 font-mono">
            ${item.partBrand || ''}
          </span>
        </div>
        <p class="text-[11px] text-neutral-600 dark:text-neutral-300 truncate mt-0.5" title="${item.description}">
          ${item.description || item.category}
        </p>
      </div>
    `;

    // Clicar abre Lightbox
    tile.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.mural-edit-btn')) {
        callbacks.onEdit(item);
        return;
      }
      lightbox.open(item.images, 0, `${item.boxDisplay} — ${item.commercialCode} (${item.description})`);
    });

    container.appendChild(tile);
  });

  return container;
}
