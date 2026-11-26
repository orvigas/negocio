import { z } from 'zod';

import {
  CSRF_HEADER,
  IDEMPOTENCY_HEADER,
  adminPaths,
  botBlockResponseSchema,
  botControlResponseSchema,
  botStateResponseSchema,
  loginResponseSchema,
  passwordChangeResponseSchema,
  productFieldsResponseSchema,
  productListResponseSchema,
  productListWriteResponseSchema,
  productResponseSchema,
  productWriteResponseSchema,
  sessionResponseSchema,
  userListResponseSchema,
  userResponseSchema,
  userWriteResponseSchema,
  type AdminProduct,
  type BotBlockRequest,
  type BotBlockResponse,
  type BotControlState,
  type BotReachedBlockRequest,
  type BotState,
  type BotSwitchRequest,
  type Freshness,
  type LoginRequest,
  type LoginResponse,
  type ManagedUser,
  type PasswordChangeRequest,
  type PasswordChangeResponse,
  type ProductFieldsResponse,
  type SessionResponse,
  type UserCreateRequest,
  type UserPasswordRequest,
  type UserUpdateRequest,
  type UserWriteResponse,
} from './admin.ts';
import { isJson, isTimeout, readLimited } from './http.ts';
import {
  inventoryCategoryListResponseSchema,
  inventoryCategoryResponseSchema,
  inventoryConversionResponseSchema,
  inventoryItemDetailResponseSchema,
  inventoryItemListResponseSchema,
  inventoryItemResponseSchema,
  inventoryPaths,
  type InventoryCategoryListResponse,
  type InventoryCategoryRequest,
  type InventoryCategoryResponse,
  type InventoryConversionResponse,
  type InventoryItemCreateRequest,
  type InventoryItemDeactivateRequest,
  type InventoryItemDetailResponse,
  type InventoryItemFilter,
  type InventoryItemListResponse,
  type InventoryItemReactivateRequest,
  type InventoryItemResponse,
  type InventoryItemUpdateRequest,
} from './inventory.ts';
import {
  inventoryRecipePaths,
  recipeCloseResponseSchema,
  recipeDetailResponseSchema,
  recipeIngredientsResponseSchema,
  recipeListResponseSchema,
  recipeSaveResponseSchema,
  recipeUsedInResponseSchema,
  recipeVersionResponseSchema,
  type RecipeCloseRequest,
  type RecipeCloseResponse,
  type RecipeDetailResponse,
  type RecipeIngredientsResponse,
  type RecipeListFilter,
  type RecipeListResponse,
  type RecipeSaveRequest,
  type RecipeSaveResponse,
  type RecipeUsedInResponse,
  type RecipeVersionResponse,
} from './inventory-recipes.ts';
import {
  inventoryKardexPaths,
  itemKardexResponseSchema,
  kardexDocumentDetailResponseSchema,
  kardexDocumentListResponseSchema,
  kardexDocumentWriteResponseSchema,
  kardexOptionsResponseSchema,
  kardexReversalPreviewResponseSchema,
  stockResponseSchema,
  supplierDetailResponseSchema,
  supplierListResponseSchema,
  supplierResponseSchema,
  type AdjustmentRequest,
  type InitialBalanceRequest,
  type ItemKardexResponse,
  type KardexDocumentDetailResponse,
  type KardexDocumentFilter,
  type KardexDocumentListResponse,
  type KardexDocumentWriteResponse,
  type KardexOptionsResponse,
  type KardexReversalPreviewResponse,
  type PurchaseRequest,
  type ReversalRequest,
  type StockFilter,
  type StockResponse,
  type SupplierCreateRequest,
  type SupplierDetailResponse,
  type SupplierListFilter,
  type SupplierListResponse,
  type SupplierResponse,
  type SupplierReturnRequest,
  type SupplierStatusRequest,
  type SupplierUpdateRequest,
} from './inventory-kardex.ts';
import {
  pageConflictSchema,
  pageStateResponseSchema,
  pageWriteResponseSchema,
  type PageRestoreRequest,
  type PageSaveRequest,
  type PageStateResponse,
  type PageWriteResponse,
} from './page.ts';
import type { PublicBusinessId } from './products.ts';
import {
  quoteCalculationResponseSchema,
  quoteDefaultsResponseSchema,
  type QuoteCalculationRequest,
  type QuoteCalculationResponse,
  type QuoteDefaultsResponse,
} from './quote.ts';

