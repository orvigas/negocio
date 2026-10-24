# Análisis: despliegue en un VPS de Hostinger con Docker y migración a MySQL

Fecha: 2026-10-09. Autor: senior-fullstack (fase de análisis, solo lectura). No se modificó código, configuración, git ni `.env`. El árbol de trabajo estaba en `feature/bot-emojis`; los emojis del bot ya están en el commit 6be8a41 (PR #37). No se tocó.

Fuentes leídas:

- `CLAUDE.md` y `.claude/rules/`;
- el informe `OWASP-2026-10-09-auditoria.md` (F-01 a F-15, I-1 a I-9 y REQ-F-014 a REQ-F-020 propuestos);
- `restaurante/README.md` y `restaurante/docs/despliegue.md`;
- `Dockerfile`, `compose.yaml`, `.dockerignore`, `.gitignore` y `.github/workflows/ci.yml`;
- `prisma/schema.prisma`, `prisma.config.ts` y las dos migraciones;
- `src/db/*` y `src/server.ts`;
- `src/config/env.ts`;
- los repositorios de usuarios y productos y sus stores;
- `scripts/admin-recover.ts`;
- `tests/support/database.ts`, `tests/support/admin.ts` y las pruebas que usan SQLite.

Se usó CodeGraph para los repositorios y sus consumidores.

Verificado en local: Prisma CLI y cliente 7.10.0, Node 24 (`.nvmrc`). `node_modules/@prisma` solo trae `adapter-better-sqlite3`. `mysql2` existe solo como dependencia del CLI de Prisma.

> **Sin acceso a internet.** Lo que depende de Hostinger (planes, precios, snapshots, firewall del panel, plantillas de SO) o de versiones publicadas después de mi corte (nombre y versión exacta del adaptador MySQL de Prisma 7, digests de imágenes) va marcado **[verificar]**.

---

## 1. Resumen ejecutivo

1. **Es viable y encaja con la app.** La app ya tiene una imagen `production` multi-stage, sin root y con Node ejecutando TypeScript directamente. Todo el acceso a datos pasa por Prisma (sin SQL crudo fuera de las migraciones) y no usa funciones exclusivas de SQLite (`mode: 'insensitive'`, `$queryRaw`, etc.). El cambio de proveedor se concentra en:
   - `prisma/schema.prisma` y las migraciones;
   - `src/db/` (cliente, migrador de arranque y errores);
   - `src/config/env.ts` (nueva `DATABASE_URL`);
   - `scripts/admin-recover.ts`;
   - el soporte de pruebas (`tests/support/database.ts`), que hoy crea un `.db` por prueba (58 llamadas a `setupAdmin` y 5 a `makeDatabase`).
2. **Arquitectura recomendada:** `docker compose` en un solo VPS (Ubuntu 24.04 LTS) con:
   - **nginx** (TLS de Let's Encrypt con certbot) como único servicio con puertos publicados (80 y 443);
   - la **app** (una sola réplica: sesiones, límites y conversaciones del bot viven en memoria);
   - **MySQL 8.4 LTS** sin puertos publicados;
   - un servicio puntual **migrate** (`prisma migrate deploy`, con un usuario de BD con DDL).

   La app usa un usuario de BD solo con DML. Tres redes: `edge` (pública), `frontend` (interna, proxy a app) y `backend` (interna, app y migrate a MySQL), más `egress` para que la app llame a Meta. Imágenes publicadas en **GHCR** desde el CI y desplegadas por digest.
3. **Los riesgos principales del cambio a MySQL** (detalle en §5):
   - **Invariante D-7** ("siempre un administrador activo"). Hoy es correcta porque SQLite tiene un único escritor. En MySQL (REPEATABLE READ) dos desactivaciones simultáneas pueden dejar cero administradores. Hay que usar transacciones `Serializable` o bloqueo explícito, con reintento ante interbloqueo.
   - **Las migraciones DDL de MySQL no son transaccionales:** se pierde la garantía actual de "cada migración es atómica".
   - **Colación:** recomiendo `utf8mb4` + `utf8mb4_0900_bin` para conservar exactamente la semántica actual (SQLite compara en BINARY y la app ya normaliza el usuario). `utf8mb4_0900_ai_ci` volvería iguales "jose" y "josé" en el índice único.
   - **Longitudes:** `String` de Prisma pasa a `VARCHAR(191)`. `description` (400) y los JSON de auditoría (`changes`) necesitan `@db.VarChar(n)` o `@db.Text`.
   - **Pruebas:** necesitan un MySQL real (servicio en el CI y contenedor local).
4. **Seguridad:** la arquitectura resuelve por infraestructura F-01, F-03 (en gran parte), F-05, F-06, F-14 e I-1 a I-4 e I-9. **F-08 desaparece** (ya no hay `.db`) y se sustituye por la protección del volumen de MySQL, de los respaldos y del `.env`. Siguen haciendo falta los tickets de código REQ-F-014 a REQ-F-020 (algunos con alcance ajustado; ver §4 y §7).
5. **Esfuerzo total estimado:** dos tickets L (MySQL; compose, imagen y proxy si se agrupan), cinco o seis M y varios S. Orden recomendado (§7): REQ-F-014, después MySQL, después imagen, compose y proxy, después REQ-F-016, después backups y CI/CD, y por último el resto de los de OWASP.
6. **Decisiones pendientes del usuario (§9):**
   - plan del VPS;
   - dominio;
   - si hay datos reales en SQLite;
   - GHCR o build en el VPS;
   - nginx o Caddy;
   - Cloudflare;
   - quién respalda;
   - MySQL en contenedor o gestionado;
   - método de migraciones.

---

## 2. Arquitectura objetivo en el VPS

### 2.1 Diagrama

```text
                               Internet
                                  │
                 solo TCP 80 y 443 (y 22 restringido a IP de administración)
                                  │
          ┌───────────────────────┴────────────────────────┐
          │ Firewall del panel de Hostinger [verificar]    │  ← capa externa (Docker no la salta)
          └───────────────────────┬────────────────────────┘
VPS Ubuntu 24.04 LTS · UFW (deny in) · fail2ban · unattended-upgrades · UTC + NTP
┌─────────────────────────────────┴──────────────────────────────────────────────────┐
│                                                                                    │
│  red "edge" (bridge)        published: 80:8080, 443:8443                           │
│  ┌──────────────────────────────────────────────┐   vol certs (ro)  /etc/letsencrypt│
│  │ proxy  nginx-unprivileged (UID 101)          │◄─ vol acme-webroot (ro)          │
│  │ TLS 1.2/1.3 · 80→443 · server_tokens off     │◄─ conf nginx (ro, del repo)      │
│  │ client_max_body_size por ruta · limit_req     │                                  │
│  │ X-Forwarded-* sobrescritas · default 444     │                                  │
│  └──────────────────────┬───────────────────────┘                                  │
│                         │ red "frontend" (internal: true, sin salida a internet)    │
│  ┌──────────────────────▼───────────────────────┐   red "egress" (bridge, sin puertos│
│  │ app  ghcr.io/orvigas/restaurante@sha256:…    │──► publicados) → graph.facebook.com│
│  │ Koa :3000 (expose, sin ports) · UID 1000     │                                  │
│  │ read_only · tmpfs /tmp · cap_drop ALL        │──► vol app-data → /var/lib/restaurante
│  │ NODE_ENV=production · TRUST_PROXY=true       │     (JSON de página, changes.jsonl)│
│  │ 1 réplica (estado en memoria)                │                                  │
│  └──────────────────────┬───────────────────────┘                                  │
│                         │ red "backend" (internal: true)                            │
│  ┌──────────────────────▼───────────────────────┐                                  │
│  │ mysql  mysql:8.4@sha256:… · :3306 sin ports  │──► vol mysql-data → /var/lib/mysql│
│  │ utf8mb4 / utf8mb4_0900_bin · TZ +00:00       │   secretos: /run/secrets/*        │
│  │ usuarios: app_rw (DML) · migrator (DDL)      │                                  │
│  │           backup (solo lectura)              │                                  │
│  └──────────────────────▲───────────────────────┘                                  │
│                         │                                                          │
│  migrate (one-shot, red backend): prisma migrate deploy con migrator               │
│  certbot (one-shot, red edge): certonly/renew por webroot                           │
│                                                                                    │
│  Host (systemd timers, fuera de los contenedores):                                 │
│   · backup.sh  → mysqldump (usuario backup) + tar de app-data → age → rclone ⇒ fuera│
│   · certbot renew + nginx -s reload (2 veces al día)                               │
│   · alerts.sh  → busca eventos en `docker compose logs --since` → correo/ntfy      │
│   · logs de Docker: json-file max-size 10m × 5                                     │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Contenedores

| Servicio | Imagen | Expone | Redes | Reinicio | Notas |
|----------|--------|--------|-------|----------|-------|
| `proxy` | `nginxinc/nginx-unprivileged:<stable>-alpine@sha256:…` [verificar el tag] | **Publica 80→8080 y 443→8443** (únicos puertos publicados) | `edge`, `frontend` | `unless-stopped` | Sin root, así que no necesita `NET_BIND_SERVICE`. |
| `app` | `ghcr.io/orvigas/restaurante:<sha>@sha256:…` (target `production`) | `expose: 3000` (sin `ports`) | `frontend`, `backend`, `egress` | `unless-stopped` | Una sola réplica, `init: true` y `stop_grace_period: 20s`. |
| `mysql` | `mysql:8.4@sha256:…` (LTS) | nada (sin `ports`) | `backend` | `unless-stopped` | X Protocol desactivado (`mysqlx=OFF`), `local_infile=0` y `skip-name-resolve`. |
| `migrate` | `ghcr.io/orvigas/restaurante-migrate:<sha>@sha256:…` (target nuevo `migrate`) | nada | `backend` | `no` | Se ejecuta antes de la app (`depends_on: condition: service_completed_successfully`) o a mano en cada despliegue. |
| `certbot` | `certbot/certbot:<ver>@sha256:…` | nada | `edge` | `no` (perfil `ops`) | Solo emite y renueva por webroot. |

### 2.3 Proxy: nginx con certbot (recomendado) frente a Caddy

| Criterio | nginx + certbot | Caddy |
|----------|-----------------|-------|
| TLS automático y renovación | Hay que montarlo: certbot más un timer y una recarga | Nativo y sin piezas extra |
| `limit_req` / `limit_conn` (F-02, F-03 e I-2) | **Nativos** | **No vienen en la imagen estándar.** Exigen el plugin `caddy-ratelimit` y una imagen propia con `xcaddy` (más cadena de suministro que mantener) |
| `client_max_body_size` por `location` | Nativo | `request_body { max_size }` nativo |
| Rechazar un POST al webhook **sin cabecera de firma antes de leer el cuerpo** (F-03) | `map` + `return 401` en la fase rewrite, antes de leer el cuerpo | Posible con `@matcher` + `respond`; hay que verificar que no lea el cuerpo |
| Coincidencia con el informe OWASP | El plan I-2 ya está escrito para nginx | Hay que traducirlo |
| Superficie y madurez | Muy conocida; imagen oficial sin root | Muy buena, Go y memoria segura |

**Recomendación: nginx** (imagen `nginx-unprivileged`) con certbot por webroot. Motivos: la limitación de peticiones nativa es justo la mitigación que piden F-02 y F-03; el plan OWASP I-2 se aplica tal cual; y no hay que compilar una imagen propia del proxy. La única desventaja, la renovación del certificado, se resuelve con un timer de systemd de cinco líneas (§6.3). Si el usuario prefiere simplicidad por encima de la limitación de peticiones en el proxy, Caddy es una alternativa válida siempre que REQ-F-015 y REQ-F-016 estén implementados en la app.

### 2.4 Redes

| Red | Tipo | Quién | Para qué |
|-----|------|-------|----------|
| `edge` | bridge, con puertos publicados (solo en `proxy`) | `proxy`, `certbot` | Tráfico de internet hacia el proxy; salida de certbot hacia Let's Encrypt |
| `frontend` | `internal: true` | `proxy`, `app` | Única vía de entrada a la app. Ningún otro contenedor puede falsificar `X-Forwarded-*` (F-01) |
| `backend` | `internal: true` | `app`, `migrate`, `mysql` | MySQL solo es accesible desde aquí; sin salida a internet |
| `egress` | bridge sin puertos publicados | `app` | Salida de la app a `graph.facebook.com` (y `api.twilio.com`, que no se usa en producción) |

`internal: true` corta la salida a internet. Por eso la app necesita `egress`: el bot llama a la Cloud API con `fetch`. MySQL y `migrate` no tienen salida.

### 2.5 Volúmenes y qué se persiste

| Volumen | Montado en | Contenido | Respaldo | Permisos |
|---------|-----------|-----------|----------|----------|
| `mysql-data` (con nombre) | `mysql:/var/lib/mysql` | Usuarios, auditoría, productos, `product_change` y `_prisma_migrations` | `mysqldump` diario (§4.12) | Los gestiona la imagen (usuario `mysql`) |
| `app-data` (bind mount recomendado: `/srv/restaurante/data`, dueño `1000:1000`, modo `700`) | `app:/var/lib/restaurante` (`DATA_DIR`) | `molotes/` y `birria/` (`current.json`, `previous.json`, `damaged-*`) y `changes.jsonl` | `tar` en el mismo trabajo de respaldo | `700` en la carpeta; los JSON ya se crean `600` |
| `certs` | `proxy:/etc/letsencrypt:ro`, `certbot:/etc/letsencrypt` | Certificados y claves de TLS | Opcional (se pueden volver a emitir) | `700` (root) |
| `acme-webroot` | `proxy:/var/www/acme:ro`, `certbot:/var/www/acme` | Retos HTTP-01 | No | — |
| Logs | Driver `json-file` de Docker (`/var/lib/docker/containers`) | stdout de cada contenedor (la app escribe JSON por línea) | No (retención local; las alertas los leen) | root |
| `/srv/restaurante/.env` y `/srv/restaurante/secrets/*` | Lectura de Compose y `secrets:` | Configuración y secretos | Copia cifrada fuera del VPS (I-4) | `600`, dueño root o el usuario de despliegue |

Recomiendo un bind mount para `DATA_DIR`: facilita la rotación de `changes.jsonl` con `logrotate` y el `tar` del respaldo sin entrar en `/var/lib/docker`. Para MySQL, un volumen con nombre (su imagen gestiona dueño y permisos).

`restaurante.db`, `-wal` y `-shm` **dejan de existir** en producción.

---

## 3. Requisitos del VPS de Hostinger

### 3.1 Dimensionamiento

Estimación de memoria residente con el tráfico de dos landings y un bot:

| Componente | RAM estimada | Base |
|------------|--------------|------|
| SO (Ubuntu) + dockerd + containerd | 300–450 MB | Típico |
| app (Node 24 + Prisma) | 150–350 MB (límite propuesto 512 MB) | El informe OWASP midió 150 MB en reposo |
| MySQL 8.4 (`innodb_buffer_pool_size=256M`, `performance_schema=OFF`) | 400–600 MB (límite 1 GB) | Con `performance_schema` activo, más 150–300 MB |
| nginx | 10–30 MB | |
| Build en el VPS (solo si no se usa GHCR) | +1–1.5 GB transitorios (npm ci, Tailwind, tsc) | |
| Margen y caché de páginas | ≥ 1 GB | |

| | Mínimo | Recomendado |
|-|--------|-------------|
| vCPU | 1 | **2** |
| RAM | 2 GB (con 2 GB de swap y sin build en el VPS) | **4 GB** (8 GB si se construye en el VPS o se quiere margen) |
| Disco | 30 GB NVMe | **50 GB+ NVMe** (imágenes, binlogs de 3–7 días, respaldos locales de 7 días) |
| Red | IPv4 pública | IPv4 + IPv6 |
| Plan de Hostinger | El KVM más pequeño que cumpla el mínimo **[verificar: nombres (KVM 1, KVM 2…), CPU, RAM, disco y precio actuales]** | El plan con 2 vCPU y 4 GB o más **[verificar]** |
| Snapshots o backups del panel | Útiles como complemento, **no sustituyen** los respaldos lógicos fuera del VPS | **[verificar] si existen, su frecuencia y su coste** |
| Región | La más cercana a México que ofrezca Hostinger **[verificar]** | Latencia baja con los clientes y con Meta |

### 3.2 Sistema operativo y Docker

- **Ubuntu Server 24.04 LTS** (soporte estándar hasta 2029). Hostinger suele ofrecer una plantilla "Ubuntu 24.04 with Docker" **[verificar]**. Aun así, recomiendo la imagen limpia y Docker desde el repositorio oficial de Docker, para controlar versiones y origen.
- **Docker Engine** (paquetes `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin`) del repositorio apt oficial de Docker. Ni el `snap` ni `docker.io` de Ubuntu.
- **Compose v2** (`docker compose`, el plugin; no el binario `docker-compose` v1).
- `/etc/docker/daemon.json` recomendado:

  ```json
  {
    "log-driver": "json-file",
    "log-opts": { "max-size": "10m", "max-file": "5" },
    "live-restore": true,
    "no-new-privileges": true,
    "userland-proxy": false,
    "icc": false
  }
  ```

  `icc: false` solo afecta a la red bridge por defecto; las redes del compose son propias. `no-new-privileges` en el daemon actúa como valor por defecto, y además se fija por servicio.

### 3.3 Endurecimiento del SO (lo hace el usuario)

| Medida | Detalle |
|--------|---------|
| Usuario no root | Crear `deploy` con `sudo`. Solo él en el grupo `docker` (**el grupo `docker` equivale a root**). |
| SSH | Solo llave (ed25519). En `/etc/ssh/sshd_config.d/10-hardening.conf`: `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin no`, `AllowUsers deploy`, `MaxAuthTries 3`, `X11Forwarding no`. Mantener una sesión abierta mientras se prueba. Ojo: Ubuntu 24.04 usa socket activation para ssh; si cambias el puerto, ajusta `ssh.socket`. |
| fail2ban | Jail `sshd` (`bantime 1h`, `findtime 10m`, `maxretry 5`). Opcional: un jail sobre los 429 de nginx en `/admin/login`, leyendo el log del contenedor. |
| Actualizaciones automáticas | `unattended-upgrades` con el origen `-security`. `Automatic-Reboot "true"` con `Automatic-Reboot-Time` fuera del horario de servicio (por ejemplo 04:30 en hora de México, que en UTC es 10:30). Un reinicio cierra sesiones y corta conversaciones del bot. Docker y containerd también se actualizan por apt: revisar el impacto de `live-restore`. |
| Firewall del SO (UFW) | `default deny incoming`, `allow 80/tcp`, `allow 443/tcp`, `limit 22/tcp` (o solo desde la IP de administración). **Docker se salta UFW** con los puertos publicados: inserta reglas DNAT y FORWARD antes de las cadenas de UFW. Mitigaciones: (1) solo `proxy` publica puertos (80 y 443, que de todos modos son públicos); (2) **nunca** `ports:` en `app` ni en `mysql` (el CI lo comprueba, §6.6); (3) para depurar, publica solo en `127.0.0.1:` y quítalo después; (4) opcional: reglas en la cadena `DOCKER-USER` o `ufw-docker`. |
| Firewall del panel de Hostinger **[verificar]** | Si existe, replicar: entrada 80 y 443 desde cualquier origen, 22 solo desde la IP de administración y el resto denegado. Como actúa fuera del VPS, Docker no puede saltárselo. Es la capa más fiable contra el problema anterior. |
| Zona horaria | Host y contenedores en **UTC** (`timedatectl set-timezone UTC`). La app usa `BUSINESS_TIMEZONE=America/Mexico_City`; MySQL va con `default-time-zone='+00:00'`. |
| NTP | `systemd-timesyncd` (o `chrony`) activo (`timedatectl` muestra `System clock synchronized: yes`). Importa para TLS y para el bot, que descarta mensajes con más de 2 h según su marca de tiempo. |
| Swap | 2 GB en un archivo (`vm.swappiness=10`) para evitar que el OOM killer mate MySQL en picos. |
| Servicios innecesarios | Desactivar los que traiga la plantilla (por ejemplo, paneles web preinstalados) **[verificar plantilla]**. |
| Cuentas | **2FA en Hostinger (hPanel), GitHub y Meta Business** (I-4). |
| Auditoría opcional | `auditd` sobre `/srv/restaurante/.env`, `/srv/restaurante/secrets` y `/etc/docker`. |

---

## 4. Seguridad del despliegue con Docker, por hallazgo y medida

### 4.1 Mapeo de hallazgos F-01 a F-15

| ID | Cómo queda en esta arquitectura | Qué sigue haciendo falta |
|----|---------------------------------|--------------------------|
| **F-01** cabeceras de proxy falsificables | **Resuelto por red.** La app no publica puertos y solo es alcanzable por `frontend` (`internal: true`), donde solo vive `proxy`. nginx **sobrescribe** `X-Forwarded-For $remote_addr`, `X-Forwarded-Proto $scheme`, `X-Forwarded-Host $host` y `Host $host`, y la app ya usa `maxIpsCount = 1`. | REQ-F-014: variable `HOST`. En el contenedor se fija `HOST=0.0.0.0` de forma explícita, porque dentro de Docker loopback no es alcanzable desde el proxy. Prueba en el CI de que el compose no publica puertos de `app` ni `mysql`. |
| **F-02** límite solo por IP | **Mitigado** con `limit_req` en `/admin/login` (10 r/min por IP, burst 5) y `limit_conn`. | REQ-F-015 (límite por cuenta, IPv6 /64, sin descartar bloqueos). La red de bots sigue siendo posible. |
| **F-03** DoS de memoria en el webhook | **Mitigado en gran parte.** (1) `client_max_body_size 3m` solo en `location = /webhooks/whatsapp` y 64k en el resto. (2) nginx rechaza con 401 un `POST` sin `X-Hub-Signature-256` **antes de leer el cuerpo**: `map "$request_method:$http_x_hub_signature_256"` + `return 401` en la fase rewrite. (3) Con `proxy_request_buffering on` (por defecto), el envío lento lo absorbe nginx, no Node. (4) `client_body_timeout 10s` y `limit_req` de unas 30 r/s. (5) `mem_limit` en la app: un desborde reinicia el contenedor en lugar de tumbar el VPS. | REQ-F-016 (comprobar la firma antes del cuerpo, semáforo y timeouts del servidor). Defensa en profundidad si alguien llega a la app por otra vía. |
| **F-04** coste del bot | Sin cambio por infraestructura. | I-5 (límite de gasto en Meta) y REQ-F-017. |
| **F-05** `NODE_ENV` por defecto | **Resuelto en la práctica:** la imagen `production` ya fija `ENV NODE_ENV=production` y el compose lo repite en `environment:`. | REQ-F-014 para que la app falle cerrada fuera de Docker (desarrollo, scripts). |
| **F-06** proxy, TLS y firewall sin definir | **Resuelto** por §2, §3.3 y la configuración de nginx versionada (§6.3). | Aplicar el checklist del VPS. |
| **F-07** parámetros de scrypt | Sin cambio. Atención al `mem_limit` de la app: `N=2^17` usa unos 128 MiB por hash, y con 4 intentos concurrentes son unos 512 MiB. Subir el límite de la app a 768 MB **o** limitar la concurrencia de verificación. | REQ-F-019 (re-hash), medido en el VPS. |
| **F-08** permisos del `.db` | **Desaparece** (no hay `.db`). Se sustituye por: volumen `mysql-data` gestionado por la imagen de MySQL; respaldos `600` cifrados; `DATA_DIR` `700` (bind mount con dueño 1000); `.env` y `secrets/` `600`. | Quitar del alcance de REQ-F-019 la parte de `chmod` del `.db` y conservar el aviso si `DATA_DIR` es accesible por grupo u otros. |
| **F-09** CSP y `Permissions-Policy` | Sin cambio. **No duplicar HSTS en nginx** (helmet ya lo envía). Si se añade, debe ser idéntico. | REQ-F-018. |
| **F-10** Google Fonts | Sin cambio. | REQ-F-018, fase 2. |
| **F-11** dependencias | **Mejora:** la imagen `production` ya instala solo dependencias de producción (I-9 resuelto). El CLI de Prisma (con `mysql2` y `deepmerge-ts`) queda **solo** en la imagen `migrate`, puntual y en la red `backend` sin salida. Con MySQL se elimina `better-sqlite3` (módulo nativo y su `allowScripts`) y entra el adaptador MySQL de Prisma y su driver: hay que evaluarlo según `dependencias.md`. | REQ-F-020 + Dependabot (npm, github-actions **y docker**) + `npm audit --omit=dev` en el CI. |
| **F-12** sesión y MFA | Sin cambio. Opcional en nginx: lista de IP permitidas o autenticación básica adicional en `/admin` (pregunta 7 de OWASP). | REQ-F-015. |
| **F-13** logs | **Mitigado:** rotación `json-file` (10m × 5), `changes.jsonl` con `logrotate` sobre el bind mount, y alertas por timer (§4.11). | REQ-F-016 (los abortos como `warn`). |
| **F-14** imagen sin digest | **Resuelto:** `FROM node:24-alpine@sha256:…` en el Dockerfile. En el compose, todas las imágenes por digest (`mysql`, `nginx`, `certbot` y la propia app). | Dependabot `docker` para actualizarlos. |
| **F-15** repetición del webhook | Sin cambio (memoria). Con MySQL ya disponible, persistir los ids procesados sería barato, pero es **persistencia nueva** (tabla nueva): solo con una decisión explícita. El riesgo sigue siendo teórico. | Opcional, ticket aparte. |

### 4.2 Mapeo de las medidas de infraestructura I-1 a I-9

| ID | Antes (VM con Node) | En el VPS con Docker |
|----|---------------------|----------------------|
| **I-1** Firewall | UFW | Firewall del panel **[verificar]** + UFW + **ningún `ports:` salvo en `proxy`**, con comprobación en el CI. SSH solo con llave y, si se puede, desde IP restringidas. |
| **I-2** nginx con TLS | nginx en el host | Contenedor `nginx-unprivileged` con la configuración versionada en `deploy/nginx/` y certbot por webroot (§6.3). |
| **I-3** systemd | Unidad con `NoNewPrivileges`, `ProtectSystem`… | **Sustituida** por las opciones del contenedor (§4.3): `user`, `read_only`, `tmpfs`, `cap_drop: [ALL]`, `security_opt: no-new-privileges`, `mem_limit`, `cpus`, `pids_limit`, `restart`, `init` y `healthcheck`. El arranque con el VPS lo da `restart: unless-stopped` con el servicio `docker` habilitado. |
| **I-4** Secretos | `.env` 600 | `.env` 600 en `/srv/restaurante/` (fuera del clon y de la imagen) y **Docker secrets** (archivos 600) para las contraseñas de MySQL, que la imagen oficial lee con `*_FILE`. Copia cifrada fuera del VPS. Vaciar `ADMIN_PASSWORD_HASH` tras el primer arranque. 2FA en Hostinger, GitHub y Meta. |
| **I-5** Meta | Límite de gasto | Igual. |
| **I-6** Logs y alertas | journald | `json-file` con rotación, timer `alerts.sh` y `logrotate` de `changes.jsonl` (§4.11). |
| **I-7** Respaldos | `sqlite3 .backup` | `mysqldump` + `tar` de `DATA_DIR`, cifrados con `age` y enviados con `rclone` fuera del VPS, más una prueba de restauración mensual (§4.12). |
| **I-8** SO | unattended-upgrades, fail2ban, Node LTS | Igual, salvo "Node LTS al día": ahora es **rebuild de la imagen** con la base actualizada (Dependabot docker) y Docker Engine al día por apt. |
| **I-9** Despliegue sin dependencias de desarrollo | `npm prune` | **Resuelto** por la imagen multi-stage. El VPS no tiene Node, npm ni el código fuente si se usa GHCR. Credencial de GHCR de solo lectura (`read:packages`). |

### 4.3 Servicio `app` endurecido (borrador para `compose.prod.yaml`)

```yaml
app:
  image: ghcr.io/orvigas/restaurante@sha256:<digest>
  init: true
  user: "1000:1000"
  read_only: true
  tmpfs: ["/tmp:size=16m,mode=1777,noexec,nosuid"]
  cap_drop: [ALL]
  security_opt: ["no-new-privileges:true"]
  pids_limit: 256
  mem_limit: 768m        # 512m si scrypt sigue en N=2^15
  cpus: "1.0"
  env_file: [/srv/restaurante/.env]   # 600
  environment:
    NODE_ENV: production
    HOST: 0.0.0.0        # REQ-F-014; solo alcanzable por la red interna "frontend"
    PORT: "3000"
    TRUST_PROXY: "true"
    DATA_DIR: /var/lib/restaurante
  volumes: ["/srv/restaurante/data:/var/lib/restaurante"]
  expose: ["3000"]       # nunca "ports"
  networks: [frontend, backend, egress]
  depends_on:
    mysql: { condition: service_healthy }
    migrate: { condition: service_completed_successfully }
  healthcheck:
    test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/"]
    interval: 30s
    timeout: 5s
    start_period: 20s
    retries: 3
  restart: unless-stopped
  stop_grace_period: 20s
  logging: { driver: json-file, options: { max-size: "10m", max-file: "5" } }
```

- **`read_only`:** la app solo escribe en `DATA_DIR`. **[verificar en staging]** que Prisma 7 (Query Compiler, WASM) no escriba en el sistema de archivos. Si lo hace, montar un `tmpfs` en esa ruta.
- **Healthcheck:** hoy `GET /` renderiza la landing desde la caché y **no detecta una base de datos caída** (las landings siguen en 200 por diseño). Hay dos opciones: mantenerlo (la app ya responde 503 en `/admin` y registra `database_unavailable`, que dispara alerta) o añadir `/healthz` con un `SELECT 1`. Recomiendo mantenerlo y alertar por log: evita una ruta pública nueva y que un fallo transitorio de la BD reinicie la app y corte las conversaciones del bot.
- **`depends_on: migrate`:** con esto, un `docker compose up -d` aplica las migraciones antes de arrancar la app. Si el usuario prefiere migrar a mano, se quita esa condición y la app solo comprueba el estado (§5.6).
- **Una sola réplica:** no usar `deploy.replicas > 1` ni `scale`. Durante un despliegue hay unos segundos de corte, aceptables para este proyecto.

### 4.4 `NODE_ENV`, `TRUST_PROXY` y cabeceras del proxy

- `NODE_ENV=production` en la imagen (ya está) **y** en el compose (explícito y revisable).
- `TRUST_PROXY=true`, porque la única entrada es nginx. Con Cloudflare delante: en nginx, `set_real_ip_from <rangos de Cloudflare>` y `real_ip_header CF-Connecting-IP`, de modo que `$remote_addr` sea el cliente real. Además, permitir el 443 en el firewall solo desde los rangos de Cloudflare. Si no, el límite por IP bloquearía a todos a la vez (F-06).
- nginx, en cada `location` que hace `proxy_pass`:

  ```nginx
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $remote_addr;   # sobrescribe, no concatena
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  ```

- Un `server` por defecto que responde `444` a cualquier `Host` que no sea el dominio. Así se evitan los escaneos por IP y la inyección de `Host`.

### 4.5 Límites en el proxy

| Ruta | `client_max_body_size` | `limit_req` | Otros |
|------|------------------------|-------------|-------|
| `location = /webhooks/whatsapp` | `3m` | `zone=webhook rate=30r/s burst=60 nodelay` | 401 si es POST y no trae `X-Hub-Signature-256` (antes de leer el cuerpo) |
| `location = /admin/login` | `16k` | `zone=login rate=10r/m burst=5 nodelay` y `limit_req_status 429` | |
| `location ^~ /admin` | `256k` (formularios de 128k y JSON de la API) | `zone=admin rate=10r/s burst=20` | **`gzip off`** (BREACH: el token CSRF se refleja en el HTML) |
| `location /` | `64k` | `zone=general rate=20r/s burst=40` | `gzip on` para texto, CSS y JS |
| Global | — | `limit_conn perip 20` | `client_body_timeout 10s`, `client_header_timeout 10s`, `send_timeout 30s`, `keepalive_timeout 15s`, `server_tokens off`, `location ~ /\. { return 404; }` |

TLS: perfil "intermediate" de Mozilla (TLS 1.2 y 1.3), redirección 301 de 80 a 443 (salvo `/.well-known/acme-challenge/`), `ssl_session_tickets off`. No configurar OCSP stapling: **[verificar]** que Let's Encrypt dejó de ofrecer OCSP en 2025.

### 4.6 Contenedores sin root y con privilegios mínimos

| | app | proxy | mysql | migrate | certbot |
|-|-----|-------|-------|---------|---------|
| Usuario | `node` (1000) | `nginx` (101, imagen unprivileged) | el entrypoint arranca como root y baja a `mysql` (999) | `node` (1000) | root (escribe en `/etc/letsencrypt`); puntual |
| `read_only` | sí + tmpfs `/tmp` | sí + tmpfs `/tmp`, `/var/cache/nginx` y `/var/run` | **[verificar]** posible con tmpfs `/tmp` y `/var/run/mysqld`; si da guerra, no | sí | no |
| `cap_drop: ALL` | sí | sí | sí, con `cap_add: [CHOWN, SETUID, SETGID, DAC_OVERRIDE]` para el entrypoint **[verificar el conjunto mínimo]**. Alternativa: `user: "999:999"` con el volumen ya inicializado | sí | sí, con `cap_add` mínimo si falla |
| `no-new-privileges` | sí | sí | sí | sí | sí |
| `mem_limit` / `cpus` | 768m / 1.0 | 128m / 0.5 | 1g / 1.0 | 256m / 0.5 | 128m |
| `pids_limit` | 256 | 128 | 512 | 128 | 64 |
| healthcheck | `wget /` | `wget` a un `/nginx-health` interno (solo red interna) | `mysqladmin ping` con la contraseña del secreto | — | — |
| `restart` | unless-stopped | unless-stopped | unless-stopped | no | no |

No se usa `privileged`, ni se monta `docker.sock` en ningún contenedor. No hay `network_mode: host`.

### 4.7 Imágenes fijadas por digest

- `Dockerfile`: `FROM node:24-alpine@sha256:<digest> AS base`.
- Compose: `mysql:8.4@sha256:…`, `nginxinc/nginx-unprivileged:…@sha256:…`, `certbot/certbot:…@sha256:…`, y la app y `migrate` por el digest que publique el CI.
- Dependabot con `package-ecosystem: docker` (Dockerfile) y `docker-compose` **[verificar soporte]**. Si no lo soporta, Renovate o una revisión mensual manual.
- Opcional: escanear la imagen con Trivy en el CI (acción fijada por SHA) y atestación de procedencia (`provenance: true`) y SBOM al publicar en GHCR.

### 4.8 Secretos

| Secreto | Dónde | Cómo llega |
|---------|-------|-----------|
| `WHATSAPP_BOT_ACCESS_TOKEN`, `WHATSAPP_BOT_APP_SECRET`, `WHATSAPP_BOT_VERIFY_TOKEN`, `ADMIN_PASSWORD_HASH` | `/srv/restaurante/.env` (600) | `env_file` (como hoy; la app no cambia) |
| `DATABASE_URL` de la app (`mysql://app_rw:<pass>@mysql:3306/restaurante`) | `.env` (600) **o** `secrets/database_url` con soporte `DATABASE_URL_FILE` en `env.ts` | Recomiendo `.env` en la primera fase (sin cambio de código extra) y `_FILE` como mejora |
| Contraseñas de MySQL (`root`, `migrator`, `backup`, `app_rw`) | `/srv/restaurante/secrets/*.txt` (600) | `secrets:` de Compose → `/run/secrets/*`; la imagen de MySQL acepta `MYSQL_ROOT_PASSWORD_FILE` |
| `MIGRATION_DATABASE_URL` | `secrets/` o `.env` separado `migrate.env` (600) | Solo lo lee el servicio `migrate` |
| Credencial de GHCR | `~deploy/.docker/config.json` (600) | `docker login ghcr.io` con un token **fine-grained de solo `read:packages`** |
| Clave privada de `age` para descifrar respaldos | **Fuera del VPS** (gestor de contraseñas del dueño) | El VPS solo tiene la clave pública |

- **Nunca en la imagen:** el `.dockerignore` ya excluye `.env*`. No hay `ARG` ni `ENV` con secretos en el Dockerfile.
- Las variables de entorno de un contenedor se ven con `docker inspect`. Solo afecta a quien ya es root o está en el grupo `docker`. Es aceptable si el grupo `docker` solo tiene a `deploy`.
- En Compose, el `$` del hash scrypt dentro de `env_file` **no se interpola** (solo se interpola en el YAML). Aun así, mantener las comillas simples que documenta el README.
- Contraseñas de MySQL: 32 bytes aleatorios (`openssl rand -base64 32 | tr -d '/+='`), distintas por usuario.

### 4.9 MySQL: red, usuarios y TLS

- **Sin puerto publicado**, solo en `backend` (`internal: true`). Para administrar: `docker compose exec mysql mysql -u root -p` (socket dentro del contenedor).
- `MYSQL_ROOT_HOST=localhost`: root solo por socket dentro del contenedor **[verificar el valor por defecto de la imagen oficial; suele ser `%`]**.
- Usuarios, creados por `deploy/mysql/initdb/01-users.sh`. El script lee `/run/secrets/*` y solo corre con el volumen vacío; los cambios posteriores siguen un runbook.

  | Usuario | Host | Privilegios | Uso |
  |---------|------|-------------|-----|
  | `app_rw` | `%` (solo alcanzable desde `backend`) | `SELECT, INSERT, UPDATE, DELETE ON restaurante.*` | La app y `admin:recover` |
  | `migrator` | `%` | `SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON restaurante.*` | Solo el servicio `migrate` (`prisma migrate deploy` crea y actualiza `_prisma_migrations`) |
  | `backup` | `localhost` (dentro del contenedor) | `SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES, PROCESS ON *.*` (o `--no-tablespaces` sin `PROCESS`) | `mysqldump --single-transaction` |

  `app_rw` **no tiene** `CREATE`, `ALTER`, `DROP`, `GRANT`, `FILE` ni `SUPER`. Hace falta `DELETE` porque el código borra variantes, chips y negocios del usuario al reemplazarlos. Opcional, como defensa contra manipulación: con grants por tabla, quitar `UPDATE` y `DELETE` a `app_rw` en `user_audit` y `product_change` (solo se insertan) y dejar solo `SELECT` en `_prisma_migrations`. Coste: cada tabla nueva exige actualizar los grants. Lo dejo como decisión.
- **TLS interno:** no lo recomiendo en esta topología. El tráfico app a MySQL no sale del kernel del host (bridge interno) y TLS añade gestión de certificados. **Es obligatorio** si MySQL pasa a ser gestionado o remoto (`?sslaccept=strict` o la opción equivalente del adaptador, con CA verificada).
- Configuración (`deploy/mysql/conf.d/restaurante.cnf`, ro):

  ```ini
  [mysqld]
  character-set-server = utf8mb4
  collation-server     = utf8mb4_0900_bin
  default-time-zone    = '+00:00'
  skip-name-resolve
  local_infile         = 0
  mysqlx               = OFF
  max_connections      = 50
  innodb_buffer_pool_size = 256M
  performance_schema   = OFF        # ahorra RAM en un VPS pequeño
  binlog_expire_logs_seconds = 259200   # 3 días (recuperación a un punto en el tiempo); o disable_log_bin
  # sql_mode por defecto de 8.4 (incluye STRICT_TRANS_TABLES): no relajarlo
  ```

  La autenticación por defecto de 8.4 es `caching_sha2_password`: **[verificar]** que el driver del adaptador de Prisma la soporte sin TLS dentro de una red privada (opción tipo `allowPublicKeyRetrieval`) o con RSA.

### 4.10 Logs con rotación

- `json-file` con `max-size: 10m` y `max-file: 5` por servicio (y como valor por defecto en el daemon).
- La app ya escribe JSON por línea en stdout sin datos sensibles. nginx también va a stdout y stderr. Opcional: `log_format` JSON sin query string (los parámetros de `hub.verify_token` del GET de verificación llegarían al log de nginx: **usar `$uri` y no `$request_uri`** en el formato de acceso).
- `changes.jsonl`: `logrotate` sobre `/srv/restaurante/data/changes.jsonl` (`weekly`, `rotate 12`, `compress`, `copytruncate`, `su 1000 1000`). La app hace append; `copytruncate` es seguro con escrituras de una línea.

### 4.11 Alertas (mínimas, sin infraestructura nueva)

- Timer de systemd cada 5 min: `docker compose logs --since 6m app | grep -E '"(admin_login_locked|bot_webhook_signature_invalid|bot_rate_limited|bot_staff_delivery_failed|bot_staff_send_failed|database_unavailable|database_init_failed)"'`. Si hay coincidencias, avisa por correo (`msmtp`) o ntfy, solo con el nombre del evento y un conteo, nunca la línea completa.
- Monitor externo de disponibilidad (UptimeRobot, Healthchecks.io o similar) sobre `https://<dominio>/`, más un "dead man's switch" del respaldo diario.
- Alerta de disco > 80 % (`df`) y de reinicios del contenedor (`docker inspect -f '{{.RestartCount}}'`).

### 4.12 Copias de seguridad

- **Qué:** `mysqldump --single-transaction --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF restaurante` con el usuario `backup`, más el `tar` de `/srv/restaurante/data` (JSON y `changes.jsonl`), más (aparte, solo cuando cambien) el `.env` y los `secrets/`.
- **Cómo:** `deploy/backup/backup.sh` en el host, con un timer diario (por ejemplo 03:00 hora de México):
  1. `docker compose exec -T mysql mysqldump … | gzip`;
  2. `tar` de `data/`;
  3. cifrado con **`age`** (solo la clave pública en el VPS);
  4. `rclone copy` a un almacenamiento S3 compatible **fuera de Hostinger** (Backblaze B2, Cloudflare R2, AWS S3), con un bucket con **versionado o bloqueo de objetos** (protección contra ransomware o borrado);
  5. retención: 7 diarios, 4 semanales y 6 mensuales;
  6. archivos locales `600` y limpieza a los 7 días.
- **xtrabackup:** innecesario para una base de pocos MB. `mysqldump` con `--single-transaction` da una copia consistente en caliente para InnoDB.
- **Antes de cada actualización:** respaldo manual (`backup.sh --tag pre-<versión>`). Una migración nueva impide volver al código anterior (`DATABASE_NEWER_THAN_CODE`).
- **Prueba de restauración mensual** (`restore-test.sh`):
  1. levantar un `mysql:8.4` efímero sin red;
  2. descifrar y cargar el dump;
  3. comprobar el conteo de `user` y `product` y el último `_prisma_migrations`;
  4. destruir el contenedor.

  Registrar el resultado.
- **Snapshots del panel de Hostinger [verificar]:** útiles para recuperar el VPS completo, pero no son consistentes para MySQL (salvo que se pare) y viven en el mismo proveedor. Son un complemento.

### 4.13 Actualizaciones de imágenes

- Dependabot semanal: `npm` (`/restaurante`), `github-actions` (`/`) y `docker` (`/restaurante`).
- Cada merge a `main` construye y publica una imagen nueva. La base `node:24-alpine` fijada por digest solo cambia con un PR de Dependabot, con el CI en verde.
- MySQL, nginx y certbot: PR de Dependabot (o revisión mensual) y redespliegue. MySQL solo dentro de 8.4.x; un cambio de LTS mayor es un ticket aparte con respaldo y prueba.

---

## 5. Migración de SQLite a MySQL: impacto en el código

### 5.1 Prisma: proveedor y adaptador

- `schema.prisma`: `datasource db { provider = "mysql" }`.
- Prisma 7 funciona con driver adapters (el proyecto ya usa `@prisma/adapter-better-sqlite3`, versión exacta). Para MySQL el adaptador oficial es, hasta donde sé, **`@prisma/adapter-mariadb`** (driver `mariadb`, compatible con MySQL 8). **[verificar]** su nombre, su compatibilidad con MySQL 8.4 y `caching_sha2_password`, y que exista en 7.10.0 con la misma versión exacta. Si Prisma publicó un adaptador específico de MySQL, preferirlo.
- `package.json`:
  - quitar `@prisma/adapter-better-sqlite3`, `better-sqlite3` y `@types/better-sqlite3` (y su entrada de `allowScripts`);
  - añadir el adaptador y su driver con versiones exactas, comprobando con `npm ci --strict-allow-scripts` que no traigan scripts de instalación.

  El CLI `prisma` sigue como dependencia de desarrollo (y en la imagen `migrate`).
- `src/db/client.ts`: `createPrismaClient(url)` con el adaptador y un pool pequeño (`connectionLimit` de unos 5, `connectTimeout` y `acquireTimeout`), y `errorFormat: 'minimal'` como hoy.
- `prisma.config.ts`: `datasource.url = process.env.DATABASE_URL`, y `shadowDatabaseUrl` para `migrate dev` en desarrollo (necesita un usuario que pueda crear la base sombra; nunca en producción).

### 5.2 Tipos y colaciones

| Tema | SQLite hoy | MySQL | Acción |
|------|-----------|-------|--------|
| Juego de caracteres | UTF-8 siempre | Por defecto `utf8mb4` en 8.x; **`utf8` (`utf8mb3`) rompe emojis** | Base, tablas y conexión en **`utf8mb4`**. Imprescindible: el bot y la administración ya manejan emojis (rama `feature/bot-emojis`) y acentos. Comprobar al arrancar `@@character_set_database = 'utf8mb4'`. |
| Colación | `BINARY` (comparación exacta) | `utf8mb4_0900_ai_ci` por defecto (sin distinguir mayúsculas **ni acentos**) | **Recomiendo `utf8mb4_0900_bin`** como colación de la base. Motivos: (1) la app ya normaliza (`usernameKey` = NFC + minúsculas; los slugs son ASCII sin diacríticos) y **no depende** de que la BD ignore mayúsculas; (2) con `ai_ci`, el índice único de `username_key` trataría `jose` y `josé` como el mismo usuario (CA-9 de REQ-F-007 dice "sin distinguir mayúsculas", no acentos) y el `ORDER BY username_key` cambiaría de orden; (3) mantiene el mismo comportamiento que las pruebas actuales. Prisma no declara la colación por columna en el esquema: se fija a nivel de base (`collation-server` y `CREATE DATABASE … COLLATE`) y se comprueba al arrancar. Alternativa: `ai_ci` si el usuario **quiere** que "josé" y "jose" choquen, con una prueba nueva y una aclaración del BA. |
| `String` | `TEXT` | `VARCHAR(191)` | Revisar los límites: `description` (400 caracteres) → `@db.VarChar(400)`; variante `description` (400) → `@db.VarChar(400)`; `user_audit.changes` y `product_change.changes` (JSON de longitud variable) → `@db.Text` (o `Json`, pero cambia el contrato del store: no recomendado ahora); `password_hash` (formato `scrypt$…`; **[verificar la longitud máxima]**) → `@db.VarChar(255)`; `image_src` → `@db.VarChar(255)`. El resto (nombre 80, etiquetas 40, usuario 60) cabe en 191. Con `utf8mb4`, `VARCHAR(191)` = 764 bytes, dentro del límite de índice de InnoDB (3072 bytes con `DYNAMIC`); los índices compuestos `(business, slug)` caben. |
| Enums (`Role`, `Business`, `ProductCategory`, `DetailsType`) | `TEXT` | `ENUM(...)` nativo | Prisma lo genera. Añadir un valor es un `ALTER TABLE` (migración). |
| `Boolean` | `BOOLEAN` (entero) | `TINYINT(1)` | Transparente. |
| `DateTime` | Prisma guarda milisegundos | `DATETIME(3)` (milisegundos) | Misma precisión que `Date` de JS. Prisma escribe en UTC; con `default-time-zone='+00:00'`, `CURRENT_TIMESTAMP(3)` (defaults de `created_at` y `user_audit.at`) también queda en UTC. El orden `at desc, id desc` se conserva. |
| `Int @default(autoincrement())` | `INTEGER PRIMARY KEY AUTOINCREMENT` | `INT AUTO_INCREMENT` | Puede haber huecos tras un rollback (también en SQLite con AUTOINCREMENT). Ningún código depende de ids consecutivos. |
| `distinct: ['productId']` (`lastChanges`) | Prisma lo resuelve | Prisma lo resuelve (en memoria si hace falta) | Sin cambio; volumen bajo. |
| Errores | `SQLITE_*` en `originalCode` | Códigos numéricos de MySQL (`1062`, `1213`, `1205`…) | `isUniqueViolation` (P2002) sigue igual. `databaseErrorDetails` sigue sirviendo (solo códigos), pero hay que **revisar las pruebas que esperan `SQLITE_*`**. |

### 5.3 Transacciones, aislamiento e interbloqueos

- **Productos:** las escrituras ya se serializan con un mutex en el proceso y usan control optimista (`updateMany where version`). En InnoDB el `UPDATE … WHERE id AND version` bloquea la fila y lee la última versión confirmada, así que **funciona igual**. `admin:recover` no toca productos.
- **Usuarios (D-7, riesgo alto):** `assertActiveAdmin` cuenta los administradores activos dentro de la transacción. El propio comentario del código dice que es correcto "porque SQLite tiene un único escritor". En MySQL, con REPEATABLE READ, el `COUNT` es una lectura de instantánea sin bloqueo. Dos transacciones concurrentes (dos peticiones, o la app y `admin:recover`) que desactivan **administradores distintos** pueden ver las dos "queda 1" y confirmar: **cero administradores** (write skew). Hay una prueba que lo cubre ("dos desactivaciones simultáneas de los dos únicos administradores: solo una se aplica"), que hoy pasa por SQLite y **fallaría o sería intermitente** en MySQL. Solución recomendada:
  - `prisma.$transaction(fn, { isolationLevel: 'Serializable' })` en las escrituras del repositorio de usuarios. En InnoDB, SERIALIZABLE convierte los `SELECT` en `FOR SHARE` y una de las dos transacciones cae por interbloqueo (`P2034` / `1213`);
  - un **reintento acotado** (3 intentos con jitter) en `run()` para `P2034`, que luego se traduce a `LastAdminError` o a 503.

  Alternativa: un `SELECT … FOR UPDATE` explícito sobre las filas de administradores activos con `$queryRaw` (introduce SQL crudo; menos recomendable).
- **`bootstrap`:** `count() == 0` y después `create`. Una carrera entre la app y `admin:recover` en el primer arranque crearía dos administradores, lo que es inocuo (el índice único evita que se dupliquen con el mismo nombre). Se puede dejar.
- **Timeouts:** las transacciones interactivas de Prisma tienen por defecto `maxWait` de 2 s y `timeout` de 5 s; con este volumen alcanzan. `innodb_lock_wait_timeout` por defecto es de 50 s; recomiendo bajarlo a 10 s en la sesión o en la configuración para fallar rápido (503) en lugar de colgar `/admin`.
- **Pool:** una instancia con 5 conexiones basta (escrituras serializadas y lecturas de `/admin` escasas; las landings leen la caché en memoria).

### 5.4 Migraciones: empezar con una inicial nueva

- `migration_lock.toml` fija `provider = "sqlite"`, y Prisma no mezcla proveedores en una misma carpeta de migraciones. Las dos migraciones actuales son SQL de SQLite (`AUTOINCREMENT`, comillas dobles, `DATETIME`) y no corren en MySQL.
- **Recomendación: una única migración inicial nueva para MySQL** (por ejemplo `20261012000000_inicial_mysql`), generada con `prisma migrate dev --create-only` contra un MySQL de desarrollo y revisada a mano (comprobar `utf8mb4`, longitudes e índices). Las migraciones SQLite se retiran de `prisma/migrations/` (quedan en el historial de git). Motivos: no hay una base de producción en marcha (la guía sigue "a definir") y "regenerar" las dos migraciones daría dos archivos sin valor histórico real.
- **Las DDL de MySQL no son transaccionales** (cada `CREATE` o `ALTER` hace commit implícito). Si una migración de varios pasos falla a mitad, queda aplicada a medias y `_prisma_migrations` la marca como fallida; `prisma migrate resolve` y la restauración del respaldo son la salida. Mitigaciones:
  - respaldo obligatorio antes de migrar (ya lo pide la guía);
  - migraciones pequeñas y del tipo expandir y contraer (primero añadir, después usar, después borrar en otra versión) para que el código anterior siga funcionando;
  - probar cada migración en el CI contra MySQL.

### 5.5 Quién aplica las migraciones

| Opción | Descripción | Ventajas | Desventajas |
|--------|-------------|----------|-------------|
| **A (recomendada)** | Servicio puntual `migrate` (imagen `migrate`, con el CLI de Prisma) con `prisma migrate deploy` y el usuario `migrator`. La app al arrancar **solo verifica** `_prisma_migrations` | Menor privilegio real (la app sin DDL). Herramienta oficial y probada con MySQL. Elimina el aplicador propio, específico de SQLite (`src/db/migrate.ts`, unas 200 líneas) y su prueba de compatibilidad | El CLI (con los avisos de `npm audit` de F-11) vive en una imagen que se ejecuta en producción, aunque sea puntual y sin salida a internet |
| B | Reescribir el aplicador propio para MySQL (mismo formato de `_prisma_migrations`), ejecutado como `node scripts/db-migrate.ts` desde la imagen `production` con `MIGRATION_DATABASE_URL` | Sin CLI en producción | Hay que reescribir y probar código delicado (la atomicidad ya no existe en MySQL). Duplica lo que Prisma ya hace |
| C | La app aplica las migraciones al arrancar (como hoy) | Sin servicio extra | La app necesita privilegios DDL: contradice el menor privilegio |

**Comprobación al arrancar (opciones A y B):** `verifyDatabase()` sustituye a `prepareDatabase()`:

1. conexión con reintentos (por ejemplo 10 intentos con espera exponencial hasta unos 30 s), además del `depends_on: service_healthy`;
2. `SELECT 1`;
3. `@@character_set_database = utf8mb4` y la colación esperada → si no, `DATABASE_CHARSET_INVALID`;
4. `@@sql_mode` contiene `STRICT_TRANS_TABLES`;
5. lectura de `_prisma_migrations` (solo `SELECT`): una aplicada que no existe en el código → `DATABASE_NEWER_THAN_CODE` (se conserva); una local no aplicada → **`MIGRATIONS_PENDING`** (nuevo, fallo rápido con código 1); checksum distinto → `MIGRATION_MODIFIED`; sin terminar o fallida → `MIGRATION_INCOMPLETE`.

Los códigos y el log `database_init_failed` se conservan; los mensajes no llevan SQL, URL ni credenciales.

| Comprobación de hoy (SQLite) | Sustituto |
|------------------------------|-----------|
| `quick_check` (integridad) | Recuperación de InnoDB al arrancar MySQL + healthcheck `mysqladmin ping`. `CHECK TABLE` solo en el runbook |
| Sonda de escritura (`_write_probe`) | Innecesaria: los permisos los da el `GRANT`. Opcional: `SHOW GRANTS` y aviso `database_privileges_excessive` si `app_rw` tiene DDL |
| `journal_mode = WAL`, `busy_timeout` | No aplican. `innodb_lock_wait_timeout` y el pool |
| `DATA_DIR_MISSING` para la BD | `DATABASE_UNREACHABLE` / `DATABASE_AUTH_FAILED` (códigos estables a partir de los errores del driver) |
| Permisos del `.db` (F-08) | No aplica |

### 5.6 `DATABASE_URL` como secreto

- Nueva variable **obligatoria siempre** (también en desarrollo y pruebas): `DATABASE_URL=mysql://app_rw:<pass>@mysql:3306/restaurante`. Se valida en `env.ts`: esquema `mysql:`, host, puerto y nombre de base. **Nunca** se registra ni aparece en `ConfigError`; los mensajes solo dicen "DATABASE_URL no es válida". La contraseña puede llevar caracteres que haya que codificar en la URL: documentarlo, o aceptar `DATABASE_URL_FILE` (recomendado como mejora).
- `MIGRATION_DATABASE_URL`: solo para el servicio `migrate` (y `prisma.config.ts`).
- `DATA_DIR` sigue siendo obligatoria en producción (JSON de página y `changes.jsonl`).
- `scripts/admin-recover.ts`: deja de usar `DATA_DIR` para la BD y no migra; solo verifica (opción A) y usa `DATABASE_URL`. En el contenedor: `docker compose exec app node scripts/admin-recover.ts --usuario <nombre>`.
- `.env.example`: añadir `DATABASE_URL` (y `HOST` de REQ-F-014), quitar las menciones a `restaurante.db`, y crear `deploy/.env.prod.example`.

### 5.7 Pruebas

Situación actual: 21 archivos usan una BD real mediante `setupAdmin` o `makeDatabase`, que crean un `.db` temporal **por prueba**. `memory-product-store` cubre el contrato de productos sin BD.

| Opción | Evaluación |
|--------|-----------|
| **Servicio MySQL en el CI + contenedor local (recomendado)** | El job `calidad` añade `services: mysql: image: mysql:8.4@sha256:…` con healthcheck, la configuración de `utf8mb4_0900_bin` y `TEST_DATABASE_URL`. En local, `compose.yaml` añade un servicio `mysql-test` (con `tmpfs` en `/var/lib/mysql`, que es rápido y desechable) publicado **solo en `127.0.0.1:3307`**, más un script `npm run test:db:up`. |
| Testcontainers | Añade una dependencia pesada que necesita el socket de Docker dentro de las pruebas. Choca con `docker compose run test` (`network_mode: none`). **No recomendado.** |
| MySQL en el compose de pruebas | Necesario para `docker compose run --rm test`: el servicio `test` pasa de `network_mode: none` a una red interna con `mysql-test`. |

Diseño del soporte de pruebas:

- **Una base por trabajador de Vitest** (`restaurante_test_<VITEST_POOL_ID>`), creada y migrada una vez (en `globalSetup` o de forma perezosa). `makeDatabase()` hace `TRUNCATE` de todas las tablas (con `FOREIGN_KEY_CHECKS=0`), que es mucho más rápido que crear una base por prueba. Las pruebas que necesitan una base vacía o sin migrar (arranque, migraciones, `admin:recover`) crean `restaurante_test_<uuid>` y la borran al terminar.
- **Salvaguarda:** `tests/setup` rechaza un `TEST_DATABASE_URL` cuyo host no sea `127.0.0.1`, `localhost` o `mysql-test`, o cuya base no empiece por `restaurante_test_`. Así nunca se toca una base real (en la línea de `tests/setup/no-meta.ts`).
- **Sin MySQL disponible:** en el CI, fallar (no saltar). En local, fallar con un mensaje claro ("ejecuta `npm run test:db:up`"). Saltar en silencio ocultaría regresiones.
- **El store en memoria se conserva:** sigue siendo el doble rápido de las pruebas unitarias y del contrato (`product-repository-contract.test.ts` sigue corriendo contra los dos stores). No se quita.
- **Pruebas que cambian:**
  - `tests/unit/db-migrate.test.ts`: casi todo es específico de SQLite (archivo dañado, `SQLITE_NOTADB`, redefinición de tablas con FK). Se sustituye por pruebas de `verifyDatabase` (pendiente, más nueva, modificada, colación incorrecta, inalcanzable).
  - `tests/integration/db-prisma-compat.test.ts`: con la opción A sobra; se sustituye por un paso del CI con `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --shadow-database-url …` (exit 0).
  - `server-startup.test.ts`: ".db dañado" pasa a "MySQL inalcanzable o credenciales inválidas", "migración pendiente" y "base más nueva que el código".
  - `admin-recover.test.ts`: "sin `.db` lo crea y migra" pasa a "base sin migrar → código 1 con mensaje controlado".
  - `admin-db-security.test.ts`: simular la caída de la BD con el servidor en marcha (desconectar el cliente o dar `DATABASE_URL` a un puerto cerrado).
  - `user-repository.test.ts`: **la prueba de concurrencia D-7 pasa a ser crítica**, porque valida el cambio de aislamiento.
  - `admin-products-atomicity.test.ts`: "con SQLite real" pasa a "con MySQL real".
  - Las pruebas que esperan `SQLITE_*` en los logs.
- **Duración:** la suite será más lenta (red y `TRUNCATE`). Estimación: unos +20–60 s en el CI **[medir]**.

### 5.8 Datos existentes de SQLite

- En local existe `restaurante/data/restaurante.db` (unos 124 KB, de desarrollo). La guía de despliegue indica que la VM **no está en producción** (todo "a definir"). **Pregunta 3 (§9).**
- **Si no hay datos reales (lo probable):** no se migra nada. En el primer arranque, MySQL vacío, `migrate` crea el esquema, la app importa los productos desde `current.json`, `previous.json` o la semilla (la importación única actual) y crea el primer administrador con `ADMIN_USER`/`ADMIN_PASSWORD_HASH`. Los JSON de `DATA_DIR` se copian tal cual si existen.
- **Si hay datos reales:** un ticket aparte con un script de un solo uso, `scripts/migrate-sqlite-to-mysql.ts`:
  1. lee el `.db` con `better-sqlite3` (dependencia de desarrollo temporal);
  2. inserta en MySQL **conservando los ids** y con este orden: `user`, `user_business`, `user_audit`, `product`, `product_variant`, `product_chip`, `product_change`, `product_import`;
  3. ajusta `AUTO_INCREMENT`;
  4. compara conteos y sumas de control por tabla;
  5. se ejecuta con la app parada y respaldo de los dos lados.

  Los hashes scrypt se copian sin cambios (formato propio, independiente de la BD).

### 5.9 Cambios en el informe OWASP

| Hallazgo | Cambio |
|----------|--------|
| F-08 | **Desaparece** (no hay archivo `.db`). Queda el aviso de `DATA_DIR` con permisos amplios para los JSON |
| F-11 | Desaparece `better-sqlite3` (nativo, con script de instalación). Entra el adaptador MySQL y su driver, que hay que evaluar. Los avisos de `mysql2` del CLI siguen siendo solo de herramientas (imagen `migrate`) |
| F-01 y F-05 | Mitigados por la arquitectura; los tickets siguen valiendo para la seguridad por defecto |
| A03 / SQL | Igual: todo por Prisma. Con la opción A desaparece incluso el `db.exec` de las migraciones en la app |
| Nuevo riesgo | Write skew en D-7 (§5.3), credenciales de BD en el entorno y un servicio de red más (MySQL), aislado por red y menor privilegio |
| Recuperación ante desastres | Más compleja (dump y restauración frente a copiar un archivo). Cubierta por §4.12 |

---

## 6. Cambios necesarios en el repositorio

### 6.1 Dockerfile

- `FROM node:24-alpine@sha256:<digest>`.
- Quitar todo lo de SQLite: comentarios, `restaurante.db` y la necesidad de compilar `better-sqlite3`.
- **Nueva etapa `migrate`** (desde `deps`): copia `prisma/schema.prisma`, `prisma/migrations` y `prisma.config.ts`; `USER node`; `ENTRYPOINT ["npx", "--no-install", "prisma", "migrate", "deploy"]`; sin telemetría (`CHECKPOINT_DISABLE`).
- `production`: sin cambios de fondo (usuario `node`, `/var/lib/restaurante` 700, `NODE_ENV=production`); `ENV HOST=0.0.0.0` (REQ-F-014) solo si el compose no la fija; etiquetas OCI (`org.opencontainers.image.source`, `revision`); `STOPSIGNAL SIGTERM`.
- `test`: recibe `TEST_DATABASE_URL` y se ejecuta con el servicio `mysql-test`.
- `.dockerignore`: añadir `deploy/` (no hace falta en la imagen) y `compose*.yaml`. Las reglas `*.db` pueden quedarse.

### 6.2 Compose de producción

- Nuevo `restaurante/deploy/compose.prod.yaml` (o `restaurante/compose.prod.yaml`) con los servicios de §2 y §4: `proxy`, `app`, `mysql`, `migrate` y `certbot` (perfil `ops`); las redes `edge`, `frontend` (`internal`), `backend` (`internal`) y `egress`; los volúmenes; `secrets:`; `x-logging` común. **Sin `build:`**: solo imágenes por digest. Las variables del digest se toman de un `deploy/versions.env` que actualiza el script de despliegue.
- `compose.yaml` (pruebas): añadir `mysql-test` (tmpfs, `127.0.0.1:3307` para uso local) y conectar `test` a una red interna en lugar de `network_mode: none` (sigue sin salida a internet).

### 6.3 Configuración del proxy

- `deploy/nginx/nginx.conf` y `deploy/nginx/conf.d/restaurante.conf.template` (con `${DOMAIN}` y el `envsubst` que trae la imagen oficial):
  - `server` por defecto con 444;
  - `server` :8080 con ACME webroot y 301;
  - `server` :8443 con TLS, las cabeceras de §4.4, las `location` y los límites de §4.5, el 401 del webhook sin firma, `gzip off` en `/admin` y `log_format` sin query string.
- `deploy/certbot/` con instrucciones de emisión inicial (`certonly --webroot -w /var/www/acme -d <dominio>`) y renovación.
- `deploy/systemd/restaurante-certbot.{service,timer}` (`renew` + `nginx -s reload`, dos veces al día).

### 6.4 Variables de entorno

| Variable | Nueva o cambia | Dónde |
|----------|----------------|-------|
| `DATABASE_URL` (o `DATABASE_URL_FILE`) | Nueva, obligatoria, secreta | app, `admin:recover` |
| `MIGRATION_DATABASE_URL` | Nueva, secreta | Solo `migrate` y `prisma.config.ts` |
| `SHADOW_DATABASE_URL` | Nueva, solo desarrollo | `prisma migrate dev` |
| `TEST_DATABASE_URL` | Nueva, solo pruebas y CI | `tests/support/database.ts` |
| `HOST` | Nueva (REQ-F-014) | app (`0.0.0.0` en el contenedor) |
| `DATA_DIR` | Cambia su descripción: solo JSON de página y `changes.jsonl` | app |
| `DOMAIN` | Nueva, solo el compose y la plantilla de nginx | proxy |
| `MYSQL_*` de la imagen (`MYSQL_DATABASE`, `MYSQL_ROOT_PASSWORD_FILE`, `MYSQL_ROOT_HOST`) | Nuevas, solo el compose | mysql |

Archivos: `.env.example` (desarrollo: `DATABASE_URL` hacia el MySQL local) y `deploy/.env.prod.example` (producción completa, sin valores reales).

### 6.5 Scripts de respaldo y restauración

- `deploy/backup/backup.sh`: dump y `tar`, después `age`, después `rclone`, retención, `--tag` y salida con código. Sin secretos en los argumentos (lee `/run/secrets` o `~/.my.cnf` 600 dentro del contenedor).
- `deploy/backup/restore.sh <archivo>`:
  1. para la app;
  2. descifra (pide la clave privada, que no vive en el VPS);
  3. `mysql < dump`;
  4. restaura `data/`;
  5. arranca la app y ejecuta la verificación.
- `deploy/backup/restore-test.sh` (mensual, en un contenedor efímero).
- `deploy/systemd/restaurante-backup.{service,timer}` y `restaurante-alerts.{service,timer}`.
- `deploy/logrotate/restaurante` (`changes.jsonl`).
- `deploy/deploy.sh <tag|digest>`:
  1. `docker login` ya hecho;
  2. `pull`;
  3. `backup.sh --tag pre-<ver>`;
  4. `docker compose run --rm migrate`;
  5. `up -d app`;
  6. espera a `healthy`;
  7. comprobaciones básicas (`curl` a `/` y `/admin/login`).

  Registra la versión anterior para el rollback (`deploy.sh --rollback`; si hubo migración, pide restaurar el respaldo).
- Los scripts de shell se validan con `shellcheck` en el CI. **Es una herramienta nueva: solo con la aprobación del usuario.**

### 6.6 CI y CD

- **`calidad`:**
  - servicio `mysql:8.4@sha256` y `TEST_DATABASE_URL`;
  - paso `prisma migrate diff` (sin drift);
  - `npm audit --omit=dev --audit-level=high` con excepciones documentadas (REQ-F-020);
  - comprobación del compose de producción (`docker compose -f deploy/compose.prod.yaml config` + un script que falle si `app`, `mysql` o `migrate` tienen `ports`, o si alguna imagen no está fijada por digest).
- **`docker`:** construye `production` **y** `migrate`.
- **Nuevo `publish`** (solo en push a `main` o en etiquetas `v*`, después de `calidad` y `docker`):
  - `permissions: packages: write, contents: read` **solo en ese job**;
  - `docker/login-action` y `build-push-action` (fijadas por SHA) hacia `ghcr.io/orvigas/restaurante` y `…/restaurante-migrate`, con las etiquetas `sha-<commit>` y `vX.Y.Z`;
  - `provenance: true` y `sbom: true`;
  - el digest en el resumen del job.
- **CD:** recomiendo **despliegue por pull manual** (`ssh` al VPS + `deploy.sh <digest>`) en lugar de que GitHub entre por SSH al VPS. Así no se guarda una llave SSH del servidor en GitHub, y el usuario controla cuándo se corta el bot. Una fase 2 opcional sería un job `deploy` con `environment: production` (aprobación manual), una llave restringida con `command=` y una IP de origen. Se descarta Watchtower (actualizaciones no controladas y `docker.sock` montado).
- **GHCR frente a build en el VPS:** recomiendo **GHCR**. Motivos:
  - la imagen ya se construye en el CI;
  - el VPS no necesita código, Node, npm ni dependencias de desarrollo (I-9 y F-11);
  - las imágenes son reproducibles y se pueden fijar por digest;
  - el rollback es inmediato;
  - basta con 2 GB o 4 GB de RAM.

  Coste: un paquete privado en GHCR (gratis en el plan Free dentro de sus límites **[verificar]**) y un token de lectura en el VPS. El build en el VPS solo compensa si no se quiere ningún registro: entonces hacen falta el clon con una llave de despliegue de solo lectura, más RAM y `docker compose build`.
- `.github/dependabot.yml` (npm, github-actions y docker).

### 6.7 Documentación

- **Reescribir `restaurante/docs/despliegue.md`** para Docker en Hostinger:
  - requisitos;
  - preparación del VPS;
  - DNS y TLS;
  - secretos;
  - primer despliegue;
  - migraciones;
  - webhook de Meta;
  - comprobaciones;
  - actualización y rollback;
  - respaldos y restauración;
  - `admin:recover` en el contenedor;
  - problemas frecuentes;
  - sección "Pendientes" cerrada o actualizada.
- **README:**
  - "Docker": quitar "El despliegue actual en la VM **no cambia** (Node + nginx, sin contenedores)" y "La VM no usa esta imagen", y presentar Docker como el método de producción;
  - "Base de datos": MySQL, `DATABASE_URL`, `utf8mb4`, verificación al arrancar y migraciones con `migrate`;
  - "Archivos de datos": quitar `restaurante.db`;
  - "Seguridad": sustituir el ejemplo de nginx por un enlace a `deploy/nginx`;
  - "CI": servicio MySQL y `publish`;
  - "Guías": "Despliegue a producción en el VPS (Docker)".
- `docs/desarrollo.md`: MySQL local (`npm run db:up` o `test:db:up`), `DATABASE_URL` y `SHADOW_DATABASE_URL`.
- `CLAUDE.md` y `.claude/agents/senior-fullstack.md`: el stack dice "SQLite con Prisma 7 (`@prisma/adapter-better-sqlite3`)", "`DATA_DIR/restaurante.db`" y "la app aplica las migraciones al arrancar". Hay que actualizarlos (**solo con la aprobación del usuario**: son instrucciones del proyecto).
- `.claude/rules/testing.md`: añadir la regla de la base de pruebas (`TEST_DATABASE_URL`, nunca una base real).

---

## 7. Plan de acción

### 7.1 Tickets de código del repositorio (orden por dependencias)

Numeración provisional: el BA asigna el número definitivo. Se conservan los números REQ-F-014 a REQ-F-020 propuestos en el informe OWASP y se añaden los nuevos desde REQ-F-021.

| # | Ticket | Objetivo | Alcance | Esfuerzo | Riesgos | Pruebas |
|---|--------|----------|---------|----------|---------|---------|
| 1 | **REQ-F-014** Configuración segura por defecto | Que la app no falle en abierto | `HOST` (por defecto `127.0.0.1` con `TRUST_PROXY` o en producción; `0.0.0.0` solo explícito); `NODE_ENV` obligatorio en `server.ts` (o aviso, decisión pendiente de OWASP); documentar las cabeceras del proxy | S | El healthcheck del contenedor exige `HOST=0.0.0.0`: el compose lo fija | `loadConfig` (`HOST` por defecto e inválido; `NODE_ENV` ausente); integración: escucha en loopback; la imagen arranca con `HOST=0.0.0.0` |
| 2 | **REQ-F-021** Migración de la base de datos a MySQL | Sustituir SQLite por MySQL 8.4 sin cambiar el comportamiento funcional | Provider `mysql`, adaptador y driver (versiones exactas) y retirada de `better-sqlite3`; `@db.*` de longitudes; migración inicial nueva; `DATABASE_URL` en `env.ts` (y `_FILE` opcional); `client.ts` con pool; `verifyDatabase()` en lugar de `prepareDatabase()` (opción A); `isolationLevel: Serializable` + reintento P2034 en el repositorio de usuarios; `admin:recover` con `DATABASE_URL`; soporte de pruebas MySQL (una base por trabajador, `TRUNCATE`, salvaguarda); `mysql-test` en `compose.yaml`; CI con el servicio MySQL y `migrate diff`; etapa `migrate` del Dockerfile; actualización de README, `desarrollo.md` y `.env.example` | **L** | Write skew D-7; colación (`bin` frente a `ai_ci`); DDL no atómica; suite más lenta; versión del adaptador **[verificar]**; `caching_sha2_password` | Toda la suite contra MySQL; prueba concurrente D-7 repetida N veces; emojis y acentos de ida y vuelta (`utf8mb4`) en nombres de productos y usuarios; "jose" y "José" según la colación decidida; `verifyDatabase` (pendiente, más nueva, modificada, colación incorrecta, inalcanzable → código 1 sin secretos en el log); `DATABASE_URL` inválida → `ConfigError` sin valor; arranque desde cero con importación y bootstrap |
| 2b | **REQ-F-022** *(solo si hay datos reales)* Migración de datos de SQLite a MySQL | Conservar usuarios, auditoría y productos | Script de un solo uso, conservación de ids, `AUTO_INCREMENT`, verificación por conteos y sumas de control, runbook | M | Pérdida o duplicación si se ejecuta dos veces: idempotencia por comprobación previa de tablas vacías | Fixture SQLite → MySQL de prueba; conteos y sumas iguales; segunda ejecución rechazada |
| 3 | **REQ-F-023** Imagen y compose de producción endurecidos | Producción reproducible y con privilegios mínimos | `FROM` por digest; etiquetas OCI; `deploy/compose.prod.yaml` (`app`, `mysql`, `migrate`, redes, volúmenes, secretos, límites, healthchecks, logging); `deploy/mysql/` (`conf.d` y el `initdb` de usuarios); `deploy/.env.prod.example`; comprobación de compose en el CI | M | `read_only` o `cap_drop` rompen MySQL o Prisma **[verificar en staging]**; memoria del VPS | `docker compose config` válido; script del CI: sin `ports` en `app` y `mysql`, imágenes con digest; prueba de humo en el CI (opcional): `up` con MySQL, `migrate`, app `healthy`, `GET /` 200, `app_rw` sin `CREATE` |
| 4 | **REQ-F-024** Proxy inverso con TLS (nginx y certbot) | Cerrar F-01, F-03 y F-06 en el borde | Configuración versionada de nginx (§4.4 y §4.5), plantilla con `DOMAIN`, servidor por defecto 444, 401 del webhook sin firma, límites por ruta, `gzip off` en `/admin`, certbot por webroot y timers de systemd | M | Un límite demasiado bajo bloquea a Meta o al personal; certificados en el primer arranque (huevo y gallina: arrancar primero solo en HTTP para ACME) | `nginx -t` en el CI; prueba de humo: 80 → 301, POST al webhook sin firma → 401 sin leer el cuerpo, cuerpo > 3m → 413, `/admin/login` > N/min → 429, `X-Forwarded-For` del cliente ignorado |
| 5 | **REQ-F-016** Webhook resistente a DoS y logs sin ruido | Defensa en profundidad de F-03 y F-13 | Según OWASP | S-M | Contrato del webhook | Según OWASP + `chat-bot-contract.test.ts` |
| 6 | **REQ-F-025** Respaldos y restauración | Recuperación ante desastres probada | `backup.sh`, `restore.sh`, `restore-test.sh`, timers, `logrotate`, documentación | M | Clave de `age` perdida = respaldos inútiles; destino **[decidir]** | `shellcheck` (si se aprueba); restauración en el CI o en local sobre un MySQL efímero con conteos iguales |
| 7 | **REQ-F-020 + REQ-F-026** Cadena de suministro y CI/CD | Publicar imágenes verificables y mantener dependencias al día | `npm audit --omit=dev` con excepciones; `dependabot.yml` (npm, actions y docker); job `publish` a GHCR (permisos solo en ese job, SBOM y procedencia); `deploy.sh` con rollback; documentación | M | Permisos de escritura de paquetes en el CI; token del VPS | CI en verde; PR de Dependabot de prueba; `deploy.sh` en staging (o en el VPS antes de abrir el DNS) |
| 8 | **REQ-F-027** Operación: alertas y monitorización | Que alguien se entere de los fallos (F-13 e I-6) | `alerts.sh` y su timer, documentación del monitor externo, umbrales de disco y reinicios | S | Falsos positivos | Prueba del script con un log de ejemplo |
| 9 | **REQ-F-015** Límite de intentos robusto y sesión | F-02 y F-12 | Según OWASP | M | Bloqueo de usuarios legítimos | Según OWASP |
| 10 | **REQ-F-017** Topes del bot | F-04 | Según OWASP (necesita al BA) | M | Clientes reales con muchos pedidos | Según OWASP |
| 11 | **REQ-F-019** scrypt (y aviso de permisos de `DATA_DIR`) | F-07 (F-08 desaparece) | Re-hash transparente; medir en el VPS con el `mem_limit` de la app | S | Memoria por intento | Según OWASP, sin la parte del `.db` |
| 12 | **REQ-F-018** Cabeceras y fuentes | F-09 y F-10 | Según OWASP | S/M | Fuentes bloqueadas | Según OWASP |
| 13 | **REQ-F-028** Guía de despliegue en el VPS | Documentación final coherente | Reescritura de `despliegue.md`, README, `CLAUDE.md` y del agente (con aprobación) | M | Desfase con la realidad del VPS | Revisión con el checklist real ejecutado |

Para salir a producción con el bot abierto al público, el mínimo es: 1, 2 (y 2b si aplica), 3, 4, 5, 6 y 7, más I-5 (límite de gasto en Meta). Los tickets 9 a 12 pueden ir después, pero 9 y 10 antes de anunciar el bot.

### 7.2 Lo que hace el usuario (VPS, panel y cuentas)

Checklist paso a paso de preparación del VPS:

1. **Contratar el plan** (§3.1) con Ubuntu 24.04 LTS limpio **[verificar]** en la región más cercana. Activar el 2FA de Hostinger.
2. **Firewall del panel [verificar]:** entrada 80 y 443 desde cualquier origen, 22 solo desde tu IP (si es fija); el resto denegado.
3. **DNS:** registro `A` (y `AAAA` si hay IPv6) del dominio y de `www` hacia la IP del VPS. TTL bajo (300) mientras se prueba.
4. Entrar como root una sola vez:
   - `apt update && apt full-upgrade -y`;
   - `timedatectl set-timezone UTC`;
   - comprobar NTP (`timedatectl`).
5. Crear el usuario `deploy` (`adduser deploy && usermod -aG sudo deploy`) y copiar tu llave pública a `~deploy/.ssh/authorized_keys` (700/600).
6. Endurecer SSH (§3.3), `systemctl restart ssh`, y **probar desde otra terminal** con `deploy` antes de cerrar la sesión de root.
7. UFW:
   - `ufw default deny incoming`;
   - `ufw default allow outgoing`;
   - `ufw limit 22/tcp` (o `allow from <tu IP> to any port 22`);
   - `ufw allow 80,443/tcp`;
   - `ufw enable`.
8. `apt install fail2ban unattended-upgrades` y configurar el jail `sshd` y el reinicio automático en la ventana elegida.
9. Swap de 2 GB (`fallocate`, `mkswap`, `swapon` y `/etc/fstab`) y `vm.swappiness=10`.
10. Instalar Docker Engine y el plugin compose desde el repositorio oficial de Docker. `usermod -aG docker deploy`. Escribir `/etc/docker/daemon.json` (§3.2) y `systemctl restart docker`.
11. Estructura: `/srv/restaurante/{deploy,data,secrets,backups}`; `chown -R deploy:deploy /srv/restaurante`; `chown 1000:1000 /srv/restaurante/data && chmod 700 /srv/restaurante/data`; `chmod 700 /srv/restaurante/secrets`.
12. Copiar `deploy/` del repositorio (versión etiquetada) a `/srv/restaurante/deploy`. No hace falta el código fuente.
13. Generar los secretos (`openssl rand …`) en `secrets/*.txt` (600) y crear `/srv/restaurante/.env` (600) a partir de `deploy/.env.prod.example`. Guardar una copia cifrada fuera del VPS.
14. Generar `ADMIN_PASSWORD_HASH` en tu máquina (`npm run admin:hash-password`) y pegarlo entre comillas simples.
15. `docker login ghcr.io` con el token de solo lectura.
16. Primer arranque:
    1. `docker compose up -d mysql` y esperar a `healthy`;
    2. `docker compose run --rm migrate`;
    3. `docker compose up -d app proxy` (proxy primero solo en HTTP);
    4. emitir el certificado con `docker compose --profile ops run --rm certbot certonly --webroot …`;
    5. activar el `server` 443 y `nginx -s reload`.
17. Instalar los timers de systemd (certbot, backup y alertas) y `logrotate`.
18. Crear el bucket fuera del VPS (con versionado o bloqueo), configurar `rclone` y la clave pública de `age`; la privada, en tu gestor de contraseñas. Ejecutar un respaldo y **una restauración de prueba**.
19. Activar snapshots o backups del panel **[verificar]** como complemento.
20. Configurar el monitor externo (disponibilidad y "dead man's switch" del respaldo).
21. Meta: límite de gasto y alertas de facturación (I-5); 2FA en Meta Business y GitHub; token del usuario del sistema con el permiso mínimo.
22. Vaciar `ADMIN_PASSWORD_HASH` del `.env` tras el primer acceso (`admin_bootstrap_ignored`) y reiniciar la app.

---

## 8. Checklist de salida a producción (go-live)

**Infraestructura**

- [ ] Firewall del panel y UFW: solo 80 y 443 públicos; 22 restringido. `nmap` desde fuera muestra solo 80 y 443 (y 22 si se permitió).
- [ ] `docker compose ps`: `app`, `mysql` y `proxy` en `healthy`; `migrate` salió con 0. `docker compose port app 3000` y `docker compose port mysql 3306` no devuelven nada.
- [ ] Imágenes por digest; la versión desplegada coincide con un commit de `main` con el CI en verde (`calidad`, `docker` y `publish`).
- [ ] SSH sin contraseña ni root; fail2ban activo; unattended-upgrades activo; NTP sincronizado.

**TLS y proxy**

- [ ] `http://<dominio>` responde 301 a https. Certificado válido y renovación probada (`certbot renew --dry-run`).
- [ ] TLS 1.2 y 1.3 solamente (por ejemplo, con un analizador SSL externo, nota A o superior).
- [ ] Un `Host` desconocido o el acceso por IP no sirven la app (444).
- [ ] `curl -H 'X-Forwarded-Proto: https' http://<ip>/admin/login` no salta la puerta HTTPS (F-01).
- [ ] POST a `/webhooks/whatsapp` sin firma → 401 inmediato; cuerpo > 3 MB → 413; `/admin/login` repetido → 429.

**App y base de datos**

- [ ] Logs: `server_started` con `nodeEnv: production` y `trustProxy: true`; con el bot, `bot_provider_selected` con `meta`; en el primer arranque, `menu_data_seeded`, `products_imported` y `admin_bootstrap_created`.
- [ ] `SHOW GRANTS FOR app_rw` sin DDL; `@@character_set_database = utf8mb4` y la colación decidida.
- [ ] Un producto con emoji y acentos se guarda en `/admin` y se ve igual en la landing (`utf8mb4`).
- [ ] `/`, `/molotes` y `/birria` responden 200; `/` muestra el negocio del día (`BUSINESS_TIMEZONE`). Los CTA abren el chat del número del bot.
- [ ] `/admin` por HTTPS: acceso, cookie `admin_sid` con `Secure`, `HttpOnly` y `SameSite=Strict`.
- [ ] `ADMIN_PASSWORD_HASH` vaciado tras el primer acceso.
- [ ] **CA-26 (REQ-F-009):** ninguna línea de log contiene contraseñas, hashes, tokens, id de sesión ni `DATABASE_URL`. Revisar `docker compose logs app` tras un recorrido completo (acceso, edición, cambio de contraseña y pedido del bot).

**Meta y el bot**

- [ ] Prerrequisitos de Meta completos: Business verificado, app con WhatsApp, WABA, número dedicado, **token permanente del usuario del sistema** (permiso mínimo `whatsapp_business_messaging`), App Secret, plantilla `nuevo_pedido` **aprobada** y números del personal.
- [ ] **Método de pago añadido en Meta Business** (sin él, los mensajes de pago y la plantilla al personal fallan) y **límite de gasto y alertas** configurados (I-5).
- [ ] Webhook registrado: `https://<dominio>/webhooks/whatsapp`, token de verificación igual a `WHATSAPP_BOT_VERIFY_TOKEN`, campo `messages` suscrito; la verificación devuelve el reto (sin `bot_webhook_verify_failed`).
- [ ] **CA-26 de punta a punta (REQ-F-009):** con el número real, un pedido completo de **cada negocio** (un día laborable para Molotes y un sábado o domingo para Birria, o dos pruebas en días distintos) llega al personal correcto. Confirmar la longitud y el formato de los parámetros de la plantilla (errores 132018 y 132000). Sin `bot_staff_send_failed`, `bot_staff_delivery_failed` ni `bot_api_error`.
- [ ] Nota sobre CA-26: en el informe OWASP y en REQ-F-001 existe además un CA-26 distinto ("ninguna contraseña en los logs"), que cubre el punto de logs de la sección anterior.

**Operación**

- [ ] Primer respaldo completo fuera del VPS y **restauración de prueba superada**.
- [ ] Alertas probadas (forzar un `admin_login_locked` en staging o por la red de pruebas y comprobar que llega el aviso).
- [ ] Monitor externo activo.
- [ ] Runbook de rollback probado: `deploy.sh --rollback` a la versión anterior, sin migración entre medias.
- [ ] Documentación (`despliegue.md`) refleja exactamente lo ejecutado.
- [ ] Antes de anunciar el bot: REQ-F-015 y REQ-F-017 hechos o el riesgo aceptado por escrito.

---

## 9. Preguntas para el usuario

| # | Pregunta | Opción recomendada |
|---|----------|--------------------|
| 1 | **Plan de Hostinger:** ¿cuál vas a contratar o ya tienes (vCPU, RAM, disco)? | 2 vCPU, 4 GB de RAM y 50 GB NVMe o más (§3.1), con imágenes de GHCR. El plan de 1 vCPU y 4 GB también sirve si no construyes en el VPS. **[verificar] los nombres y precios actuales** |
| 2 | **Dominio:** ¿cuál es? ¿Usarás subdominios (por ejemplo `admin.`)? ¿Otros servicios en el mismo dominio? (helmet envía HSTS con `includeSubDomains`) | Un dominio propio con `www` redirigido al dominio raíz, todo en HTTPS. Si hay subdominios sin HTTPS, avisar antes del primer despliegue (HSTS) |
| 3 | **Datos reales en SQLite:** ¿hay una instalación con usuarios, productos o auditoría que haya que conservar? | Si no la hay (lo probable, la VM no estaba en producción), empezar con MySQL vacío y no hacer REQ-F-022 |
| 4 | **Registro de imágenes:** ¿GHCR o build en el VPS? | **GHCR** (paquete privado; el CI construye y publica; el VPS solo hace `pull` por digest) |
| 5 | **Proxy:** ¿nginx con certbot o Caddy? | **nginx** (limitación de peticiones nativa, I-2 tal cual; §2.3) |
| 6 | **Cloudflare delante:** ¿sí o no? | **No al principio** (o solo DNS, con la nube gris). Si se activa el proxy de Cloudflare: IP real con `CF-Connecting-IP`, firewall solo para sus rangos y revisión de los límites por IP |
| 7 | **Respaldos:** ¿quién los administra y dónde se guardan? ¿Quién guarda la clave para descifrarlos? | Script automático diario a un almacenamiento S3 compatible fuera de Hostinger (B2 o R2) con versionado; clave privada de `age` en el gestor de contraseñas del dueño y de una segunda persona; restauración de prueba mensual con un responsable con nombre |
| 8 | **MySQL:** ¿en un contenedor del VPS o gestionado (de Hostinger u otro proveedor)? | **En un contenedor** (coste cero, red interna y sin TLS público). Gestionado solo si se quiere delegar los respaldos y la alta disponibilidad: entonces TLS obligatorio y una lista de IP permitidas |
| 9 | **Migraciones:** ¿servicio `migrate` con `prisma migrate deploy` (la app sin DDL) o la app migrando al arrancar como hoy? | **Servicio `migrate`** (opción A, §5.5) |
| 10 | **Colación:** ¿"jose" y "José" deben ser el **mismo** usuario (hoy no lo son) o distintos? | Mantener el comportamiento actual con **`utf8mb4_0900_bin`** (la app ya ignora mayúsculas por normalización) |
| 11 | **`/admin`:** ¿restringirlo por IP o con autenticación básica en nginx, además del acceso de la app? | Si el personal entra desde IP variables, no restringir por IP: activar `limit_req` y hacer REQ-F-015 pronto. Si hay una IP fija de oficina, lista de IP permitidas |
| 12 | **CD:** ¿despliegue manual por SSH (`deploy.sh <digest>`) o automático desde GitHub? | **Manual** en la primera fase (sin llave del VPS en GitHub y control del momento del corte del bot) |
| 13 | **Ventana de mantenimiento:** ¿a qué hora se pueden reiniciar la app y el VPS (actualizaciones, despliegues)? | Fuera del horario de servicio de los dos negocios (por ejemplo 04:00 a 05:00, hora de México) |
| 14 | **Alertas:** ¿a qué correo o canal llegan? | Correo del dueño más ntfy o Telegram al teléfono |
| 15 | **Actualizar `CLAUDE.md` y el agente `senior-fullstack`** (el stack dice SQLite y "Node directo"): ¿autorizas cambiarlos como parte de REQ-F-021 y REQ-F-028? | Sí, en el mismo ticket que cambia cada hecho |
