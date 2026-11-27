import Router from '@koa/router';

import type { AccountController } from './controllers/account.ts';
import type { AdminController } from './controllers/admin.ts';
import type { BotController } from './controllers/bot.ts';
import type { DocumentController } from './controllers/inventory-documents.ts';
import type { KardexController } from './controllers/inventory-kardex.ts';
import type { RecipeController } from './controllers/inventory-recipes.ts';
import type { InventoryController } from './controllers/inventory.ts';
import type { PageController } from './controllers/page.ts';
import type { QuoteController } from './controllers/quote.ts';
import type { UsersController } from './controllers/users.ts';

/**
 * Rutas del admin nuevo (REQ-F-039). Todas las pantallas funcionan sin JavaScript (POST/redirect/GET).
 *
 * GET  /salud                                  -> 200 (sin llamar a la API: salud del contenedor)
 * GET  /acceso | POST /acceso | POST /salir    -> entrar y salir
 * GET  /                                       -> selector de negocio (o el único permitido)
 * GET  /:negocio/productos                     -> lista por categoría, en orden
 * GET  /:negocio/productos/nuevo | POST /:negocio/productos                 -> alta
 * GET  /:negocio/productos/eliminados          -> eliminados (POST …/:id/recuperar)
 * GET  /:negocio/productos/:id/editar | POST /:negocio/productos/:id         -> edición
 * GET|POST /:negocio/productos/:id/eliminar    -> confirmar y eliminar
 * POST /:negocio/productos/:id/subir | …/bajar -> orden (con JS, fragmento de la lista)
 *
 * Datos de página (REQ-F-044):
 * GET  /:negocio/pagina | POST /:negocio/pagina -> edición, o el aviso "no disponible"
 * GET|POST /:negocio/pagina/restaurar          -> confirmar y restaurar la versión anterior
 *
 * Usuarios y "Mi cuenta" (REQ-F-040):
 * GET  /usuarios                               -> lista (solo administradores)
 * GET  /usuarios/nuevo | POST /usuarios        -> alta
 * GET  /usuarios/:id/editar | POST /usuarios/:id -> edición
 * POST /usuarios/:id/desactivar | …/reactivar  -> estado
 * GET|POST /usuarios/:id/contrasena            -> restablecer la contraseña
 * GET|POST /cuenta                             -> cambiar la propia contraseña (cualquier usuario)
 *
 * Cotizador de taquizas (REQ-F-046, solo administradores y solo Birria; ruta fija: /molotes/cotizador da 404):
 * GET  /birria/cotizador                       -> formulario GET; con `calcular=1`, 303 a la URL de diferencias
 *
 * Control del bot (REQ-F-043, solo administradores):
 * GET  /bot                                    -> estado, uso, topes y lista negra
 * POST /bot/interruptor                        -> pausar o reanudar
 * POST /bot/bloqueos                           -> alta manual
 * POST /bot/bloqueos/:id/quitar                -> baja
 * POST /bot/topes/:token/bloquear              -> bloquear desde "alcanzaron un tope hoy"
 *
 * Inventario (REQ-F-049, T1; solo administradores y gerentes):
 * GET  /inventario                             -> 303 a /inventario/articulos
 * GET  /inventario/articulos                   -> lista con filtros (GET) y páginas
 * GET  /inventario/articulos/nuevo[?clase=padre|?padre=<id>] | POST /inventario/articulos -> alta
 * GET  /inventario/articulos/:id[?cantidad=&unidad=] -> ficha (y conversión)
 * GET  /inventario/articulos/:id/editar | POST /inventario/articulos/:id -> edición (409: guardar encima)
 * GET|POST /inventario/articulos/:id/desactivar -> confirmar e inactivar (con sus variantes)
 * POST /inventario/articulos/:id/reactivar     -> reactivar
 * GET  /inventario/categorias | POST /inventario/categorias -> lista y alta
 * GET  /inventario/categorias/:id/editar | POST /inventario/categorias/:id -> renombrar
 * POST /inventario/categorias/:id/desactivar | …/reactivar -> estado
 *
 * Recetas (REQ-F-050, T2; solo administradores y gerentes):
 * GET  /inventario/recetas[?tipo=&q=&pagina=]   -> lista de vigentes con su costo teórico
 * GET  /inventario/articulos/:id/receta         -> vigente con su costo, faltantes e historial
 * GET  /inventario/articulos/:id/receta/nueva | POST /inventario/articulos/:id/receta -> editor de versión
 *      (`action=rows`: 10 filas más sin guardar; 409: guardar sobre la vigente)
 * GET|POST /inventario/articulos/:id/receta/cerrar -> confirmar y cerrar la receta
 * GET  /inventario/recetas/versiones/:id        -> versión del historial (solo lectura, sin costo)
 */
