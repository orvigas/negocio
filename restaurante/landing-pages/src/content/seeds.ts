/**
 * Semillas versionadas de los datos editables (REQ-F-001, RF-1.4). Viven en core/catalog desde REQ-F-045
 * (la `api` las usa para preparar una instalación nueva); aquí solo se reexportan para las landings.
 */
export { SEED_FILES, loadSeedDocument } from '@restaurante/core/catalog';
