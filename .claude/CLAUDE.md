# CLAUDE.md

## 1. Objetivo

Desarrollar una aplicación web tipo Landing Page para dos negocios dentro de la misma aplicación:

- **Molotes** — abre de martes a viernes. Su landing está en `/molotes`.
- **Birria El Muñeco** — abre sábados y domingos. Su landing está en `/birria` y es también la página de inicio (`/`) todos los días.
- **Lunes** — descanso: no abre ningún negocio.

La página de inicio muestra siempre Birria y, según el día de la semana, abre automáticamente un aviso (modal), sin intervención manual (REQ-F-028). `/molotes` también abre un aviso los días en que no hay molotes: el lunes (descanso) y el fin de semana ("hoy toca birria"; REQ-F-034).

Ambas landing pages deben incluir un botón visible para realizar pedidos mediante un bot de WhatsApp.

## 2. Stack obligatorio

### Backend

- Node.js **LTS**.
- Koa.js en su versión estable compatible con la versión LTS de Node.js utilizada.
- TypeScript estricto (`strict`), ejecutado con el type stripping nativo de Node 24, sin paso de compilación ni `dist/`, y verificado con `npm run typecheck`. Convenciones en `.claude/rules/typescript.md`.
- npm como gestor de paquetes.
- Arquitectura sencilla, modular y mantenible.
- No introducir frameworks backend adicionales salvo que exista una necesidad justificada.

### Frontend

- HTML5 semántico.
- CSS3.
- Tailwind CSS.
- Metodología BEM para clases CSS propias.
- Vanilla JavaScript.
- No utilizar React, Vue, Angular, Svelte ni otros frameworks frontend.
- Priorizar accesibilidad, rendimiento, SEO y diseño responsive.

## 3. Fuente de verdad del diseño

El directorio:

```text
./_stich_source_/
```

contiene los diseños y especificaciones UI/UX de la aplicación.

### Regla obligatoria

Antes de implementar o modificar cualquier elemento visual del frontend:

1. Revisar el contenido de `./_stich_source_/`.
2. Identificar las especificaciones, componentes, layouts, estilos, imágenes y recursos disponibles.
3. Respetar el diseño definido en dicho directorio.
4. No sustituir decisiones de UI/UX del diseño fuente por decisiones arbitrarias.
5. Si existe conflicto entre una implementación y las especificaciones de `_stich_source_/`, prevalecen las especificaciones de `_stich_source_/`.

No inventar componentes, estilos, colores, tipografías, espaciados o comportamientos cuando exista una definición equivalente en `_stich_source_/`.

## 4. Agente obligatorio

Todo trabajo relacionado con frontend, backend o integración full-stack debe utilizar el agente:

```text
.claude/agents/senior-fullstack.md
```

### Regla

Antes de realizar tareas de implementación, modificación o revisión significativa:

- Delegar la tarea al agente `senior-fullstack`.
- El agente debe revisar primero `CLAUDE.md` y las reglas relevantes del proyecto.
- Para tareas frontend debe revisar obligatoriamente `./_stich_source_/`.

No crear una implementación paralela que ignore al agente `senior-fullstack`.

### Orquestación del flujo de requisitos

Los subagentes no pueden invocar a otros subagentes ni esperar respuestas del usuario: cada invocación ejecuta **una fase**, devuelve un estado y termina. La **sesión principal** es la orquestadora:

1. Invoca al agente que corresponde al estado actual del ticket.
2. Presenta al usuario el resultado devuelto y, si el estado es una aprobación pendiente, le pregunta.
3. Vuelve a invocar al agente correspondiente, incluyendo en el prompt la decisión del usuario (cita textual) y la ruta del ticket.
4. Nunca salta un punto de aprobación ni aprueba en nombre del usuario.

