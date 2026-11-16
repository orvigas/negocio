# Testing

Todo cambio se prueba antes de darlo por terminado, pero eso no significa que sus pruebas se queden en el repositorio. Solo llegan a `main` las pruebas funcionales y las que el usuario pida explícitamente (ver "Qué pruebas son permanentes").

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

Las apps `api` e `inventory-manager` tienen su propio `listenLocal(app)` en `restaurante/api/tests/support/http.ts` y `restaurante/inventory-manager/tests/support/http.ts`: escucha en `127.0.0.1` con un puerto libre, se cierra al terminar la prueba y devuelve `{ url }` para hacer las peticiones con `fetch` (sin supertest). Lo usan `startAdmin` (`api/tests/support/admin.ts`), `startInventory` (`inventory-manager/tests/support/browser.ts`) y el doble de la API (`inventory-manager/tests/support/api-double.ts`). `npm run lint` rechaza también en sus pruebas `app.callback()` y un `listen` que no sea en `'127.0.0.1'`.

## Base de datos de pruebas

Las pruebas que usan la base de datos corren contra MySQL 8.4 real (REQ-F-014), nunca contra una base de desarrollo o de producción. Usa `makeDatabase()`, `setupAdmin()` o `makeScratchDatabase()` de `tests/support/`; nunca abras conexiones por tu cuenta ni leas `DATABASE_URL` en una prueba.

- `TEST_DATABASE_URL` (usuario solo DML, el de la app) y `TEST_ADMIN_DATABASE_URL` (DDL, solo el soporte de pruebas) apuntan únicamente a `127.0.0.1`, `localhost`, `::1` o `mysql-dev` y a bases con prefijo `restaurante_test`. La salvaguarda de `tests/setup/` rechaza cualquier otra antes de conectar. No la relajes.
- Sin MySQL, la suite falla con el mensaje de cómo levantarlo (`npm run db:up`). Ninguna prueba se salta por falta de base.
- El store de productos en memoria sigue siendo el doble de las pruebas unitarias.
- El MySQL de pruebas corta una espera de bloqueo a los 5 s (`--innodb-lock-wait-timeout=5` en `compose.yaml`; producción, 10 s).

## Duración por archivo

El CI reparte los archivos de prueba en shards por número, no por duración (REQ-F-041). Ningún archivo debe pasar de 20 s en el CI: uno más largo se parte por sus `describe`, con la preparación común en `tests/support/` y sin cambiar los casos. No acortes una espera por condición con una espera fija ni agregues `retry`, y no subas `testTimeout` ni `hookTimeout` para que un archivo quepa.

## Qué pruebas son permanentes

Probar un cambio y dejar una prueba permanente son dos decisiones distintas. Un cambio no añade pruebas permanentes por defecto. El commit y el PR solo llevan una prueba si cumple una de estas condiciones:

- es **funcional**: protege un comportamiento de la app (pedido, bot y su conversación, productos, página, permisos, sesión, CSRF, privacidad y avisos del día) o un defecto corregido de ese comportamiento, y ninguna prueba existente lo cubre;
- el usuario la **pidió explícitamente**.

Todo lo demás se ejecuta y se descarta, y no se commitea en ninguna rama que vaya a `main`, incluida `epic/arquitectura`: comprobaciones de un cambio concreto, sondas de QA, mutaciones, diferenciales, mediciones de duración y pruebas del soporte de pruebas. Su resultado queda como evidencia en el ticket o en el PR.

Cada comportamiento se prueba una vez, en la prueba más barata que lo cubra (unitaria o en proceso), en un archivo existente si es posible. Antes de añadir una prueba permanente, comprueba que no exista ya. Si dudas, no la añadas y dilo en el PR. Modificar una prueba existente porque cambió un comportamiento no cuenta como prueba nueva.

## Pruebas de arquitectura o mudanza

Los cambios de arquitectura y de tecnología no dejan pruebas permanentes. Las pruebas de QA que solo comprueban uno de esos cambios (que el comportamiento sigue igual tras mover módulos, procesos, rutas o puertos; fronteras entre paquetes; migraciones, driver o imagen) se ejecutan durante el QA del ticket y no se quedan en el repositorio: su resultado queda en el QA Report. Si una de ellas encuentra un defecto o un caso de lógica, seguridad u operación que ninguna prueba cubre, ese caso pasa a la prueba más barata de ese comportamiento, con un nombre de dominio y sin sufijo `qa-req-f-*`. Las reglas de dependencias entre paquetes se comprueban con `npm run lint`, no con pruebas.

Se conservan a propósito una cadena real de punta a punta por flujo principal, la concurrencia del último administrador y una prueba de que la app no arranca con configuración peligrosa o una base inválida.

## Limpieza al terminar

Aplica a la sesión principal y a todos los agentes. Al terminar cualquier ejecución de pruebas, medición, sonda o mutación, también si falló o se interrumpió, no debe quedar ningún remanente:

- bases `restaurante_test*` que no sean de una ejecución en curso, incluidas las vacías;
- procesos (servidores, Vitest, Chrome headless) y puertos ocupados;
- `git worktree` temporales, copias del árbol para mutaciones y sus `node_modules`;
- scripts, capturas y archivos temporales que ya no hagan falta, y pestañas de navegador abiertas para la prueba.

Comprueba la limpieza, no la supongas: `git worktree list`, los procesos y las bases que quedan en el MySQL de pruebas. Antes de borrar una base, confirma que tiene el prefijo `restaurante_test` y que ninguna ejecución en curso la usa; nunca toques una base de desarrollo ni de producción. No reutilices un remanente sin saber de dónde viene.

El resultado de la tarea indica qué se limpió. Si algo no se pudo limpiar, dilo con su nombre: no des el trabajo por terminado en silencio.

Ejecuta las pruebas relevantes antes de considerar terminado el trabajo.
