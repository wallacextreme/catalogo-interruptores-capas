/**
 * src/types/catalog.ts
 * Definições de Tipagem Estrita do Catálogo de Balcão
 */

export interface ProductItem {
  id: string;
  category: string;
  section: string;
  sourceDocument: string;
  boxNumber: string;
  boxDisplay: string;
  internalCode: string;
  commercialCode: string;
  commercialCodeRaw: string;
  description: string;
  specs: string[];
  vehicles: string[];
  manufacturers: string[];
  partBrand: string;
  crossReferenceCodes: string[];
  oemCodes: string[];
  searchTokens: string[];
  images: string[];
  price: number | null;
  isCustom?: boolean;
  needsDescriptionReview?: boolean;
  updatedAt: string;
}

export interface UserEditRecord {
  productId: string;
  editedFields: Partial<ProductItem>;
  customImages: string[];
  updatedAt: string;
}

export interface CustomPhotoRecord {
  id: string;
  productId: string;
  dataUrl: string;
  thumbnailUrl: string;
  sha256: string;
  createdAt: string;
}

export type ViewMode = 'grid' | 'mural' | 'boxes';

export interface CatalogFilterState {
  query: string;
  category: string;
  manufacturer: string;
  spec: string;
  box: string;
  hasPhotoOnly: boolean;
  viewMode: ViewMode;
  hidePrices: boolean;
  darkMode: boolean;
}

export interface CatalogBackupPayload {
  version: string;
  exportedAt: string;
  productsCount: number;
  products: ProductItem[];
  userEdits: UserEditRecord[];
  customPhotos: CustomPhotoRecord[];
  checksumSha256: string;
}

export interface SearchResult {
  item: ProductItem;
  score: number;
  matchedField: string;
}
