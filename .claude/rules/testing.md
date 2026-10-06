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

Las pruebas que hacen peticiones HTTP a la app crean su servidor con `listenLocal(app)` de `restaurante/tests/support/http.ts` (o con `setupAdmin`, que la usa), dentro de cada prueba: escucha solo en `127.0.0.1` y se cierra sola al terminar la prueba. Nunca uses `request(app.callback())` ni `request.agent(app.callback())`: en macOS el cliente puede acabar hablando con otro proceso local (REQ-F-011). `npm run lint` lo impide. Detalles en la sección "Pruebas HTTP" del `README.md` de `restaurante/`.

Ejecuta las pruebas relevantes antes de considerar terminado el trabajo.