| Estado                          | Carpeta        | Lo asigna          | Siguiente paso (sesión principal)                       |
| ------------------------------- | -------------- | ------------------ | ------------------------------------------------------- |
| `NEEDS_CLARIFICATION`           | —              | business-analyst   | Preguntar al usuario y reinvocar al BA                  |
| `NEEDS_USER_VALIDATION`         | —              | business-analyst   | Pedir aprobación; si aprueba, reinvocar al BA para persistir |
| `APPROVED`                      | `backlog/`     | business-analyst   | Invocar a senior-fullstack (revisión técnica)           |
| `NEEDS_TECHNICAL_CLARIFICATION` | `backlog/`     | senior-fullstack   | Preguntar al usuario y reinvocar a senior-fullstack     |
| `NEEDS_TECHNICAL_PLAN_APPROVAL` | `backlog/`     | senior-fullstack   | Pedir aprobación; si aprueba, reinvocar para implementar |
| `IN_PROGRESS`                   | `in-progress/` | senior-fullstack   | (transitorio durante la implementación)                 |
| `NEEDS_IMPLEMENTATION_APPROVAL` | `in-progress/` | senior-fullstack   | Pedir aprobación; si aprueba, invocar a senior-qa       |
| `NEEDS_QA_PLAN_APPROVAL`        | `in-progress/` | senior-qa          | Pedir aprobación; si aprueba, reinvocar a senior-qa     |
| `NEEDS_USER_DECISION`           | `in-progress/` | senior-qa          | Preguntar al usuario (p. ej. defecto MAJOR) y reinvocar a senior-qa |
| `QA_REJECTED`                   | `in-progress/` | senior-qa          | Reinvocar a senior-fullstack con el QA Report           |
| `QA_APPROVED`                   | `in-progress/` | senior-qa          | Reinvocar a senior-fullstack para commit y Pull Request |
| `READY_FOR_MERGE`               | `in-progress/` | senior-fullstack   | El usuario revisa y hace merge del PR                   |
| `DONE`                          | `done/`        | senior-fullstack   | Solo cuando el usuario confirma que el PR fue mergeado  |

Los tickets viven en `.claude/docs/{backlog,in-progress,done}/` como `REQ-F-<NNN>-<slug>.md`. Un ticket existe en una sola carpeta a la vez.

Los cambios pequeños que no provienen de un ticket (correcciones puntuales, ajustes menores) se delegan directamente a `senior-fullstack` sin el ciclo completo, respetando igualmente `CLAUDE.md` y `.claude/rules/`.

## 5. Comportamiento de las landing pages

La aplicación tendrá dos experiencias dentro del mismo proyecto: `/molotes` (Molotes) y `/birria` (Birria El Muñeco), cada una siempre disponible en su ruta.

### Página de inicio (`/`)

Renderiza siempre:

```text
Birria El Muñeco
```

Según el día, abre además un aviso (modal):

- **Lunes:** aviso "Descanso" (ese día no abre ningún negocio), con un enlace a `/molotes`.
- **Martes a viernes:** aviso "Molotes" (la birria es de fin de semana), con un enlace a `/molotes`.
- **Sábado y domingo:** ningún aviso.

### Avisos de `/molotes` (REQ-F-034)

- **Lunes:** aviso "Descanso" (comparte la marca de sesión con el de `/`: se ve una sola vez entre ambas rutas).
- **Martes a viernes:** ningún aviso.
- **Sábado y domingo:** aviso "Hoy toca birria", con un enlace a `/birria` y un botón para quedarse en Molotes.

`/birria` nunca muestra aviso.

Cada aviso se decide en el servidor con la fecha del negocio, se muestra una vez por sesión del navegador, sus textos son editables en el contenido del negocio que lo muestra (Birria para `/`, Molotes para `/molotes`), no impide consultar la página y, sin JavaScript, no tapa nada.

### Reglas

- No duplicar innecesariamente la aplicación.
- Compartir componentes, layouts y lógica común cuando sea apropiado.
- Mantener separados los contenidos específicos de cada negocio.
- El cambio del aviso según el día no debe requerir modificar código manualmente.
- Evitar lógica duplicada entre ambas experiencias.

