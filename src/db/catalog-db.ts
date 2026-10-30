/**
 * src/db/catalog-db.ts
 * Camada de Persistência Offline IndexedDB com Isolamento Inviolável de Edições
 */

import { ProductItem, UserEditRecord, CustomPhotoRecord, CatalogBackupPayload } from '../types/catalog';
import { computeSha256 } from '../media/webp-converter';

const DB_NAME = 'InterruptoresCapasCatalogDB';
const DB_VERSION = 1;

class CatalogDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('products')) {
          const prodStore = db.createObjectStore('products', { keyPath: 'id' });
          prodStore.createIndex('boxNumber', 'boxNumber', { unique: false });
          prodStore.createIndex('category', 'category', { unique: false });
          prodStore.createIndex('commercialCode', 'commercialCode', { unique: false });
        }

        if (!db.objectStoreNames.contains('userEdits')) {
          db.createObjectStore('userEdits', { keyPath: 'productId' });
        }

        if (!db.objectStoreNames.contains('customPhotos')) {
          const photoStore = db.createObjectStore('customPhotos', { keyPath: 'id' });
          photoStore.createIndex('productId', 'productId', { unique: false });
          photoStore.createIndex('sha256', 'sha256', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Sincroniza o catálogo estático garantindo ISOLAMENTO INVIOLÁVEL:
   * Edições manuais de caixas, códigos, preços ou fotos jamais são perdidas!
   */
  async syncStaticCatalogUpdates(staticProducts: ProductItem[]): Promise<ProductItem[]> {
    const db = await this.openDB();
    const userEdits = await this.getAllUserEdits();
    const customPhotos = await this.getAllCustomPhotos();
    const allDbProducts = await this.getAllProductsDirect();

    const editMap = new Map<string, UserEditRecord>();
    userEdits.forEach(e => editMap.set(e.productId, e));

    const photoMap = new Map<string, string[]>();
    customPhotos.forEach(p => {
      const list = photoMap.get(p.productId) || [];
      list.push(p.dataUrl);
      photoMap.set(p.productId, list);
    });

    const mergedProducts: ProductItem[] = [];

    const tx = db.transaction(['products'], 'readwrite');
    const store = tx.objectStore('products');

    for (const staticItem of staticProducts) {
      let finalItem = { ...staticItem };

      // Aplica edições manuais salvas pelo usuário
      const userEdit = editMap.get(staticItem.id);
      if (userEdit && userEdit.editedFields) {
        finalItem = {
          ...finalItem,
          ...userEdit.editedFields,
          updatedAt: userEdit.updatedAt,
        };
      }

      // Aplica fotos customizadas coladas com Ctrl+V
      const addedPhotos = photoMap.get(staticItem.id);
      if (addedPhotos && addedPhotos.length > 0) {
        const uniqueImgs = Array.from(new Set([...finalItem.images, ...addedPhotos]));
        finalItem.images = uniqueImgs;
      }

      store.put(finalItem);
      mergedProducts.push(finalItem);
    }

    // Também preserva produtos customizados criados manualmente no balcão
    for (const dbItem of allDbProducts) {
      if (dbItem.isCustom && !mergedProducts.some(p => p.id === dbItem.id)) {
        mergedProducts.push(dbItem);
        store.put(dbItem);
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });

    return mergedProducts;
  }

  async getAllProducts(): Promise<ProductItem[]> {
    return this.getAllProductsDirect();
  }

  private async getAllProductsDirect(): Promise<ProductItem[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getProductById(id: string): Promise<ProductItem | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProduct(product: ProductItem): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(['products', 'userEdits'], 'readwrite');
    const prodStore = tx.objectStore('products');
    const editStore = tx.objectStore('userEdits');

    product.updatedAt = new Date().toISOString();
    prodStore.put(product);

    // Registra alteração manual no userEdits para blindagem contra sobrescrita
    const editRecord: UserEditRecord = {
      productId: product.id,
      editedFields: {
        boxNumber: product.boxNumber,
        boxDisplay: product.boxDisplay,
        internalCode: product.internalCode,
        commercialCode: product.commercialCode,
        description: product.description,
        vehicles: product.vehicles,
        manufacturers: product.manufacturers,
        specs: product.specs,
        crossReferenceCodes: product.crossReferenceCodes,
        oemCodes: product.oemCodes,
        price: product.price,
        category: product.category,
      },
      customImages: product.images.filter(img => img.startsWith('data:')),
      updatedAt: product.updatedAt,
    };
    editStore.put(editRecord);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async addCustomPhoto(productId: string, dataUrl: string, thumbnailUrl: string, sha256: string): Promise<CustomPhotoRecord> {
    const db = await this.openDB();
    const photoRecord: CustomPhotoRecord = {
      id: `${productId}-${sha256.slice(0, 10)}-${Date.now()}`,
      productId,
      dataUrl,
      thumbnailUrl,
      sha256,
      createdAt: new Date().toISOString(),
    };

    const tx = db.transaction(['customPhotos', 'products'], 'readwrite');
    const photoStore = tx.objectStore('customPhotos');
    const prodStore = tx.objectStore('products');

    photoStore.put(photoRecord);

    const prodReq = prodStore.get(productId);
    prodReq.onsuccess = () => {
      const prod = prodReq.result as ProductItem;
      if (prod) {
        if (!prod.images.includes(dataUrl)) {
          prod.images.push(dataUrl);
          prod.updatedAt = new Date().toISOString();
          prodStore.put(prod);
        }
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(photoRecord);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllUserEdits(): Promise<UserEditRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('userEdits', 'readonly');
      const store = tx.objectStore('userEdits');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllCustomPhotos(): Promise<CustomPhotoRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('customPhotos', 'readonly');
      const store = tx.objectStore('customPhotos');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteProduct(id: string): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(['products', 'userEdits'], 'readwrite');
    tx.objectStore('products').delete(id);
    tx.objectStore('userEdits').delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Exporta Backup Completo com SHA-256
   */
  async exportBackup(): Promise<string> {
    const products = await this.getAllProductsDirect();
    const userEdits = await this.getAllUserEdits();
    const customPhotos = await this.getAllCustomPhotos();

    const payloadWithoutHash = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      productsCount: products.length,
      products,
      userEdits,
      customPhotos,
    };

    const encoder = new TextEncoder();
    const contentBuffer = encoder.encode(JSON.stringify(payloadWithoutHash));
    const checksumSha256 = await computeSha256(contentBuffer.buffer as ArrayBuffer);

    const fullPayload: CatalogBackupPayload = {
      ...payloadWithoutHash,
      checksumSha256,
    };

    return JSON.stringify(fullPayload, null, 2);
  }

  /**
   * Importa e Restaura Backup com Validação Estrita de SHA-256
   */
  async importBackup(jsonString: string): Promise<{ success: boolean; count: number; message: string }> {
    try {
      const parsed: CatalogBackupPayload = JSON.parse(jsonString);
      if (!parsed.checksumSha256 || !Array.isArray(parsed.products)) {
        return { success: false, count: 0, message: 'Formato de arquivo de backup inválido.' };
      }

      const { checksumSha256, ...payloadToVerify } = parsed;
      const encoder = new TextEncoder();
      const contentBuffer = encoder.encode(JSON.stringify(payloadToVerify));
      const computedHash = await computeSha256(contentBuffer.buffer as ArrayBuffer);

      if (computedHash !== checksumSha256) {
        return {
          success: false,
          count: 0,
          message: `Corrupção de integridade: SHA-256 calculado (${computedHash.slice(0, 8)}) não confere com o arquivo (${checksumSha256.slice(0, 8)}).`,
        };
      }

      const db = await this.openDB();
      const tx = db.transaction(['products', 'userEdits', 'customPhotos'], 'readwrite');
      const prodStore = tx.objectStore('products');
      const editStore = tx.objectStore('userEdits');
      const photoStore = tx.objectStore('customPhotos');

      for (const prod of parsed.products) {
        prodStore.put(prod);
      }
      if (Array.isArray(parsed.userEdits)) {
        for (const edit of parsed.userEdits) {
          editStore.put(edit);
        }
      }
      if (Array.isArray(parsed.customPhotos)) {
        for (const photo of parsed.customPhotos) {
          photoStore.put(photo);
        }
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });

      return {
        success: true,
        count: parsed.products.length,
        message: `Restauração concluída com sucesso! ${parsed.products.length} produtos carregados.`,
      };
    } catch (e) {
      return { success: false, count: 0, message: 'Erro ao processar backup JSON: ' + String(e) };
    }
  }
}

export const catalogDb = new CatalogDatabase();