/**
 * Cliente HTTP tipado de `/api/v1/admin` (REQ-F-039, D-1 y D-2; usuarios y cuenta, REQ-F-040) para el
 * admin (inventory-manager).
 *
 * - Nunca lanza: devuelve los datos validados con el contrato, el error de la API
 *   (`{ error: { code, message, fields?, current? } }`) o el motivo de un fallo de transporte.
 * - La sesión viaja como `Authorization: Bearer <id>`; las escrituras llevan el token CSRF de la
 *   sesión en `X-CSRF-Token`; el login, la IP del visitante en `X-Forwarded-For` (la escribe el
 *   admin con la que le da su proxy; nunca reenvía la que recibe).
 * - Límite de tiempo por petición, sin redirecciones y cuerpo de 1 MiB como máximo.
 */

export const ADMIN_CLIENT_MAX_BYTES = 1024 * 1024;

const itemCurrentSchema = z.object({ id: z.number(), version: z.number(), updatedAt: z.string(), updatedBy: z.string().nullable() });
/** 409 `RECIPE_VERSION_CONFLICT` (REQ-F-050, RF-9): la vigente, o null si ya no hay. */
const recipeCurrentSchema = z.object({ id: z.number(), number: z.number(), validFrom: z.string(), createdBy: z.string() });

const apiErrorBodySchema = z.object({
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      fields: z.record(z.string(), z.string()).optional(),
      current: z.union([itemCurrentSchema, recipeCurrentSchema, z.null()]).optional(),
      /** 409 `PAGE_CONFLICT`: la versión vigente de la página (REQ-F-044). */
      currentPage: pageConflictSchema.optional(),
      /** 422 `RECIPE_CYCLE` (REQ-F-050, RF-5) y `RECIPE_TOO_DEEP` (REQ-F-054, RF-2): la ruta, por nombre, desde la receta que se guarda. */
      path: z.array(z.string()).optional(),
      /** 422 `RECIPE_TOO_DEEP` (REQ-F-054, RF-2): las recetas que usan la que se guarda, de la más cercana hacia arriba. */
      usedBy: z.array(z.string()).optional(),
      /** 409 `ITEM_IN_ACTIVE_RECIPES` (REQ-F-050, RF-7): recetas vigentes que lo usan. */
      recipes: z.array(z.object({ itemId: z.number(), name: z.string() })).optional(),
      /** 409 `INITIAL_BALANCE_NOT_ALLOWED` (REQ-F-051, RN-T3-8): artículos que ya tienen movimientos. */
      items: z.array(z.object({ itemId: z.number(), name: z.string() })).optional(),
      /** 409 `DOCUMENT_HAS_RETURNS` (REQ-F-051, DT-T3-3): devoluciones vigentes que hay que revertir antes. */
      returnIds: z.array(z.number()).optional(),
    })
    // `current` cambia de forma según el código: el de un artículo o producto (versión) o el de una receta.
    .transform(({ current, ...rest }) => {
      const item = itemCurrentSchema.safeParse(current);
      const recipe = recipeCurrentSchema.safeParse(current);
      const isRecipe = rest.code === 'RECIPE_VERSION_CONFLICT';
      const fromItem: { current?: z.infer<typeof itemCurrentSchema> } = !isRecipe && item.success ? { current: item.data } : {};
      const fromRecipe: { recipeCurrent?: z.infer<typeof recipeCurrentSchema> } = isRecipe && recipe.success ? { recipeCurrent: recipe.data } : {};
      return { ...rest, ...fromItem, ...fromRecipe };
    }),
});
export type AdminApiError = z.output<typeof apiErrorBodySchema>['error'];

export type AdminApiFailure = 'timeout' | 'network' | 'invalid_response';

export type AdminApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; kind: 'http'; status: number; error: AdminApiError }
  | { ok: false; kind: AdminApiFailure; status?: number };

export type AdminFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface AdminApiClientOptions {
  /** Origen de la API, sin barra final (p. ej. http://api:3001). */
  baseUrl: string;
  timeoutMs: number;
  fetch?: AdminFetch;
}