## 6. WhatsApp / pedidos

Ambas landing pages deben incluir un CTA claro y visible para realizar pedidos.

El CTA debe enlazar al bot de WhatsApp correspondiente.

La URL, número, mensaje inicial y demás configuración relacionada con WhatsApp deben ser configurables y no estar dispersos por el código.

Ejemplo conceptual:

```text
WHATSAPP_MOLOTES
WHATSAPP_BIRRIA
```

La implementación debe permitir modificar estos valores mediante configuración sin modificar los componentes visuales.

El usuario debe poder iniciar el pedido desde cualquier landing page de forma sencilla.

## 7. Contenido

Separar claramente:

- contenido de Molotes;
- contenido de Birria El Muñeco;
- configuración común;
- configuración de WhatsApp;
- información de contacto;
- información de horarios;
- recursos visuales.

No hardcodear repetidamente información de negocio dentro de HTML o JavaScript.

## 8. Arquitectura

`restaurante/` es un monorepo de npm workspaces con tres apps Koa y paquetes compartidos:

- **`landing-pages`**: las landings de Molotes y Birria (SSR). En transición, contiene también `/admin` y el bot de WhatsApp.
- **`api`**: la API JSON propia (productos públicos y su administración), solo en la red interna.
- **`inventory-manager`**: el admin nuevo de productos (SSR), que solo habla con la `api`.
- **Paquetes**: `core` (dominio), `db` (MySQL con Prisma), `contracts` (contratos de la API) y `web` (utilidades HTTP y SSR).

La regla de dependencias entre paquetes y apps la impone `npm run lint` (`restaurante/eslint.config.ts`), no la convención. La referencia completa (capas, regla de dependencias, contratos y plan de migración) está en [`restaurante/docs/arquitectura.md`](../restaurante/docs/arquitectura.md).

## 9. Frontend

El frontend debe:

- utilizar HTML5 semántico;
- ser responsive/mobile-first;
- utilizar Tailwind CSS;
- utilizar BEM para clases CSS propias;
- utilizar Vanilla JavaScript;
- evitar JavaScript innecesario;
- optimizar imágenes y recursos;
- mantener buen rendimiento;
- implementar navegación y CTA accesibles;
- utilizar etiquetas semánticas y atributos ARIA cuando sean necesarios;
- respetar las especificaciones visuales de `_stich_source_/`.

## 10. SEO

Cada landing debe contar con:

- `<title>` apropiado;
- meta description;
- viewport;
- Open Graph básico;
- estructura semántica;
- encabezados correctamente jerarquizados;
- URLs y contenido compatibles con SEO.

El contenido SEO debe corresponder al negocio que se está mostrando.

## 11. Fecha y zona horaria

La elección del aviso de la página de inicio y del de `/molotes` debe considerar explícitamente la zona horaria del negocio (`BUSINESS_TIMEZONE`).

No depender exclusivamente de la zona horaria accidental del servidor.

La zona horaria debe ser configurable.

Ejemplo:

```text
America/Mexico_City
```

La lógica debe considerar:

```text
Lunes     → Birria El Muñeco + aviso "Descanso"
Martes    → Birria El Muñeco + aviso "Molotes"
Miércoles → Birria El Muñeco + aviso "Molotes"
Jueves    → Birria El Muñeco + aviso "Molotes"
Viernes   → Birria El Muñeco + aviso "Molotes"
Sábado    → Birria El Muñeco (sin aviso)
Domingo   → Birria El Muñeco (sin aviso)
```

Y en `/molotes`:

```text
Lunes             → Molotes + aviso "Descanso"
Martes a viernes  → Molotes (sin aviso)
Sábado y domingo  → Molotes + aviso "Hoy toca birria"
```

`/birria` no muestra aviso ningún día.

No depender tampoco del reloj del dispositivo del cliente: el servidor decide el aviso.
