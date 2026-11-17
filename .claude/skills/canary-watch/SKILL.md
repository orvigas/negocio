---
name: canary-watch
description: Monitorea y verifica las URL desplegadas después de los lanzamientos comprobando endpoints HTTP, flujos SSE, recursos estáticos, errores de consola y regresiones de rendimiento tras despliegues, merges o actualizaciones de dependencias. Verificación de humo (smoke), canario y posterior al despliegue.
metadata:
  origin: ECC
---

<!-- Traducción al español de `skills/canary-watch/SKILL.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

# Canary Watch — Monitoreo posterior al despliegue

## Cuándo usarlo

- Después de desplegar a producción o a staging
- Después de fusionar un PR arriesgado
- Cuando quieres verificar que una corrección realmente corrigió el problema
- Monitoreo continuo durante una ventana de lanzamiento
- Después de actualizar dependencias

## Cómo funciona

Monitorea una URL desplegada en busca de regresiones. Se ejecuta en bucle hasta que se detiene o hasta que expira la ventana de vigilancia.

### Qué vigila

```
1. Estado HTTP — ¿la página devuelve 200?
2. Errores de consola — ¿hay errores nuevos que antes no estaban?
3. Fallos de red — ¿llamadas a la API fallidas, respuestas 5xx?
4. Rendimiento — ¿regresión de LCP/CLS/INP respecto a la línea base?
5. Contenido — ¿desaparecieron elementos clave? (h1, nav, footer, CTA)
6. Salud de la API — ¿los endpoints críticos responden dentro del SLA?
7. Recursos estáticos — ¿las peticiones de JS, CSS, imágenes y fuentes devuelven 2xx/3xx con los tipos de contenido esperados?
8. Flujos SSE — ¿los endpoints de event-stream se conectan y reciben un evento inicial o un heartbeat?
```

### Modos de vigilancia

**Comprobación rápida** (por defecto): una sola pasada, informa los resultados
```
/canary-watch https://myapp.com
```

**Vigilancia sostenida**: comprueba cada N minutos durante M horas
```
/canary-watch https://myapp.com --interval 5m --duration 2h
```

**Modo diferencial**: compara staging con producción
```
/canary-watch --compare https://staging.myapp.com https://myapp.com
```

### Umbrales de alerta

```yaml
critical:  # alerta inmediata
  - Estado HTTP != 200
  - Número de errores de consola > 5 (solo errores nuevos)
  - LCP > 4s
  - El endpoint de la API devuelve 5xx
  - Un recurso estático devuelve 4xx/5xx
  - El endpoint SSE no puede conectarse o se cae antes del primer heartbeat

warning:   # se señala en el informe
  - El LCP aumentó > 500ms respecto a la línea base
  - CLS > 0.1
  - Nuevas advertencias de consola
  - Tiempo de respuesta > 2x la línea base
  - El tipo de contenido de un recurso estático cambió inesperadamente
  - La latencia del heartbeat SSE > 2x la línea base

info:      # solo se registra
  - Variación menor de rendimiento
  - Nuevas peticiones de red (¿se añadieron scripts de terceros?)
```

### Notificaciones

Cuando se cruza un umbral crítico:
- Notificación de escritorio (macOS/Linux)
- Opcional: webhook de Slack/Discord
- Registro en `~/.claude/canary-watch.log`

## Salida

```markdown
## Informe del canario — myapp.com — 2026-03-23 03:15 PST

### Estado: SANO ✓

| Comprobación | Resultado | Línea base | Delta |
|-------|--------|----------|-------|
| HTTP | 200 ✓ | 200 | — |
| Errores de consola | 0 ✓ | 0 | — |
| LCP | 1.8s ✓ | 1.6s | +200ms |
| CLS | 0.01 ✓ | 0.01 | — |
| API /health | 145ms ✓ | 120ms | +25ms |
| Recursos estáticos | 42/42 ✓ | 42/42 | — |
| SSE /events | conectado ✓ | conectado | +80ms de heartbeat |

### No se detectaron regresiones. El despliegue está limpio.
```

## Integración

Combínalo con:
- `/browser-qa` para la verificación previa al despliegue
- Hooks: agrégalo como un hook PostToolUse sobre `git push` para comprobar automáticamente después de los despliegues
- CI: ejecútalo en GitHub Actions después del paso de despliegue

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga.

- **Solo lectura.** Vigila, no modifica nada: no despliegues, no reinicies contenedores, no mandes mensajes reales al bot de WhatsApp ni toques el VPS. Las comprobaciones por SSH al VPS (acceso en `restaurante/docs/despliegue.md`) son solo de lectura, con autorización del usuario y sin imprimir secretos.
- **No hay comando `/canary-watch`, ni `/browser-qa`, ni hooks instalados.** Se invoca en lenguaje natural («haz un canary-watch de producción»). No añadas un hook sobre `git push`, ni notificaciones de escritorio, ni webhooks de Slack/Discord, ni el registro en `~/.claude/canary-watch.log`, salvo que el usuario lo pida expresamente.
- **Qué URL vigilar (producción).**
  - `https://birriaelmuneco.com/`, `/molotes` y `/birria`: 200.
  - `https://birriaelmuneco.com/admin`: 302 a `https://admin.birriaelmuneco.com/`, con `no-store` y `noindex`, sin cookies.
  - `https://admin.birriaelmuneco.com/`: 303 a `/acceso` sin sesión.
  - El límite de tasa de `inventory-manager` (429) existe a propósito: una ráfaga de comprobaciones puede dispararlo. Haz pocas peticiones y espacíalas.
- **Contenido clave de las landings:** `h1`, navegación, pie y el botón de pedidos de WhatsApp (`.claude/CLAUDE.md` §6). Los avisos del día (modal) dependen de la fecha del negocio (`BUSINESS_TIMEZONE`): un aviso distinto según el día no es una regresión.
- **SSE:** este proyecto no tiene endpoints SSE; omite ese punto.
- **Navegador:** para consola, red y rendimiento usa Claude in Chrome (herramientas `mcp__claude-in-chrome__*`), cerrando las pestañas al terminar; con `curl` basta para el estado y las cabeceras.
- **Después de cada despliegue a producción**, las comprobaciones habituales del proyecto están en `restaurante/docs/despliegue.md` (contenedores sanos, `api` sana, `30 x 302` en `/admin/login`, volumen `app-data` sin montar). Esta skill las complementa, no las sustituye.
- Los umbrales de rendimiento (LCP, CLS) son orientativos: tómalos como línea base de este sitio, no como regla.
- El informe va en español.
