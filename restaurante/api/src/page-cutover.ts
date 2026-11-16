import { PageUnavailableError, createPageRepository, type PageRepository, type PageRepositoryOptions } from '@restaurante/core/catalog';

/**
 * Corte de los datos de página (REQ-F-044, RF-4). Mientras sea `false`, esta imagen de la api responde
 * "no disponible" aunque haya filas en MySQL.
 *
 * Es una constante de la imagen, y no una variable de entorno ni la mera ausencia de filas, a propósito:
 * si el PR 3 importa y después hay vuelta atrás, la imagen anterior encontraría filas y activaría la
 * edición con la `app` anterior todavía leyendo y escribiendo los JSON: dos escritores. Con la constante,
 * el comportamiento correcto vuelve solo con la imagen. El PR 3 elimina este archivo.
 */
export const PAGE_CUTOVER: boolean = false;

export function createApiPages({ cutover = PAGE_CUTOVER, ...options }: PageRepositoryOptions & { cutover?: boolean }): PageRepository {
  if (cutover) return createPageRepository(options);
  const closed = (): Promise<never> => Promise.reject(new PageUnavailableError());
  return Object.freeze<PageRepository>({ get: closed, save: closed, restorePrevious: closed });
}
