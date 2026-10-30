/**
 * src/ui/lightbox.ts
 * Lightbox Fullscreen com Zoom de 50% a 400% para Inspeção de Pinos e Gravações
 */

import { icons } from './icons';

export class Lightbox {
  private overlay: HTMLElement;
  private imageEl: HTMLImageElement;
  private zoomLevelEl: HTMLElement;
  private captionEl: HTMLElement;
  private currentZoom = 1.0;
  private images: string[] = [];
  private currentIndex = 0;
  private isPanning = false;
  private startX = 0;
  private startY = 0;
  private translateX = 0;
  private translateY = 0;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fixed inset-0 z-50 bg-black/90 backdrop-blur-md hidden flex flex-col items-center justify-between p-4 select-none';
    this.overlay.innerHTML = `
      <div class="w-full flex items-center justify-between text-white py-2 px-4 z-10">
        <div id="lightbox-caption" class="text-sm font-semibold tracking-wide truncate max-w-xl"></div>
        <div class="flex items-center gap-2 bg-neutral-900/80 border border-neutral-700 rounded-lg p-1.5 shadow-lg">
          <button id="lb-zoom-out" class="p-1.5 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded transition" title="Reduzir (-) (50%)">
            ${icons.zoomOut}
          </button>
          <span id="lb-zoom-level" class="text-xs font-mono font-bold px-2 text-neutral-200 min-w-[50px] text-center">100%</span>
          <button id="lb-zoom-in" class="p-1.5 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded transition" title="Ampliar (+) (até 400%)">
            ${icons.zoomIn}
          </button>
          <button id="lb-zoom-reset" class="px-2 py-1 text-xs hover:bg-neutral-800 text-neutral-300 hover:text-white rounded font-mono font-bold transition" title="Redefinir (100%)">
            1:1
          </button>
          <div class="h-4 w-[1px] bg-neutral-700 mx-1"></div>
          <button id="lb-close" class="p-1.5 hover:bg-red-600/80 text-neutral-300 hover:text-white rounded transition" title="Fechar (Esc)">
            ${icons.close}
          </button>
        </div>
      </div>

      <div class="relative flex-1 w-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing" id="lb-viewport">
        <button id="lb-prev" class="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-neutral-900/80 hover:bg-neutral-800 text-white rounded-full border border-neutral-700 shadow-xl transition z-10" title="Foto Anterior (Seta Esquerda)">
          ${icons.chevronLeft}
        </button>
        <img id="lb-img" class="max-w-none transition-transform duration-75 ease-out select-none" draggable="false" />
        <button id="lb-next" class="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-neutral-900/80 hover:bg-neutral-800 text-white rounded-full border border-neutral-700 shadow-xl transition z-10" title="Próxima Foto (Seta Direita)">
          ${icons.chevronRight}
        </button>
      </div>

      <div class="text-xs text-neutral-400 py-1 text-center font-mono">
        Dica: Use a roda do mouse para Zoom (50% a 400%) | Arraste para mover | Use as setas ← → para navegar | Esc para fechar
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.imageEl = this.overlay.querySelector('#lb-img') as HTMLImageElement;
    this.zoomLevelEl = this.overlay.querySelector('#lb-zoom-level') as HTMLElement;
    this.captionEl = this.overlay.querySelector('#lightbox-caption') as HTMLElement;

    this.bindEvents();
  }

  private bindEvents(): void {
    const closeBtn = this.overlay.querySelector('#lb-close');
    const zoomInBtn = this.overlay.querySelector('#lb-zoom-in');
    const zoomOutBtn = this.overlay.querySelector('#lb-zoom-out');
    const zoomResetBtn = this.overlay.querySelector('#lb-zoom-reset');
    const prevBtn = this.overlay.querySelector('#lb-prev');
    const nextBtn = this.overlay.querySelector('#lb-next');
    const viewport = this.overlay.querySelector('#lb-viewport') as HTMLElement;

    closeBtn?.addEventListener('click', () => this.close());
    zoomInBtn?.addEventListener('click', () => this.adjustZoom(0.25));
    zoomOutBtn?.addEventListener('click', () => this.adjustZoom(-0.25));
    zoomResetBtn?.addEventListener('click', () => this.setZoom(1.0));
    prevBtn?.addEventListener('click', () => this.navigate(-1));
    nextBtn?.addEventListener('click', () => this.navigate(1));

    // Mouse wheel zoom
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      this.adjustZoom(delta);
    }, { passive: false });

    // Drag / Pan
    viewport.addEventListener('mousedown', (e) => {
      if (this.currentZoom > 1.0) {
        this.isPanning = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.translateX = e.clientX - this.startX;
        this.translateY = e.clientY - this.startY;
        this.applyTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (this.overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.navigate(-1);
      if (e.key === 'ArrowRight') this.navigate(1);
      if (e.key === '+' || e.key === '=') this.adjustZoom(0.25);
      if (e.key === '-' || e.key === '_') this.adjustZoom(-0.25);
      if (e.key === '0') this.setZoom(1.0);
    });
  }

  open(images: string[], index = 0, caption = ''): void {
    if (!images || images.length === 0) return;
    this.images = images;
    this.currentIndex = Math.max(0, Math.min(index, images.length - 1));
    this.captionEl.textContent = caption || `Foto ${this.currentIndex + 1} de ${this.images.length}`;
    this.setZoom(1.0);
    this.updateImage();
    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  private navigate(direction: number): void {
    if (this.images.length <= 1) return;
    this.currentIndex = (this.currentIndex + direction + this.images.length) % this.images.length;
    this.setZoom(1.0);
    this.updateImage();
  }

  private updateImage(): void {
    this.imageEl.src = this.images[this.currentIndex];
    const prevBtn = this.overlay.querySelector('#lb-prev') as HTMLElement;
    const nextBtn = this.overlay.querySelector('#lb-next') as HTMLElement;
    if (this.images.length <= 1) {
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    } else {
      prevBtn.style.display = 'block';
      nextBtn.style.display = 'block';
    }
  }

  private adjustZoom(delta: number): void {
    this.setZoom(this.currentZoom + delta);
  }

  private setZoom(zoom: number): void {
    // Limita entre 50% (0.5) e 400% (4.0)
    this.currentZoom = Math.max(0.5, Math.min(4.0, zoom));
    if (this.currentZoom === 1.0) {
      this.translateX = 0;
      this.translateY = 0;
    }
    this.zoomLevelEl.textContent = `${Math.round(this.currentZoom * 100)}%`;
    this.applyTransform();
  }

  private applyTransform(): void {
    this.imageEl.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.currentZoom})`;
  }
}

export const lightbox = new Lightbox();
