/**
 * src/ui/product-form-modal.ts
 * Modal CRUD Completo de Cadastro, Edição e Galeria Multi-Ângulos (Ctrl+V / Drag & Drop)
 */

import { ProductItem } from '../types/catalog';
import { catalogDb } from '../db/catalog-db';
import { convertBlobToStudioWebp, extractImageFromClipboardEvent } from '../media/webp-converter';
import { icons } from './icons';

export class ProductFormModal {
  private overlay: HTMLElement;
  private currentItem: ProductItem | null = null;
  private onSaveCallback: ((saved: ProductItem) => void) | null = null;
  private tempImages: string[] = [];

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm hidden flex items-center justify-center p-4 overflow-y-auto';
    this.overlay.innerHTML = `
      <div class="relative w-full max-w-3xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-2xl shadow-2xl overflow-hidden my-8" id="product-modal-card">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div class="flex items-center gap-2">
            <span class="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg">
              ${icons.edit}
            </span>
            <h2 id="modal-title" class="text-lg font-bold text-neutral-900 dark:text-white">
              Editar Peça de Balcão
            </h2>
          </div>
          <button id="modal-close-btn" class="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition">
            ${icons.close}
          </button>
        </div>

        <!-- Form Body -->
        <form id="product-modal-form" class="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <!-- Linha 1: Caixa e Código Principal -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-black uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Número da Caixa (CX) *
              </label>
              <input
                type="text"
                id="form-box-number"
                required
                placeholder="Ex: 21, 01, 67"
                class="w-full px-3 py-2 text-lg font-mono font-black bg-neutral-50 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Código Interno (Opcional)
              </label>
              <input
                type="text"
                id="form-internal-code"
                placeholder="Ex: BO21, MU392"
                class="w-full px-3 py-2 font-mono font-bold bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-black uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Código Principal (Comercial) *
              </label>
              <input
                type="text"
                id="form-commercial-code"
                required
                placeholder="Ex: K3041750, DP-7.078"
                class="w-full px-3 py-2 font-mono font-black text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <!-- Linha 2: Marca / Fabricante e Categoria -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Marca / Fabricante da Peça
              </label>
              <input
                type="text"
                id="form-part-brand"
                placeholder="Ex: Kostal, Marília, D'Paula, DNI, Ospina"
                class="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Categoria
              </label>
              <select
                id="form-category"
                class="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              >
                <option value="Capas e Botões">Capas e Botões (Ar, Farol, Retrovisor)</option>
                <option value="Botão Falso">Botão Falso de Painel</option>
                <option value="Moldura de Interruptor">Moldura de Interruptor</option>
                <option value="Interruptor de Alerta">Interruptor de Alerta</option>
                <option value="Interruptor de Farol">Interruptor de Farol</option>
                <option value="Comutador de Farol">Comutador de Farol</option>
                <option value="Interruptor de Porta">Interruptor de Porta</option>
                <option value="Interruptor de Freio de Mão">Interruptor de Freio de Mão</option>
                <option value="Farol de Milha / Auxiliar">Farol de Milha / Auxiliar</option>
                <option value="Interruptores Diversos">Interruptores Diversos (Vidro, Ventilador, Tic-Tac, Trava)</option>
              </select>
            </div>
          </div>

          <!-- Linha 3: Códigos Cruzados e OEM -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Códigos Cruzados / Equivalentes (Separados por vírgula)
              </label>
              <input
                type="text"
                id="form-cross-codes"
                placeholder="Ex: IM-34750, 9341, DTC2116"
                class="w-full px-3 py-2 font-mono text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Números Originais / OEM (Separados por vírgula)
              </label>
              <input
                type="text"
                id="form-oem-codes"
                placeholder="Ex: 307.941.535.1, ZBC.941.535"
                class="w-full px-3 py-2 font-mono text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <!-- Linha 4: Descrição e Aplicação -->
          <div>
            <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
              Descrição e Aplicação Veicular *
            </label>
            <textarea
              id="form-description"
              rows="3"
              required
              placeholder="Ex: Interruptor de Farol de Milha Gol/Parati/Saveiro G3 1999/..."
              class="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
            ></textarea>
          </div>

          <!-- Linha 5: Especificações Técnicas e Preço -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Especificações Técnicas (Separadas por vírgula)
              </label>
              <input
                type="text"
                id="form-specs"
                placeholder="Ex: 1 Estágio, 3 Pinos, Com LED, Regulável"
                class="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
                Preço Balcão (R$) (Opcional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                id="form-price"
                placeholder="0.00"
                class="w-full px-3 py-2 font-mono font-bold bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <!-- Galeria de Fotos e Área de Colar Ctrl+V -->
          <div>
            <label class="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-1">
              Galeria de Fotos WebP (Suporta Ctrl+V, Drag & Drop ou Envio de Arquivo)
            </label>
            
            <div
              id="drop-paste-zone"
              class="border-2 border-dashed border-blue-400 dark:border-blue-600 hover:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
            >
              <div class="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-full">
                ${icons.image}
              </div>
              <p class="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Pressione <strong>Ctrl + V</strong> para colar foto da área de transferência ou <strong>arraste um arquivo aqui</strong>
              </p>
              <p class="text-xs text-neutral-500">
                A foto será convertida automaticamente no cliente para <strong>.WebP Studio de alta nitidez (#FFFFFF)</strong>.
              </p>
              <input type="file" id="form-file-picker" accept="image/*" class="hidden" />
            </div>

            <div id="modal-photos-grid" class="flex flex-wrap gap-2 mt-3"></div>
          </div>

          <!-- Footer Buttons -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              id="modal-cancel-btn"
              class="px-4 py-2 text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="px-5 py-2 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition flex items-center gap-1.5"
            >
              ${icons.check} Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.bindEvents();
  }

  private bindEvents(): void {
    const closeBtn = this.overlay.querySelector('#modal-close-btn');
    const cancelBtn = this.overlay.querySelector('#modal-cancel-btn');
    const form = this.overlay.querySelector('#product-modal-form') as HTMLFormElement;
    const dropZone = this.overlay.querySelector('#drop-paste-zone') as HTMLElement;
    const filePicker = this.overlay.querySelector('#form-file-picker') as HTMLInputElement;

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    // File picker trigger
    dropZone.addEventListener('click', () => filePicker.click());
    filePicker.addEventListener('change', async () => {
      if (filePicker.files && filePicker.files[0]) {
        await this.handleImageBlob(filePicker.files[0]);
      }
    });

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-blue-700', 'bg-blue-100/50');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-blue-700', 'bg-blue-100/50');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-blue-700', 'bg-blue-100/50');
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        await this.handleImageBlob(e.dataTransfer.files[0]);
      }
    });

    // Paste (Ctrl+V) listener global quando o modal está aberto
    window.addEventListener('paste', async (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      const blob = await extractImageFromClipboardEvent(e);
      if (blob) {
        e.preventDefault();
        await this.handleImageBlob(blob);
      }
    });

    // Submit form
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveFormData();
    });
  }

  private async handleImageBlob(blob: Blob): Promise<void> {
    try {
      const res = await convertBlobToStudioWebp(blob);
      this.tempImages.push(res.fullDataUrl);
      this.renderPhotosGrid();
    } catch (err) {
      alert('Erro ao converter imagem para WebP: ' + String(err));
    }
  }

  private renderPhotosGrid(): void {
    const grid = this.overlay.querySelector('#modal-photos-grid') as HTMLElement;
    grid.innerHTML = '';

    this.tempImages.forEach((imgUrl, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'relative w-20 h-20 bg-white border border-neutral-300 dark:border-neutral-700 rounded-lg p-1 overflow-hidden group shadow-sm flex items-center justify-center';
      thumb.innerHTML = `
        <img src="${imgUrl}" class="max-h-full max-w-full object-contain" />
        <button type="button" class="del-photo-btn absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition shadow">
          ${icons.trash}
        </button>
        ${index === 0 ? '<span class="absolute bottom-1 left-1 text-[9px] font-black bg-blue-600 text-white px-1 rounded">PRINCIPAL</span>' : ''}
      `;

      thumb.querySelector('.del-photo-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tempImages.splice(index, 1);
        this.renderPhotosGrid();
      });

      grid.appendChild(thumb);
    });
  }

  open(item?: ProductItem, onSave?: (saved: ProductItem) => void): void {
    this.currentItem = item || null;
    this.onSaveCallback = onSave || null;
    this.tempImages = item ? [...item.images] : [];

    const titleEl = this.overlay.querySelector('#modal-title') as HTMLElement;
    const boxInput = this.overlay.querySelector('#form-box-number') as HTMLInputElement;
    const internalInput = this.overlay.querySelector('#form-internal-code') as HTMLInputElement;
    const codeInput = this.overlay.querySelector('#form-commercial-code') as HTMLInputElement;
    const brandInput = this.overlay.querySelector('#form-part-brand') as HTMLInputElement;
    const catSelect = this.overlay.querySelector('#form-category') as HTMLSelectElement;
    const crossInput = this.overlay.querySelector('#form-cross-codes') as HTMLInputElement;
    const oemInput = this.overlay.querySelector('#form-oem-codes') as HTMLInputElement;
    const descInput = this.overlay.querySelector('#form-description') as HTMLTextAreaElement;
    const specsInput = this.overlay.querySelector('#form-specs') as HTMLInputElement;
    const priceInput = this.overlay.querySelector('#form-price') as HTMLInputElement;

    if (item) {
      titleEl.textContent = `Editar Peça: ${item.commercialCode} (Caixa ${item.boxNumber || item.internalCode})`;
      boxInput.value = item.boxNumber || '';
      internalInput.value = item.internalCode || '';
      codeInput.value = item.commercialCode || '';
      brandInput.value = item.partBrand || '';
      catSelect.value = item.category || 'Capas e Botões';
      crossInput.value = item.crossReferenceCodes.join(', ');
      oemInput.value = item.oemCodes.join(', ');
      descInput.value = item.description || '';
      specsInput.value = item.specs.join(', ');
      priceInput.value = item.price !== null && item.price !== undefined ? item.price.toString() : '';
    } else {
      titleEl.textContent = 'Cadastrar Novo Interruptor / Capa de Balcão';
      boxInput.value = '';
      internalInput.value = '';
      codeInput.value = '';
      brandInput.value = '';
      catSelect.value = 'Capas e Botões';
      crossInput.value = '';
      oemInput.value = '';
      descInput.value = '';
      specsInput.value = '';
      priceInput.value = '';
    }

    this.renderPhotosGrid();
    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  private async saveFormData(): Promise<void> {
    const boxInput = this.overlay.querySelector('#form-box-number') as HTMLInputElement;
    const internalInput = this.overlay.querySelector('#form-internal-code') as HTMLInputElement;
    const codeInput = this.overlay.querySelector('#form-commercial-code') as HTMLInputElement;
    const brandInput = this.overlay.querySelector('#form-part-brand') as HTMLInputElement;
    const catSelect = this.overlay.querySelector('#form-category') as HTMLSelectElement;
    const crossInput = this.overlay.querySelector('#form-cross-codes') as HTMLInputElement;
    const oemInput = this.overlay.querySelector('#form-oem-codes') as HTMLInputElement;
    const descInput = this.overlay.querySelector('#form-description') as HTMLTextAreaElement;
    const specsInput = this.overlay.querySelector('#form-specs') as HTMLInputElement;
    const priceInput = this.overlay.querySelector('#form-price') as HTMLInputElement;

    const boxNumber = boxInput.value.trim();
    const internalCode = internalInput.value.trim();
    const commercialCode = codeInput.value.trim();
    const partBrand = brandInput.value.trim() || 'Padrão';
    const category = catSelect.value;
    const crossReferenceCodes = crossInput.value.split(',').map(s => s.trim()).filter(Boolean);
    const oemCodes = oemInput.value.split(',').map(s => s.trim()).filter(Boolean);
    const description = descInput.value.trim();
    const specs = specsInput.value.split(',').map(s => s.trim()).filter(Boolean);
    const price = priceInput.value ? parseFloat(priceInput.value) : null;

    const boxDisplay = boxNumber ? `CAIXA ${boxNumber}` : (internalCode ? `CAIXA ${internalCode}` : 'S/CX');

    let itemToSave: ProductItem;
    if (this.currentItem) {
      itemToSave = {
        ...this.currentItem,
        boxNumber,
        internalCode,
        boxDisplay,
        commercialCode,
        partBrand,
        category,
        crossReferenceCodes,
        oemCodes,
        description,
        specs,
        price,
        images: this.tempImages,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const id = `custom-${Date.now()}`;
      itemToSave = {
        id,
        category,
        section: category,
        sourceDocument: 'Cadastro Manual no Balcão',
        boxNumber,
        boxDisplay,
        internalCode,
        commercialCode,
        commercialCodeRaw: commercialCode,
        description,
        specs,
        vehicles: [],
        manufacturers: [],
        partBrand,
        crossReferenceCodes,
        oemCodes,
        searchTokens: [boxNumber.toLowerCase(), commercialCode.toLowerCase()],
        images: this.tempImages,
        price,
        isCustom: true,
        updatedAt: new Date().toISOString(),
      };
    }

    await catalogDb.saveProduct(itemToSave);

    if (this.onSaveCallback) {
      this.onSaveCallback(itemToSave);
    }

    this.close();
  }
}

export const productFormModal = new ProductFormModal();