/** Sesión de la API que reenvía el admin: id opaco y, en escrituras, su token CSRF. */
export interface AdminCredentials {
  sessionId: string;
  csrfToken?: string;
}

export type WriteResult<T> = AdminApiResult<T & { meta: { freshness: Freshness } }>;

export interface AdminApiClient {
  login(body: LoginRequest, clientIp: string): Promise<AdminApiResult<LoginResponse>>;
  session(auth: AdminCredentials): Promise<AdminApiResult<SessionResponse>>;
  logout(auth: AdminCredentials): Promise<AdminApiResult<null>>;
  listProducts(auth: AdminCredentials, business: PublicBusinessId, options?: { deleted?: boolean }): Promise<AdminApiResult<{ products: AdminProduct[] }>>;
  productFields(auth: AdminCredentials, business: PublicBusinessId, kind: { category: string; detailsType: string | null }): Promise<AdminApiResult<ProductFieldsResponse>>;
  getProduct(auth: AdminCredentials, business: PublicBusinessId, id: number): Promise<AdminApiResult<{ product: AdminProduct }>>;
  createProduct(auth: AdminCredentials, business: PublicBusinessId, input: Record<string, unknown>, idempotencyKey?: string): Promise<WriteResult<{ product: AdminProduct }>>;
  updateProduct(auth: AdminCredentials, business: PublicBusinessId, id: number, input: Record<string, unknown>, options?: { overwrite?: boolean }): Promise<WriteResult<{ product: AdminProduct }>>;
  removeProduct(auth: AdminCredentials, business: PublicBusinessId, id: number, version: number): Promise<WriteResult<{ product: AdminProduct }>>;
  restoreProduct(auth: AdminCredentials, business: PublicBusinessId, id: number, version: number): Promise<WriteResult<{ product: AdminProduct }>>;
  moveProduct(auth: AdminCredentials, business: PublicBusinessId, id: number, direction: 'up' | 'down', version: number): Promise<WriteResult<{ products: AdminProduct[] }>>;
  // Usuarios (solo administradores) y cuenta propia (REQ-F-040).
  listUsers(auth: AdminCredentials): Promise<AdminApiResult<{ users: ManagedUser[] }>>;
  getUser(auth: AdminCredentials, id: number): Promise<AdminApiResult<{ user: ManagedUser }>>;
  createUser(auth: AdminCredentials, input: UserCreateRequest): Promise<AdminApiResult<{ user: ManagedUser }>>;
  updateUser(auth: AdminCredentials, id: number, input: UserUpdateRequest): Promise<AdminApiResult<UserWriteResponse>>;
  setUserActive(auth: AdminCredentials, id: number, active: boolean): Promise<AdminApiResult<UserWriteResponse>>;
  resetUserPassword(auth: AdminCredentials, id: number, input: UserPasswordRequest): Promise<AdminApiResult<UserWriteResponse>>;
  /** Cambia la propia contraseña; devuelve la sesión nueva (la de `auth` deja de valer). */
  changeOwnPassword(auth: AdminCredentials, input: PasswordChangeRequest): Promise<AdminApiResult<PasswordChangeResponse>>;
  // Datos de página (REQ-F-044).
  getPage(auth: AdminCredentials, business: PublicBusinessId): Promise<AdminApiResult<PageStateResponse>>;
  savePage(auth: AdminCredentials, business: PublicBusinessId, input: PageSaveRequest): Promise<AdminApiResult<PageWriteResponse>>;
  restorePage(auth: AdminCredentials, business: PublicBusinessId, input: PageRestoreRequest): Promise<AdminApiResult<PageWriteResponse>>;
  // Control del bot (solo administradores; REQ-F-043).
  getBot(auth: AdminCredentials): Promise<AdminApiResult<{ bot: BotState }>>;
  setBotPaused(auth: AdminCredentials, input: BotSwitchRequest): Promise<AdminApiResult<{ control: BotControlState }>>;
  blockNumber(auth: AdminCredentials, input: BotBlockRequest): Promise<AdminApiResult<BotBlockResponse>>;
  unblockNumber(auth: AdminCredentials, id: number): Promise<AdminApiResult<BotBlockResponse>>;
  blockReached(auth: AdminCredentials, token: string, input: BotReachedBlockRequest): Promise<AdminApiResult<BotBlockResponse>>;
  // Cotizador de taquizas (solo administradores; REQ-F-046). El cálculo no escribe nada.
  getQuoteDefaults(auth: AdminCredentials, business: PublicBusinessId): Promise<AdminApiResult<QuoteDefaultsResponse>>;
  calculateQuote(auth: AdminCredentials, business: PublicBusinessId, input: QuoteCalculationRequest): Promise<AdminApiResult<QuoteCalculationResponse>>;
  // Catálogo de inventario (administradores y gerentes; REQ-F-049).
  listInventoryItems(auth: AdminCredentials, filter?: InventoryItemFilter): Promise<AdminApiResult<InventoryItemListResponse>>;
  getInventoryItem(auth: AdminCredentials, id: number): Promise<AdminApiResult<InventoryItemDetailResponse>>;
  convertInventoryQuantity(auth: AdminCredentials, id: number, quantity: string, unit: string): Promise<AdminApiResult<InventoryConversionResponse>>;
  createInventoryItem(auth: AdminCredentials, input: InventoryItemCreateRequest, idempotencyKey?: string): Promise<AdminApiResult<InventoryItemResponse>>;
  updateInventoryItem(auth: AdminCredentials, id: number, input: InventoryItemUpdateRequest): Promise<AdminApiResult<InventoryItemResponse>>;
  deactivateInventoryItem(auth: AdminCredentials, id: number, input: InventoryItemDeactivateRequest): Promise<AdminApiResult<InventoryItemResponse>>;
  reactivateInventoryItem(auth: AdminCredentials, id: number, input: InventoryItemReactivateRequest): Promise<AdminApiResult<InventoryItemResponse>>;
  listInventoryCategories(auth: AdminCredentials): Promise<AdminApiResult<InventoryCategoryListResponse>>;
  createInventoryCategory(auth: AdminCredentials, input: InventoryCategoryRequest, idempotencyKey?: string): Promise<AdminApiResult<InventoryCategoryResponse>>;
  renameInventoryCategory(auth: AdminCredentials, id: number, input: InventoryCategoryRequest): Promise<AdminApiResult<InventoryCategoryResponse>>;
  setInventoryCategoryActive(auth: AdminCredentials, id: number, active: boolean): Promise<AdminApiResult<InventoryCategoryResponse>>;
  // Recetas del inventario (administradores y gerentes; REQ-F-050).
  listInventoryRecipes(auth: AdminCredentials, filter?: RecipeListFilter): Promise<AdminApiResult<RecipeListResponse>>;
  getInventoryRecipe(auth: AdminCredentials, itemId: number): Promise<AdminApiResult<RecipeDetailResponse>>;
  getInventoryRecipeVersion(auth: AdminCredentials, versionId: number): Promise<AdminApiResult<RecipeVersionResponse>>;
  inventoryRecipeIngredients(auth: AdminCredentials): Promise<AdminApiResult<RecipeIngredientsResponse>>;
  inventoryRecipeUsedIn(auth: AdminCredentials, itemId: number): Promise<AdminApiResult<RecipeUsedInResponse>>;
  /** 201 versión nueva o 200 sin cambios (`created: false`). */
  saveInventoryRecipe(auth: AdminCredentials, itemId: number, input: RecipeSaveRequest, idempotencyKey?: string): Promise<AdminApiResult<RecipeSaveResponse>>;
  closeInventoryRecipe(auth: AdminCredentials, itemId: number, input: RecipeCloseRequest): Promise<AdminApiResult<RecipeCloseResponse>>;
  // Proveedores, Kardex y existencias (administradores y gerentes; REQ-F-051).
  listInventorySuppliers(auth: AdminCredentials, filter?: SupplierListFilter): Promise<AdminApiResult<SupplierListResponse>>;
  getInventorySupplier(auth: AdminCredentials, id: number): Promise<AdminApiResult<SupplierDetailResponse>>;
  createInventorySupplier(auth: AdminCredentials, input: SupplierCreateRequest, idempotencyKey?: string): Promise<AdminApiResult<SupplierResponse>>;
  updateInventorySupplier(auth: AdminCredentials, id: number, input: SupplierUpdateRequest): Promise<AdminApiResult<SupplierResponse>>;
  setInventorySupplierActive(auth: AdminCredentials, id: number, active: boolean, input: SupplierStatusRequest): Promise<AdminApiResult<SupplierResponse>>;
  kardexOptions(auth: AdminCredentials): Promise<AdminApiResult<KardexOptionsResponse>>;
  /** 201 documento nuevo o 200 reenvío del mismo envío (`replayed: true`; clave persistente, DT-14). */
  createInitialBalance(auth: AdminCredentials, input: InitialBalanceRequest, idempotencyKey?: string): Promise<AdminApiResult<KardexDocumentWriteResponse>>;
  createPurchase(auth: AdminCredentials, input: PurchaseRequest, idempotencyKey?: string): Promise<AdminApiResult<KardexDocumentWriteResponse>>;
  createAdjustment(auth: AdminCredentials, input: AdjustmentRequest, idempotencyKey?: string): Promise<AdminApiResult<KardexDocumentWriteResponse>>;
  createSupplierReturn(auth: AdminCredentials, purchaseId: number, input: SupplierReturnRequest, idempotencyKey?: string): Promise<AdminApiResult<KardexDocumentWriteResponse>>;
  previewReversal(auth: AdminCredentials, documentId: number): Promise<AdminApiResult<KardexReversalPreviewResponse>>;
  reverseDocument(auth: AdminCredentials, documentId: number, input: ReversalRequest, idempotencyKey?: string): Promise<AdminApiResult<KardexDocumentWriteResponse>>;
  listKardexDocuments(auth: AdminCredentials, filter?: KardexDocumentFilter): Promise<AdminApiResult<KardexDocumentListResponse>>;
  getKardexDocument(auth: AdminCredentials, id: number): Promise<AdminApiResult<KardexDocumentDetailResponse>>;
  listStock(auth: AdminCredentials, filter?: StockFilter): Promise<AdminApiResult<StockResponse>>;
  getItemKardex(auth: AdminCredentials, itemId: number, page?: string): Promise<AdminApiResult<ItemKardexResponse>>;
}

