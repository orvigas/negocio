# Pendientes no implementados

Registro de lo que está identificado pero **no implementado**, para considerarlo en el futuro. No son tickets: cada punto de código pasa por su propio ciclo BA → senior-fullstack → QA (`CLAUDE.md` §4) antes de implementarse.

Fuentes: anexo "roadmap de despliegue en el VPS" de `done/REQ-F-014-migracion-mysql.md` (numeración definitiva), `reports/OWASP-2026-10-09-auditoria.md` y `reports/VPS-DOCKER-MYSQL-2026-10-09-analisis.md`. Los números REQ-F de los informes eran provisionales; mandan los de esta tabla.

Última actualización: 2026-10-14.

## Estado de los tickets del roadmap

| ID | Título | Hallazgos | Depende de | Prioridad | Estado |
|----|--------|-----------|------------|-----------|--------|
| REQ-F-014 | Migración a MySQL 8.4 | — | — | Salida a producción | Hecho (PR #38) |
| REQ-F-015 | Configuración segura por defecto (`HOST` y `NODE_ENV`) | F-01, F-05 | — | Salida a producción | Hecho (PR #40) |
| REQ-F-016 | Despliegue de producción con Traefik y pipeline de GitHub Actions (absorbe 017 y 021) | F-01, F-03, F-06, F-14 | 014, 015 | Salida a producción | Hecho (PR #43, en producción desde 2026-10-14; CA-9 verificado el 2026-10-14) |
| REQ-F-017 | Proxy nginx con TLS (certbot) | F-01, F-03, F-06 | 016 | — | Absorbido por REQ-F-016 (Traefik) |
| REQ-F-018 | Webhook resistente a DoS y logs sin ruido | F-03, F-13 | — | Salida a producción | Sin empezar |
| REQ-F-019 | Respaldos cifrados (Cloudflare R2 + age) y restauración probada | — | 016 | Salida a producción | Hecho (PR #51, en producción 2026-10-14; P-1 a P-4 verificados; corrección de la prueba mensual en macOS en el PR #56); pendiente observar el primer respaldo programado, el aviso de Healthchecks por falta de ping y el siguiente despliegue con `deploy/` intacto |
| REQ-F-020 | Cadena de suministro en el CI (auditoría por imagen, excepciones con caducidad, Dependabot) | F-11 | 014 | Recomendado | Hecho (PR #50, en producción 2026-10-14); pendiente ver los primeros PR de Dependabot y mejora trivial del mensaje de `audit-policy.ts:149` |
| REQ-F-021 | Publicación en GHCR y despliegue manual (`deploy.sh`) | — | 016, 019 | — | Absorbido por REQ-F-016 (pipeline) |
| REQ-F-022 | Alertas y monitorización | F-13 | 016 | Salida a producción | Sin empezar |
| REQ-F-023 | Guía de despliegue en el VPS y checklist de salida | — | 016 a 022 | Salida a producción | Sin empezar |
| REQ-F-024 | Límite de intentos robusto y sesión | F-02, F-12 | — | Antes de anunciar el bot | Sin empezar |
| REQ-F-025 | Topes de coste, abuso del bot, lista negra e interruptor de emergencia | F-04 | — | Antes de anunciar el bot | Hecho (PR #58, en producción desde 2026-10-15; `deploy/` reinstalado); falta `WHATSAPP_BOT_BLOCKLIST_KEY` en el `.env` del VPS al activar el bot |
| REQ-F-026 | scrypt y permisos de `DATA_DIR` | F-07 | 016 | Después | Sin empezar |
| REQ-F-027 | Cabeceras de seguridad y fuentes propias | F-09, F-10 | — | Después | Sin empezar |
| REQ-F-028 | Birria como índice permanente con modales de martes a viernes y lunes | — | 010 | Producto | Hecho (PR #45, en producción desde 2026-10-14) |

- **Mínimo para salir a producción:** 014 a 016, 018, 019, 022 y 023 (020 recomendado), más el límite de gasto en Meta (I-5). Desde 2026-10-14, 019 ya no bloquea el despliegue de 016 (volcado local previo a migrar), pero sigue siendo necesario.
- **Antes de anunciar el bot:** 024 y 025, o el riesgo aceptado por escrito.
- Las decisiones ya tomadas por el usuario el 2026-10-09 para cada ticket están en el anexo de REQ-F-014; se validan de nuevo al redactar cada ticket.

## Temas abiertos por ticket

- **REQ-F-016 (hecho):** si MySQL deja de estar en la red interna de Docker, TLS a MySQL pasa a ser obligatorio (hoy se usa `allowPublicKeyRetrieval`).
- **REQ-F-017 (absorbido por 016):** documentación de `X-Forwarded-Host` (sacado de REQ-F-015). `/admin` sin restricción por IP, con límite de peticiones en Traefik. No duplicar HSTS en Traefik (helmet ya lo envía).
- **REQ-F-020 (hecho):** queda GHSA-cx2f (moderate, `mariadb`), que se corrige con `mariadb` 3.5.4 cuando el adaptador de Prisma lo admita; `braces` (high) solo en desarrollo.
- **REQ-F-023:** `docs/despliegue.md` ya se reescribió en REQ-F-016; falta el checklist de salida y revisar `CLAUDE.md` y el agente `senior-fullstack` donde cambien hechos, con aprobación.
- **REQ-F-024:** umbrales por IP (IPv6 agrupada por /64) y por cuenta a definir con el BA; caducidad absoluta de la sesión; límite sobre la contraseña actual en "Mi cuenta"; no descartar entradas bloqueadas al llenarse la tabla. MFA a valorar.
- **REQ-F-025:** topes de pedidos y mensajes por número y día y de gasto saliente, a definir con el BA.
- **REQ-F-026:** re-hash transparente de scrypt; medir la memoria por intento con el `mem_limit` de la app (`N=2^17` ≈ 128 MiB por hash).
- **REQ-F-027:** CSP más estricta y `Permissions-Policy`; alojar las fuentes en el propio servidor en lugar de Google Fonts (pregunta abierta: el diseño fuente usa Google Fonts).

## Bot de WhatsApp en producción

- **2026-10-14 (tarde):** bot probado de punta a punta en local con Meta (número de prueba +1 555 672 7947, app "Birrieria el muñeco" id 1138922872042836, WABA 1656975162763289). Token permanente de usuario del sistema creado. Plantilla `nuevo_pedido` (UTILITY, es_MX) enviada a revisión (id 1974953166508472). En `/opt/restaurante/.env` del VPS hay un bloque **comentado** con toda la configuración del bot (validada en el contenedor); se activa con los pasos que trae. Falta: número real + verificación de la empresa (Paso 3), plantilla aprobada, segunda app de Meta para desarrollo (la de producción es "Birrieria el muñeco"), PR #47 (números MX) y el PR del texto de la plantilla. Con el bot activo, los CTA de la web apuntan al número del bot: no activarlo con el número de prueba.
- **2026-10-14:** primera salida a producción **sin bot** (todas las `WHATSAPP_BOT_*` vacías; el webhook responde 503). El usuario aún no tiene cuenta de Meta. Twilio sigue prohibido en producción (REQ-F-012, D-5/RN-8) y, para clientes reales, también exige Meta Business. Para activarlo: completar las `WHATSAPP_BOT_*` en `/opt/restaurante/.env` y volver a desplegar; después, registrar el webhook (`docs/despliegue.md` §7). Antes de anunciarlo: REQ-F-024, REQ-F-025 e I-5.

## Tareas de infraestructura del usuario (no son código)

Detalle en `reports/OWASP-2026-10-09-auditoria.md` §6.1 y en el checklist de `reports/VPS-DOCKER-MYSQL-2026-10-09-analisis.md` §7.2.

- **I-1 Firewall:** (hecho 2026-10-14: ufw 22/80/443 y SSH solo con llave).
- **I-2 Borde con TLS** (lo cubre REQ-F-016 con el Traefik del VPS).
- **I-3 Servicio del sistema** (con Docker lo sustituye el compose de REQ-F-016).
- **I-4 Secretos:** `.env` con permisos 600 (hecho); la copia cifrada fuera del VPS la cubre REQ-F-019 (RF-9). Rotar el Auth Token de Twilio (se expuso en una sesión el 2026-10-14).
- **I-5 Meta:** Meta no ofrece límite de gasto para esta cuenta (solo a clientes con factura que Meta designa; comprobado el 2026-10-14). Se sustituye por una **tarjeta virtual con límite bajo** solo para Meta y revisar "Actividad de pago"; el resto lo cubre REQ-F-025 (topes y presupuesto estimado en la app). Imprescindible antes de anunciar el bot.
- **I-6 Logs:** rotación y alertas (con REQ-F-022).
- **I-7 Respaldos** (con REQ-F-019): bucket con bloqueo (bucket locks) y ciclo de vida, hecho el 2026-10-14. Pendiente: guardar la clave `age` privada en el gestor de contraseñas de una segunda persona.
- **I-8 Sistema operativo:** hecho 2026-10-14: unattended-upgrades activo, fail2ban (jail sshd sobre `ssh.service`), swap de 2 GB con swappiness 10, paquetes al día y reinicio. Falta: reinicio automático en la ventana de 04:00 a 05:00 (hora de México).
- **I-9 Despliegue:** solo dependencias de producción en la imagen (ya resuelto por la imagen `production`).

## Notas de REQ-F-015 para el futuro

- Un `.env` local sin `NODE_ENV` ya no arranca con `npm start`; hay que añadir `NODE_ENV=development` o `production`. `npm run dev` lo fija solo.
- Algunos shells (p. ej. `tcsh`) exportan `HOST` con el nombre de la máquina, y la app no arranca. Es un fallo seguro y está documentado.
- La escucha real en `::1` y `::` no se prueba dentro del contenedor de pruebas (Docker suele desactivar IPv6); sí en macOS y en el CI.
- Las URLs locales de la documentación pasaron a `127.0.0.1:3000`: herramientas como `cloudflared` resuelven `localhost` a `::1`, donde la app ya no escucha por defecto.

## Contenido editable de Birria fuera de alcance (REQ-F-032)

Viven en MySQL o en /admin y no cambian con el despliegue. Corregirlos requiere editarlos en /admin o un ticket propio.

- **Productos de Birria (MySQL; semilla `restaurante/src/content/birria/seed.json`):** las descripciones dicen "birria tatemada", "tuétano a la brasa", "canela de Ceilán" y "cilantro criollo", que no están confirmados. Los gramajes (500 ml + 150 g, 250 ml + 80 g) son aproximados según el usuario: si se publican, deben indicar que son aproximados. La semilla tampoco se actualizó.
- **Showcase del hero de Birria (/admin/birria):** "Tostado de Comal / Con costra de queso fundido & adobo", sin verificar.
- **Promoción de Birria (/admin/birria):** "Club El Muñeco / Domingos de Birria Familiar" con "litros al 2x1" y "tortillas ilimitadas", sin confirmar. REQ-F-032 solo cambia el botón ("Activar promoción"), el mensaje de éxito y el aviso legal (decisión por defecto V-3). Sustituir por un texto genérico como el de Molotes o por la promoción real.

## Descartados

- Migración de datos desde SQLite (D-2).
- Persistencia de los ids procesados del webhook (F-15): riesgo teórico; requeriría una tabla nueva y una decisión explícita.
- Coexistencia de WhatsApp Business app y Cloud API en el mismo número (2026-10-14): el número del bot se registró directo en la Cloud API; exigiría volver a la app, calentar el número, Embedded Signup (BSP o Tech Provider) y tratar los ecos (`smb_message_echoes`) en el bot. El cliente que necesita a una persona recibe el contacto directo del personal.
- Twilio en producción (2026-10-14): también exige Meta Business y no evita la verificación; se usa Meta directo sin verificar (TIER_250).
