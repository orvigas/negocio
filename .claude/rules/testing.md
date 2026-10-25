# Testing

Todo cambio significativo debe incluir o actualizar pruebas.

Prioriza:

- unit tests
- integration tests
- API tests
- end-to-end tests cuando sean necesarios

Las pruebas deben validar:

- comportamiento esperado
- casos límite
- errores
- validación
- autorización
- regresiones

No escribas tests que simplemente reproduzcan la implementación interna.

## Pruebas HTTP

Las pruebas que hacen peticiones HTTP a la app crean su servidor con `listenLocal(app)` de `restaurante/landing-pages/tests/support/http.ts` (o con `setupAdmin`, que la usa), dentro de cada prueba: escucha solo en `127.0.0.1` y se cierra sola al terminar la prueba. Nunca uses `request(app.callback())` ni `request.agent(app.callback())`: en macOS el cliente puede acabar hablando con otro proceso local (REQ-F-011). `npm run lint` lo impide. Detalles en la sección "Pruebas HTTP" del `README.md` de `restaurante/` (la raíz del monorepo).

## Base de datos de pruebas

Las pruebas que usan la base de datos corren contra MySQL 8.4 real (REQ-F-014), nunca contra una base de desarrollo o de producción. Usa `makeDatabase()`, `setupAdmin()` o `makeScratchDatabase()` de `tests/support/`; nunca abras conexiones por tu cuenta ni leas `DATABASE_URL` en una prueba.

- `TEST_DATABASE_URL` (usuario solo DML, el de la app) y `TEST_ADMIN_DATABASE_URL` (DDL, solo el soporte de pruebas) apuntan únicamente a `127.0.0.1`, `localhost`, `::1` o `mysql-dev` y a bases con prefijo `restaurante_test`. La salvaguarda de `tests/setup/` rechaza cualquier otra antes de conectar. No la relajes.
- Sin MySQL, la suite falla con el mensaje de cómo levantarlo (`npm run db:up`). Ninguna prueba se salta por falta de base.
- El store de productos en memoria sigue siendo el doble de las pruebas unitarias.

Ejecuta las pruebas relevantes antes de considerar terminado el trabajo.
