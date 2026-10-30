/**
 * src/ui/backup-modal.ts
 * Modal de Backup e Restauração com Integridade SHA-256
 */

import { catalogDb } from '../db/catalog-db';
import { icons } from './icons';

export class BackupModal {
  private overlay: HTMLElement;
  private onRestoreCallback: (() => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fixed inset-0 z-50 bg-black/75 backdrop-blur-sm hidden flex items-center justify-center p-4';
    this.overlay.innerHTML = `
      <div class="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-2xl shadow-2xl p-6 overflow-hidden">
        <div class="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center gap-2">
            <span class="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg">
              ${icons.shield}
            </span>
            <h2 class="text-base font-bold text-neutral-900 dark:text-white">
              Backup e Restauração da Loja
            </h2>
          </div>
          <button id="backup-close-btn" class="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg">
            ${icons.close}
          </button>
        </div>

        <div class="py-5 space-y-4">
          <div class="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
            <h3 class="text-xs font-black uppercase text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5">
              ${icons.download} Exportar Dados (Disaster Recovery)
            </h3>
            <p class="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
              Gera um arquivo JSON blindado com hash <strong>SHA-256</strong> contendo todas as peças, caixas, fotos do balcão e alterações manuais.
            </p>
            <button
              id="export-backup-btn"
              class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow flex items-center justify-center gap-2"
            >
              ${icons.download} Baixar Arquivo de Backup (.json)
            </button>
          </div>

          <div class="p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl">
            <h3 class="text-xs font-black uppercase text-neutral-800 dark:text-neutral-200 mb-1 flex items-center gap-1.5">
              ${icons.upload} Restaurar Backup
            </h3>
            <p class="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
              Restaura um backup anterior validando a assinatura criptográfica antes de aplicar no banco.
            </p>
            <input type="file" id="import-backup-file" accept=".json" class="hidden" />
            <button
              id="import-backup-btn"
              class="w-full py-2.5 px-4 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2"
            >
              ${icons.upload} Selecionar Arquivo para Restaurar
            </button>
          </div>

          <div id="backup-status-msg" class="text-xs text-center font-mono font-medium hidden p-2 rounded-lg"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.bindEvents();
  }

  private bindEvents(): void {
    const closeBtn = this.overlay.querySelector('#backup-close-btn');
    const exportBtn = this.overlay.querySelector('#export-backup-btn');
    const importBtn = this.overlay.querySelector('#import-backup-btn');
    const fileInput = this.overlay.querySelector('#import-backup-file') as HTMLInputElement;

    closeBtn?.addEventListener('click', () => this.close());

    exportBtn?.addEventListener('click', async () => {
      try {
        const json = await catalogDb.exportBackup();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-catalogo-interruptores-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showStatus('Backup baixado com sucesso!', true);
      } catch (e) {
        this.showStatus('Erro ao exportar backup: ' + String(e), false);
      }
    });

    importBtn?.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      if (!fileInput.files || !fileInput.files[0]) return;
      const file = fileInput.files[0];
      try {
        const text = await file.text();
        const result = await catalogDb.importBackup(text);
        if (result.success) {
          this.showStatus(result.message, true);
          if (this.onRestoreCallback) this.onRestoreCallback();
        } else {
          this.showStatus(result.message, false);
        }
      } catch (err) {
        this.showStatus('Falha ao ler arquivo: ' + String(err), false);
      }
    });
  }

  private showStatus(msg: string, success: boolean): void {
    const el = this.overlay.querySelector('#backup-status-msg') as HTMLElement;
    el.textContent = msg;
    el.className = `text-xs text-center font-mono font-bold p-2.5 rounded-lg ${success ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-300 dark:border-green-800' : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800'}`;
    el.classList.remove('hidden');
  }

  open(onRestore?: () => void): void {
    this.onRestoreCallback = onRestore || null;
    const el = this.overlay.querySelector('#backup-status-msg') as HTMLElement;
    el.classList.add('hidden');
    this.overlay.classList.remove('hidden');
  }

  close(): void {
    this.overlay.classList.add('hidden');
  }
}

export const backupModal = new BackupModal();