export function createRouter({
  admin: controller,
  users,
  account,
  bot,
  page,
  quote,
  inventory,
  recipes,
  kardex,
  documents,
}: {
  admin: AdminController;
  users: UsersController;
  account: AccountController;
  bot: BotController;
  page: PageController;
  quote: QuoteController;
  inventory: InventoryController;
  recipes: RecipeController;
  kardex: KardexController;
  documents: DocumentController;
}): Router {
  const router = new Router();
  router.get('/salud', (ctx) => {
    ctx.type = 'text';
    ctx.body = 'ok';
  });
  router.get('/acceso', controller.loginPage);
  router.post('/acceso', controller.login);
  router.post('/salir', controller.logout);
  router.get('/', controller.home);
  // Usuarios y bot antes que productos: `/usuarios/productos` no es el negocio "usuarios".
  router.get('/usuarios', users.list);
  router.post('/usuarios', users.create);
  router.get('/usuarios/nuevo', users.newPage);
  router.get('/usuarios/:id/editar', users.editPage);
  router.post('/usuarios/:id', users.update);
  router.post('/usuarios/:id/desactivar', users.deactivate);
  router.post('/usuarios/:id/reactivar', users.reactivate);
  router.get('/usuarios/:id/contrasena', users.passwordPage);
  router.post('/usuarios/:id/contrasena', users.resetPassword);
  router.get('/bot', bot.page);
  router.post('/bot/interruptor', bot.toggle);
  router.post('/bot/bloqueos', bot.block);
  router.post('/bot/bloqueos/:id/quitar', bot.unblock);
  router.post('/bot/topes/:token/bloquear', bot.blockReached);
  router.get('/inventario', inventory.root);
  router.get('/inventario/articulos', inventory.items);
  router.post('/inventario/articulos', inventory.createItem);
  router.get('/inventario/articulos/nuevo', inventory.newItem);
  router.get('/inventario/articulos/:id', inventory.item);
  router.post('/inventario/articulos/:id', inventory.updateItem);
  router.get('/inventario/articulos/:id/editar', inventory.editItem);
  router.get('/inventario/articulos/:id/desactivar', inventory.deactivatePage);
  router.post('/inventario/articulos/:id/desactivar', inventory.deactivateItem);
  router.post('/inventario/articulos/:id/reactivar', inventory.reactivateItem);
  router.get('/inventario/articulos/:id/receta', recipes.recipe);
  router.post('/inventario/articulos/:id/receta', recipes.save);
  router.get('/inventario/articulos/:id/receta/nueva', recipes.editor);
  router.get('/inventario/articulos/:id/receta/cerrar', recipes.closePage);
  router.post('/inventario/articulos/:id/receta/cerrar', recipes.close);
  router.get('/inventario/recetas', recipes.list);
  router.get('/inventario/recetas/versiones/:id', recipes.version);
  // REQ-F-051: existencias, proveedores, documentos y reversión. Ninguna pantalla edita ni borra documentos.
  router.get('/inventario/existencias', kardex.stock);
  router.get('/inventario/proveedores', kardex.suppliers);
  router.post('/inventario/proveedores', kardex.createSupplier);
  router.get('/inventario/proveedores/nuevo', kardex.newSupplier);
  router.get('/inventario/proveedores/:id/editar', kardex.editSupplier);
  router.post('/inventario/proveedores/:id', kardex.updateSupplier);
  router.post('/inventario/proveedores/:id/desactivar', kardex.deactivateSupplier);
  router.post('/inventario/proveedores/:id/reactivar', kardex.reactivateSupplier);
  router.get('/inventario/documentos', kardex.documents);
  // REQ-F-051 (PR 3b): formularios con líneas; antes que /documentos/:id.
  router.get('/inventario/documentos/nuevo/:tipo', documents.newDocument);
  router.post('/inventario/documentos/nuevo/:tipo', documents.createDocument);
  router.get('/inventario/documentos/:id/devolver', documents.returnPage);
  router.post('/inventario/documentos/:id/devolver', documents.createReturn);
  router.get('/inventario/documentos/:id', kardex.document);
  router.get('/inventario/documentos/:id/revertir', kardex.reversalPage);
  router.post('/inventario/documentos/:id/revertir', kardex.reverse);
  router.get('/inventario/categorias', inventory.categories);
  router.post('/inventario/categorias', inventory.createCategory);
  router.get('/inventario/categorias/:id/editar', inventory.editCategory);
  router.post('/inventario/categorias/:id', inventory.renameCategory);
  router.post('/inventario/categorias/:id/desactivar', inventory.deactivateCategory);
  router.post('/inventario/categorias/:id/reactivar', inventory.reactivateCategory);
  router.get('/cuenta', account.page);
  router.post('/cuenta', account.changePassword);
  router.get('/:business/productos', controller.products);
  router.post('/:business/productos', controller.create);
  router.get('/:business/productos/nuevo', controller.newProduct);
  router.get('/:business/productos/eliminados', controller.deleted);
  router.get('/:business/productos/:id/editar', controller.editPage);
  router.post('/:business/productos/:id', controller.update);
  router.get('/:business/productos/:id/eliminar', controller.deletePage);
  router.post('/:business/productos/:id/eliminar', controller.remove);
  router.post('/:business/productos/:id/recuperar', controller.restore);
  router.post('/:business/productos/:id/subir', controller.moveUp);
  router.post('/:business/productos/:id/bajar', controller.moveDown);
  router.get('/birria/cotizador', quote.page);
  router.get('/:business/pagina', page.edit);
  router.post('/:business/pagina', page.save);
  router.get('/:business/pagina/restaurar', page.restorePage);
  router.post('/:business/pagina/restaurar', page.restore);
  return router;
}
