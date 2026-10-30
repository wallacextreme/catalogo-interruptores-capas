/**
 * src/ui/product-card.ts
 * Card de Balcão Industrial (Daylight Counter Mode + Alto Contraste + Badge Gigante de Caixa)
 */

import { ProductItem } from '../types/catalog';
import { icons } from './icons';
import { lightbox } from './lightbox';

export interface ProductCardCallbacks {
  onEdit: (item: ProductItem) => void;
  onQuickBoxChange: (item: ProductItem, newBox: string) => void;
}

export function renderProductCard(
  item: ProductItem,
  hidePrices: boolean,
  callbacks: ProductCardCallbacks
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'group relative flex flex-col bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-600 dark:hover:border-blue-500 transition duration-150';
  card.setAttribute('data-id', item.id);

  // Seleção de cor de alto contraste para a Caixa
  let boxBadgeColor = 'bg-blue-700 text-white border-blue-900';
  const boxNumInt = parseInt(item.boxNumber, 10);
  if (!isNaN(boxNumInt)) {
    if (boxNumInt >= 1 && boxNumInt <= 20) {
      boxBadgeColor = 'bg-blue-700 text-white border-blue-900'; // Azul Royal
    } else if (boxNumInt > 20 && boxNumInt <= 50) {
      boxBadgeColor = 'bg-emerald-700 text-white border-emerald-900'; // Verde Esmeralda
    } else {
      boxBadgeColor = 'bg-amber-700 text-white border-amber-900'; // Âmbar Industrial
    }
  } else if (item.internalCode.startsWith('BO')) {
    boxBadgeColor = 'bg-indigo-700 text-white border-indigo-900';
  }

  const primaryImage = item.images && item.images.length > 0 ? item.images[0] : '/placeholder-part.webp';
  const hasMultipleImages = item.images && item.images.length > 1;

  // Header do Card: BADGE GIGANTE DA CAIXA + Botão Edição Rápida
  const cardHeader = `
    <div class="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700">
      <div class="flex items-center gap-2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border shadow-sm ${boxBadgeColor}">
          <span class="text-xs uppercase font-extrabold tracking-wider opacity-90">LOCAL:</span>
          <span class="font-mono text-2xl font-black tracking-tight leading-none">${item.boxDisplay || (item.boxNumber ? 'CX ' + item.boxNumber : 'S/CX')}</span>
        </div>
        ${item.internalCode ? `
          <span class="px-2 py-0.5 text-xs font-mono font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded">
            ${item.internalCode}
          </span>
        ` : ''}
      </div>
      <button class="quick-edit-box-btn p-1.5 text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition" title="Alterar Caixa Rapidamente">
        ${icons.edit}
      </button>
    </div>
  `;

  // Imagem Principal com Lightbox e Carrossel
  const imageSection = `
    <div class="relative bg-white flex items-center justify-center p-3 h-52 overflow-hidden border-b border-neutral-100 dark:border-neutral-800 cursor-zoom-in group/img">
      <img
        src="${primaryImage}"
        alt="${item.commercialCode} - ${item.description}"
        loading="lazy"
        class="main-card-img max-h-full max-w-full object-contain transition-transform duration-200 group-hover/img:scale-105"
      />
      <div class="absolute bottom-2 right-2 bg-neutral-900/70 text-white text-xs px-2 py-1 rounded backdrop-blur opacity-0 group-hover/img:opacity-100 transition flex items-center gap-1 font-mono">
        ${icons.zoomIn} <span>Zoom</span>
      </div>
      ${hasMultipleImages ? `
        <div class="absolute bottom-2 left-2 flex gap-1 bg-neutral-900/60 p-1 rounded backdrop-blur">
          ${item.images.map((img, idx) => `
            <button class="thumb-carousel-btn w-6 h-6 rounded border border-white/40 overflow-hidden ${idx === 0 ? 'ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100'}" data-img="${img}" data-idx="${idx}">
              <img src="${img}" class="w-full h-full object-cover" />
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  // Corpo do Card: Código Comercial, Badges Técnicos e Aplicações
  const crossBadges = item.crossReferenceCodes.map(c => `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
      ${c}
    </span>
  `).join('');

  const oemBadges = item.oemCodes.map(o => `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded">
      OEM: ${o}
    </span>
  `).join('');

  const specBadges = item.specs.map(s => `
    <span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded">
      ${s}
    </span>
  `).join('');

  const vehicleBadges = item.vehicles.slice(0, 5).map(v => `
    <span class="inline-flex items-center px-1.5 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded font-medium">
      ${v}
    </span>
  `).join('');

  const priceSection = hidePrices ? '' : `
    <div class="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
      <span class="text-xs text-neutral-500 font-semibold uppercase">Preço Balcão:</span>
      <span class="text-sm font-bold text-neutral-900 dark:text-white font-mono">
        ${item.price !== null && item.price !== undefined ? `R$ ${item.price.toFixed(2).replace('.', ',')}` : 'Sob Consulta'}
      </span>
    </div>
  `;

  card.innerHTML = `
    ${cardHeader}
    ${imageSection}
    <div class="p-3 flex-1 flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-extrabold uppercase px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded">
              ${item.partBrand || 'Padrão'}
            </span>
            <span class="font-mono text-base font-black text-neutral-900 dark:text-white select-all">
              ${item.commercialCode}
            </span>
          </div>
          <button class="copy-code-btn p-1 text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition" title="Copiar Código Principal">
            ${icons.copy}
          </button>
        </div>

        ${crossBadges || oemBadges ? `
          <div class="flex flex-wrap gap-1 mb-2">
            ${crossBadges}
            ${oemBadges}
          </div>
        ` : ''}

        <p class="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium line-clamp-3 mb-2" title="${item.description}">
          ${item.description || '[Sem descrição cadastrada]'}
        </p>

        ${specBadges ? `
          <div class="flex flex-wrap gap-1 mb-2">
            ${specBadges}
          </div>
        ` : ''}

        ${vehicleBadges ? `
          <div class="flex flex-wrap items-center gap-1 mb-1">
            <span class="text-neutral-400 dark:text-neutral-500">${icons.car}</span>
            ${vehicleBadges}
            ${item.vehicles.length > 5 ? `<span class="text-xs text-neutral-400">+${item.vehicles.length - 5}</span>` : ''}
          </div>
        ` : ''}
      </div>

      <div>
        ${priceSection}
        <div class="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <span class="text-[11px] text-neutral-400 font-mono truncate max-w-[140px]" title="${item.category}">
            ${item.category}
          </span>
          <button class="edit-full-prod-btn inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 rounded-lg transition shadow-sm">
            ${icons.edit} <span>Editar / + Foto</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Eventos do Card
  const imgContainer = card.querySelector('.group\\/img') as HTMLElement;
  const mainImg = card.querySelector('.main-card-img') as HTMLImageElement;
  const copyBtn = card.querySelector('.copy-code-btn') as HTMLElement;
  const quickEditBtn = card.querySelector('.quick-edit-box-btn') as HTMLElement;
  const fullEditBtn = card.querySelector('.edit-full-prod-btn') as HTMLElement;
  const thumbBtns = card.querySelectorAll('.thumb-carousel-btn');

  // Abre Lightbox ao clicar na imagem
  imgContainer?.addEventListener('click', (e) => {
    // Se não clicou num botão de thumbnail
    if (!(e.target as HTMLElement).closest('.thumb-carousel-btn')) {
      const activeIdx = item.images.indexOf(mainImg.src);
      lightbox.open(item.images, activeIdx >= 0 ? activeIdx : 0, `${item.boxDisplay} — ${item.commercialCode} (${item.description})`);
    }
  });

  // Troca imagem principal pelo thumbnail
  thumbBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetImg = btn.getAttribute('data-img');
      if (targetImg) {
        mainImg.src = targetImg;
        thumbBtns.forEach(b => b.classList.remove('ring-2', 'ring-blue-500'));
        btn.classList.add('ring-2', 'ring-blue-500');
      }
    });
  });

  // Copia código com feedback visual
  copyBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.commercialCode);
      copyBtn.innerHTML = icons.check;
      copyBtn.classList.add('text-green-600');
      setTimeout(() => {
        copyBtn.innerHTML = icons.copy;
        copyBtn.classList.remove('text-green-600');
      }, 1500);
    } catch {
      // Fallback
    }
  });

  // Edição rápida de caixa
  quickEditBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const newBox = prompt(`Alterar número da caixa para "${item.commercialCode}":`, item.boxNumber || item.internalCode);
    if (newBox !== null && newBox.trim() !== '') {
      callbacks.onQuickBoxChange(item, newBox.trim());
    }
  });

  // Edição completa (Modal CRUD)
  fullEditBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onEdit(item);
  });

  return card;
}