/** Query con claves en español a partir de pares [clave, valor]; los vacíos se omiten. */
function spanishQuery(entries: [string, string | undefined][]): string {
  const text = new URLSearchParams(entries.filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')).toString();
  return text === '' ? '' : `?${text}`;
}

/** Query de la lista de artículos (claves en español, como la ruta). */
function inventoryQuery({ status, type, categoryId, q, page }: InventoryItemFilter = {}): string {
  const entries: [string, string | undefined][] = [
    ['estado', status],
    ['tipo', type],
    ['categoria', categoryId],
    ['q', q],
    ['pagina', page],
  ];
  const query = new URLSearchParams(entries.filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ''));
  const text = query.toString();
  return text === '' ? '' : `?${text}`;
}

/** Query de la lista de recetas (`tipo`, `q`, `pagina`). */
function recipeQuery({ type, q, page }: RecipeListFilter = {}): string {
  const entries: [string, string | undefined][] = [
    ['tipo', type],
    ['q', q],
    ['pagina', page],
  ];
  const text = new URLSearchParams(entries.filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')).toString();
  return text === '' ? '' : `?${text}`;
}

interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export function createAdminApiClient({ baseUrl, timeoutMs, fetch: fetchFn = (input, init) => fetch(input, init) }: AdminApiClientOptions): AdminApiClient {
  if (typeof baseUrl !== 'string' || baseUrl === '' || baseUrl.endsWith('/')) throw new TypeError('createAdminApiClient requiere baseUrl sin barra final');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('createAdminApiClient requiere timeoutMs positivo');

  async function request<T>(
    method: string,
    path: string,
    { auth, body, headers = {}, schema, expect = 200 }: { auth?: AdminCredentials; body?: unknown; headers?: Record<string, string>; schema: Schema<T> | null; expect?: number | readonly number[] },
  ): Promise<AdminApiResult<T>> {
    const expected = (status: number) => (typeof expect === 'number' ? status === expect : expect.includes(status));
    const all: Record<string, string> = { accept: 'application/json', ...headers };
    if (auth) all.authorization = `Bearer ${auth.sessionId}`;
    if (auth?.csrfToken && method !== 'GET') all[CSRF_HEADER] = auth.csrfToken;
    if (body !== undefined) all['content-type'] = 'application/json';
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers: all,
        redirect: 'error',
        signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (expected(response.status) && schema === null) {
        await response.body?.cancel();
        return { ok: true, status: response.status, data: null as T };
      }
      if (!isJson(response.headers.get('content-type'))) {
        await response.body?.cancel();
        return { ok: false, kind: 'invalid_response', status: response.status };
      }
      const text = await readLimited(response, ADMIN_CLIENT_MAX_BYTES);
      if (text === null) return { ok: false, kind: 'invalid_response', status: response.status };
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        return { ok: false, kind: 'invalid_response', status: response.status };
      }
      if (expected(response.status) && schema) {
        const parsed = schema.safeParse(parsedBody);
        return parsed.success ? { ok: true, status: response.status, data: parsed.data } : { ok: false, kind: 'invalid_response', status: response.status };
      }
      const error = apiErrorBodySchema.safeParse(parsedBody);
      return error.success ? { ok: false, kind: 'http', status: response.status, error: error.data.error } : { ok: false, kind: 'invalid_response', status: response.status };
    } catch (err) {
      return { ok: false, kind: isTimeout(err) || signal.aborted ? 'timeout' : 'network' };
    }
  }

  /** Escritura de un documento del Kardex: 201 nuevo o 200 reenvío del mismo envío (REQ-F-051, DT-14). */
  const writeDocument = (auth: AdminCredentials, path: string, input: unknown, idempotencyKey?: string): Promise<AdminApiResult<KardexDocumentWriteResponse>> =>
    request('POST', path, { auth, body: input, headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {}, schema: kardexDocumentWriteResponseSchema, expect: [200, 201] });

  return Object.freeze<AdminApiClient>({
    login: (body, clientIp) => request('POST', adminPaths.session, { body, headers: { 'x-forwarded-for': clientIp }, schema: loginResponseSchema, expect: 201 }),
    session: (auth) => request('GET', adminPaths.session, { auth, schema: sessionResponseSchema }),
    logout: (auth) => request<null>('DELETE', adminPaths.session, { auth, schema: null, expect: 204 }),
    listProducts: (auth, business, { deleted = false } = {}) =>
      request('GET', `${adminPaths.products(business)}${deleted ? '?eliminados=1' : ''}`, { auth, schema: productListResponseSchema }),
    productFields: (auth, business, { category, detailsType }) => {
      const query = new URLSearchParams({ categoria: category, ...(detailsType ? { tipo: detailsType } : {}) });
      return request('GET', `${adminPaths.productFields(business)}?${query.toString()}`, { auth, schema: productFieldsResponseSchema });
    },
    getProduct: (auth, business, id) => request('GET', adminPaths.product(business, id), { auth, schema: productResponseSchema }),
    createProduct: (auth, business, input, idempotencyKey) =>
      request('POST', adminPaths.products(business), {
        auth,
        body: input,
        headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {},
        schema: productWriteResponseSchema,
        expect: 201,
      }),
    updateProduct: (auth, business, id, input, { overwrite = false } = {}) =>
      request('PUT', `${adminPaths.product(business, id)}${overwrite ? '?sobrescribir=1' : ''}`, { auth, body: input, schema: productWriteResponseSchema }),
    removeProduct: (auth, business, id, version) => request('DELETE', `${adminPaths.product(business, id)}?version=${version}`, { auth, schema: productWriteResponseSchema }),
    restoreProduct: (auth, business, id, version) => request('POST', adminPaths.productRestore(business, id), { auth, body: { version }, schema: productWriteResponseSchema }),
    moveProduct: (auth, business, id, direction, version) =>
      request('POST', adminPaths.productMove(business, id), { auth, body: { direction, version }, schema: productListWriteResponseSchema }),
    listUsers: (auth) => request('GET', adminPaths.users, { auth, schema: userListResponseSchema }),
    getUser: (auth, id) => request('GET', adminPaths.user(id), { auth, schema: userResponseSchema }),
    createUser: (auth, input) => request('POST', adminPaths.users, { auth, body: input, schema: userResponseSchema, expect: 201 }),
    updateUser: (auth, id, input) => request('PUT', adminPaths.user(id), { auth, body: input, schema: userWriteResponseSchema }),
    setUserActive: (auth, id, active) =>
      request('POST', adminPaths.userStatus(id, active ? 'reactivar' : 'desactivar'), { auth, body: {}, schema: userWriteResponseSchema }),
    resetUserPassword: (auth, id, input) => request('PUT', adminPaths.userPassword(id), { auth, body: input, schema: userWriteResponseSchema }),
    changeOwnPassword: (auth, input) => request('POST', adminPaths.accountPassword, { auth, body: input, schema: passwordChangeResponseSchema }),
    getPage: (auth, business) => request('GET', adminPaths.page(business), { auth, schema: pageStateResponseSchema }),
    savePage: (auth, business, input) => request('PUT', adminPaths.page(business), { auth, body: input, schema: pageWriteResponseSchema }),
    restorePage: (auth, business, input) => request('POST', adminPaths.pageRestore(business), { auth, body: input, schema: pageWriteResponseSchema }),
    getBot: (auth) => request('GET', adminPaths.bot, { auth, schema: botStateResponseSchema }),
    setBotPaused: (auth, input) => request('PUT', adminPaths.botSwitch, { auth, body: input, schema: botControlResponseSchema }),
    blockNumber: (auth, input) => request('POST', adminPaths.botBlocks, { auth, body: input, schema: botBlockResponseSchema, expect: 201 }),
    unblockNumber: (auth, id) => request('POST', adminPaths.botUnblock(id), { auth, body: {}, schema: botBlockResponseSchema }),
    blockReached: (auth, token, input) => request('POST', adminPaths.botBlockReached(token), { auth, body: input, schema: botBlockResponseSchema, expect: 201 }),
    getQuoteDefaults: (auth, business) => request('GET', adminPaths.quote(business), { auth, schema: quoteDefaultsResponseSchema }),
    calculateQuote: (auth, business, input) => request('POST', adminPaths.quoteCalculations(business), { auth, body: input, schema: quoteCalculationResponseSchema }),
    listInventoryItems: (auth, filter) => request('GET', `${inventoryPaths.items}${inventoryQuery(filter)}`, { auth, schema: inventoryItemListResponseSchema }),
    getInventoryItem: (auth, id) => request('GET', inventoryPaths.item(id), { auth, schema: inventoryItemDetailResponseSchema }),
    convertInventoryQuantity: (auth, id, quantity, unit) =>
      request('GET', `${inventoryPaths.itemConversion(id)}?${new URLSearchParams({ cantidad: quantity, unidad: unit }).toString()}`, { auth, schema: inventoryConversionResponseSchema }),
    createInventoryItem: (auth, input, idempotencyKey) =>
      request('POST', inventoryPaths.items, { auth, body: input, headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {}, schema: inventoryItemResponseSchema, expect: 201 }),
    updateInventoryItem: (auth, id, input) => request('PUT', inventoryPaths.item(id), { auth, body: input, schema: inventoryItemResponseSchema }),
    deactivateInventoryItem: (auth, id, input) => request('POST', inventoryPaths.itemStatus(id, 'desactivar'), { auth, body: input, schema: inventoryItemResponseSchema }),
    reactivateInventoryItem: (auth, id, input) => request('POST', inventoryPaths.itemStatus(id, 'reactivar'), { auth, body: input, schema: inventoryItemResponseSchema }),
    listInventoryCategories: (auth) => request('GET', inventoryPaths.categories, { auth, schema: inventoryCategoryListResponseSchema }),
    createInventoryCategory: (auth, input, idempotencyKey) =>
      request('POST', inventoryPaths.categories, { auth, body: input, headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {}, schema: inventoryCategoryResponseSchema, expect: 201 }),
    renameInventoryCategory: (auth, id, input) => request('PUT', inventoryPaths.category(id), { auth, body: input, schema: inventoryCategoryResponseSchema }),
    setInventoryCategoryActive: (auth, id, active) =>
      request('POST', inventoryPaths.categoryStatus(id, active ? 'reactivar' : 'desactivar'), { auth, body: {}, schema: inventoryCategoryResponseSchema }),
    listInventoryRecipes: (auth, filter) => request('GET', `${inventoryRecipePaths.list}${recipeQuery(filter)}`, { auth, schema: recipeListResponseSchema }),
    getInventoryRecipe: (auth, itemId) => request('GET', inventoryRecipePaths.item(itemId), { auth, schema: recipeDetailResponseSchema }),
    getInventoryRecipeVersion: (auth, versionId) => request('GET', inventoryRecipePaths.version(versionId), { auth, schema: recipeVersionResponseSchema }),
    inventoryRecipeIngredients: (auth) => request('GET', inventoryRecipePaths.ingredients, { auth, schema: recipeIngredientsResponseSchema }),
    inventoryRecipeUsedIn: (auth, itemId) => request('GET', inventoryRecipePaths.usedIn(itemId), { auth, schema: recipeUsedInResponseSchema }),
    saveInventoryRecipe: (auth, itemId, input, idempotencyKey) =>
      request('POST', inventoryRecipePaths.item(itemId), { auth, body: input, headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {}, schema: recipeSaveResponseSchema, expect: [200, 201] }),
    closeInventoryRecipe: (auth, itemId, input) => request('POST', inventoryRecipePaths.close(itemId), { auth, body: input, schema: recipeCloseResponseSchema }),
    listInventorySuppliers: (auth, { status, q, page } = {}) =>
      request('GET', `${inventoryKardexPaths.suppliers}${spanishQuery([['estado', status], ['q', q], ['pagina', page]])}`, { auth, schema: supplierListResponseSchema }),
    getInventorySupplier: (auth, id) => request('GET', inventoryKardexPaths.supplier(id), { auth, schema: supplierDetailResponseSchema }),
    createInventorySupplier: (auth, input, idempotencyKey) =>
      request('POST', inventoryKardexPaths.suppliers, { auth, body: input, headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {}, schema: supplierResponseSchema, expect: 201 }),
    updateInventorySupplier: (auth, id, input) => request('PUT', inventoryKardexPaths.supplier(id), { auth, body: input, schema: supplierResponseSchema }),
    setInventorySupplierActive: (auth, id, active, input) => request('POST', inventoryKardexPaths.supplierStatus(id, active ? 'reactivar' : 'desactivar'), { auth, body: input, schema: supplierResponseSchema }),
    kardexOptions: (auth) => request('GET', inventoryKardexPaths.options, { auth, schema: kardexOptionsResponseSchema }),
    createInitialBalance: (auth, input, idempotencyKey) => writeDocument(auth, inventoryKardexPaths.initialBalances, input, idempotencyKey),
    createPurchase: (auth, input, idempotencyKey) => writeDocument(auth, inventoryKardexPaths.purchases, input, idempotencyKey),
    createAdjustment: (auth, input, idempotencyKey) => writeDocument(auth, inventoryKardexPaths.adjustments, input, idempotencyKey),
    createSupplierReturn: (auth, purchaseId, input, idempotencyKey) => writeDocument(auth, inventoryKardexPaths.returns(purchaseId), input, idempotencyKey),
    previewReversal: (auth, documentId) => request('GET', inventoryKardexPaths.reversal(documentId), { auth, schema: kardexReversalPreviewResponseSchema }),
    reverseDocument: (auth, documentId, input, idempotencyKey) => writeDocument(auth, inventoryKardexPaths.reversal(documentId), input, idempotencyKey),
    listKardexDocuments: (auth, { type, supplierId, page } = {}) =>
      request('GET', `${inventoryKardexPaths.documents}${spanishQuery([['tipo', type], ['proveedor', supplierId], ['pagina', page]])}`, { auth, schema: kardexDocumentListResponseSchema }),
    getKardexDocument: (auth, id) => request('GET', inventoryKardexPaths.document(id), { auth, schema: kardexDocumentDetailResponseSchema }),
    listStock: (auth, { q, categoryId, type, status, page } = {}) =>
      request('GET', `${inventoryKardexPaths.stock}${spanishQuery([['q', q], ['categoria', categoryId], ['tipo', type], ['estado', status], ['pagina', page]])}`, { auth, schema: stockResponseSchema }),
    getItemKardex: (auth, itemId, page) => request('GET', `${inventoryKardexPaths.itemKardex(itemId)}${spanishQuery([['pagina', page]])}`, { auth, schema: itemKardexResponseSchema }),
  });
}
