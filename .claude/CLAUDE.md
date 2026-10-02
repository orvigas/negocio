# CLAUDE.md

## 1. Objetivo

Desarrollar una aplicación web tipo Landing Page para dos negocios dentro de la misma aplicación:

- **Molotes** — activa de lunes a viernes.
- **Birria El Muñeco** — activa sábados y domingos.

La aplicación debe determinar automáticamente qué landing page renderizar según el día de la semana, sin intervención manual.

Ambas landing pages deben incluir un botón visible para realizar pedidos mediante un bot de WhatsApp.

## 2. Stack obligatorio

### Backend

- Node.js **LTS**.
- Koa.js en su versión estable compatible con la versión LTS de Node.js utilizada.
- JavaScript moderno.
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

## 5. Comportamiento de las landing pages

La aplicación tendrá dos experiencias dentro del mismo proyecto.

### Lunes a viernes

Renderizar:

```text
Molotes
```

### Sábado y domingo

Renderizar:

```text
Birria El Muñeco
```

La selección debe realizarse automáticamente utilizando la fecha/hora correspondiente al negocio.

### Reglas

- No duplicar innecesariamente la aplicación.
- Compartir componentes, layouts y lógica común cuando sea apropiado.
- Mantener separados los contenidos específicos de cada negocio.
- El cambio de landing no debe requerir modificar código manualmente.
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

La selección entre Molotes y Birria debe considerar explícitamente la zona horaria del negocio.

No depender exclusivamente de la zona horaria accidental del servidor.

La zona horaria debe ser configurable.

Ejemplo:

```text
America/Mexico_City
```

La lógica debe considerar:

```text
Lunes  → Molotes
Martes → Molotes
Miércoles → Molotes
Jueves → Molotes
Viernes → Molotes
Sábado → Birria El Muñeco
Domingo → Birria El Muñeco
```
