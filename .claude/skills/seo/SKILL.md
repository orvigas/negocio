---
name: seo
description: Audita, planifica e implementa mejoras de SEO en SEO técnico, optimización on-page, datos estructurados, Core Web Vitals y estrategia de contenido. Úsalo cuando el usuario quiera mejor visibilidad en buscadores, corregir problemas de SEO, marcado de esquemas, trabajo con el sitemap o robots, o el mapeo de palabras clave.
metadata:
  origin: ECC
---

<!-- Traducción al español de `skills/seo/SKILL.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

# SEO

Mejora la visibilidad en buscadores mediante la corrección técnica, el rendimiento y la relevancia del contenido, no con trucos.

## Cuándo usarlo

Usa esta skill cuando:
- audites la rastreabilidad, la indexabilidad, las canónicas o las redirecciones
- mejores las etiquetas title, las meta descriptions y la estructura de encabezados
- añadas o valides datos estructurados
- mejores Core Web Vitals
- investigues palabras clave y las asignes a URL
- planifiques el enlazado interno o cambios en el sitemap o en robots

## Cómo funciona

### Principios

1. Corrige los bloqueos técnicos antes de optimizar el contenido.
2. Una página debe tener una intención de búsqueda principal clara.
3. Prefiere las señales de calidad a largo plazo a los patrones manipuladores.
4. Las suposiciones mobile-first importan, porque la indexación es mobile-first.
5. Las recomendaciones deben ser específicas de cada página e implementables.

### Lista de comprobación de SEO técnico

#### Rastreabilidad

- `robots.txt` debe permitir las páginas importantes y bloquear las superficies de poco valor
- ninguna página importante debe quedar en `noindex` sin querer
- las páginas importantes deben alcanzarse con pocos clics
- evita cadenas de redirección de más de dos saltos
- las etiquetas canónicas deben ser coherentes consigo mismas y no formar bucles

#### Indexabilidad

- el formato de URL preferido debe ser consistente
- las páginas multilingües necesitan un hreflang correcto si se usa
- los sitemaps deben reflejar la superficie pública prevista
- ninguna URL duplicada debe competir sin control canónico

#### Rendimiento

- LCP < 2.5s
- INP < 200ms
- CLS < 0.1
- correcciones habituales: precargar los recursos del hero, reducir el trabajo que bloquea el renderizado, reservar el espacio de la maquetación, recortar el JS pesado

#### Datos estructurados

- página de inicio: esquema de organización o de negocio cuando corresponda
- páginas editoriales: `Article` / `BlogPosting`
- páginas de producto: `Product` y `Offer`
- páginas interiores: `BreadcrumbList`
- secciones de preguntas y respuestas: `FAQPage` solo cuando el contenido coincida de verdad

### Reglas on-page

#### Etiquetas title

- apunta a unos 50-60 caracteres
- coloca la palabra clave o el concepto principal cerca del principio
- haz que el título sea legible para las personas, no relleno para los bots

#### Meta descriptions

- apunta a unos 120-160 caracteres
- describe la página con honestidad
- incluye el tema principal de forma natural

#### Estructura de encabezados

- un único `H1` claro
- `H2` y `H3` deben reflejar la jerarquía real del contenido
- no te saltes la estructura solo por el estilo visual

### Mapeo de palabras clave

1. define la intención de búsqueda
2. reúne variantes realistas de palabras clave
3. prioriza por coincidencia con la intención, valor probable y competencia
4. asigna una palabra clave o tema principal a una URL
5. detecta y evita la canibalización

### Enlazado interno

- enlaza desde las páginas fuertes hacia las páginas que quieres posicionar
- usa textos de anclaje descriptivos
- evita anclajes genéricos cuando sea posible uno más específico
- añade después enlaces desde las páginas nuevas hacia las existentes que sean pertinentes

## Ejemplos

### Fórmula del título

```text
Tema principal - Modificador específico | Marca
```

### Fórmula de la meta description

```text
Acción + tema + propuesta de valor + un detalle de apoyo
```

### Ejemplo de JSON-LD

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Título de la página aquí",
  "author": {
    "@type": "Person",
    "name": "Nombre del autor"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Nombre de la marca"
  }
}
```

### Forma de la salida de una auditoría

```text
[HIGH] Etiquetas title duplicadas en las páginas de producto
Ubicación: src/routes/products/[slug].tsx
Problema: los títulos dinámicos se reducen a la misma cadena por defecto, lo que debilita la relevancia y crea señales duplicadas.
Corrección: generar un título único por producto con el nombre del producto y su categoría principal.
```

## Antipatrones

| Antipatrón | Corrección |
| --- | --- |
| relleno de palabras clave | escribe primero para los usuarios |
| páginas pobres casi duplicadas | consolídalas o diferéncialas |
| esquema para contenido que en realidad no está presente | ajusta el esquema a la realidad |
| consejos de contenido sin revisar la página real | lee primero la página real |
| resultados genéricos de «mejorar el SEO» | vincula cada recomendación a una página o a un recurso |

## Skills relacionadas

- `seo-specialist`
- `frontend-patterns`
- `brand-voice`
- `market-research`

## Adaptación a este proyecto

Esta sección no forma parte de la traducción: la añade el proyecto y **prevalece sobre el texto anterior** donde lo contradiga.

- **Stack real:** Koa con SSR; el `<head>` (title, meta description, viewport, Open Graph) se renderiza en el servidor desde las plantillas de `restaurante/landing-pages/src/views/` y el contenido de cada negocio en `restaurante/landing-pages/src/content/{molotes,birria,common}/`. HTML5 semántico, Tailwind, BEM y JavaScript Vanilla; TypeScript sin React. El ejemplo de `src/routes/products/[slug].tsx` no aplica: aquí la ubicación sería una plantilla o un archivo de contenido.
- **Superficie pública:** las landings `/` (Birria), `/birria` y `/molotes` (`.claude/CLAUDE.md` §1, §5 y §10). El admin (`inventory-manager`) no se indexa: tiene su propio `robots.txt` y no debe aparecer en sitemaps. Los productos no tienen páginas propias; `Product`/`Offer` y `BreadcrumbList` solo aplicarían si existieran. `Article`/`BlogPosting` no aplica. El esquema de negocio (`Restaurant`/`LocalBusiness`) debe coincidir con lo visible en la página.
- **El contenido SEO corresponde al negocio que se muestra** (§10). Los avisos del día no cambian el SEO de la página: la página de inicio siempre es Birria.
- **`./_stich_source_/` prevalece** en los textos y la jerarquía visual; un cambio de encabezados que altere el diseño se plantea al usuario.
- **Orquestación (`.claude/CLAUDE.md` §4):** los subagentes no invocan a otros subagentes ni esperan al usuario; la sesión principal orquesta. Los cambios los implementa `senior-fullstack`, el único que hace commits y PR, en su fase.
- **Pruebas:** la auditoría es evidencia; solo queda una prueba permanente si es funcional y nada la cubre o si el usuario la pide (`.claude/rules/testing.md`). Limpia procesos y archivos temporales.
- **CodeGraph primero** para controladores y contenido en TypeScript; Read y Grep para las plantillas HTML.
- **Servicios externos:** las herramientas de palabras clave o de auditoría externas solo con autorización del usuario y sin enviar datos personales, credenciales ni información de producción no pública. Los umbrales de Core Web Vitals son orientativos; el CI no los impone.
- **No existen** en este proyecto las skills relacionadas `seo-specialist` (salvo que se añada como agente), `frontend-patterns`, `brand-voice` ni `market-research`.
