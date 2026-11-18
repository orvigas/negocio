# Estilo de código web

<!-- Traducción al español de `rules/web/coding-style.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

> Este archivo amplía `common/coding-style.md` de ECC (no incluido en este proyecto) con contenido frontend específico de la web.

## Organización de archivos

Organiza por funcionalidad o por superficie, no por tipo de archivo:

```text
src/
├── components/
│   ├── hero/
│   │   ├── Hero.tsx
│   │   ├── HeroVisual.tsx
│   │   └── hero.css
│   ├── scrolly-section/
│   │   ├── ScrollySection.tsx
│   │   ├── StickyVisual.tsx
│   │   └── scrolly.css
│   └── ui/
│       ├── Button.tsx
│       ├── SurfaceCard.tsx
│       └── AnimatedText.tsx
├── hooks/
│   ├── useReducedMotion.ts
│   └── useScrollProgress.ts
├── lib/
│   ├── animation.ts
│   └── color.ts
└── styles/
    ├── tokens.css
    ├── typography.css
    └── global.css
```

## Propiedades personalizadas de CSS

Define los tokens de diseño como variables. No escribas a mano una y otra vez la paleta, la tipografía ni el espaciado:

```css
:root {
  --color-surface: oklch(98% 0 0);
  --color-text: oklch(18% 0 0);
  --color-accent: oklch(68% 0.21 250);

  --text-base: clamp(1rem, 0.92rem + 0.4vw, 1.125rem);
  --text-hero: clamp(3rem, 1rem + 7vw, 8rem);

  --space-section: clamp(4rem, 3rem + 5vw, 10rem);

  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}
```

## Propiedades solo para animación

Prefiere un movimiento apto para el compositor:
- `transform`
- `opacity`
- `clip-path`
- `filter` (con moderación)

Evita animar propiedades ligadas a la maquetación:
- `width`
- `height`
- `top`
- `left`
- `margin`
- `padding`
- `border`
- `font-size`

## HTML semántico primero

```html
<header>
  <nav aria-label="Navegación principal">...</nav>
</header>
<main>
  <section aria-labelledby="hero-heading">
    <h1 id="hero-heading">...</h1>
  </section>
</main>
<footer>...</footer>
```

No recurras a pilas de `div` envolventes genéricos cuando exista un elemento semántico.

## Nomenclatura

- Componentes: PascalCase (`ScrollySection`, `SurfaceCard`)
- Hooks: prefijo `use` (`useReducedMotion`)
- Clases CSS: kebab-case o clases utilitarias
- Líneas de tiempo de animación: camelCase con intención (`heroRevealTl`)

## Adaptación a este proyecto

No es traducción; prevalece sobre lo anterior. Stack: Koa SSR, HTML5 semántico, Tailwind v4, BEM y JavaScript Vanilla en módulos ES; sin React. **No aplican** el árbol de `.tsx`, los componentes en PascalCase ni los hooks: la estructura es la de `.claude/agents/senior-fullstack.md` (`src/views/{layouts,pages,partials}`, `src/styles/`, `public/js/modules/`). Las clases propias siguen BEM (`.claude/rules/bem.md`) y los tokens viven en el `@theme` de Tailwind, tomados de `./_stich_source_/`, que prevalece. Nada de GSAP ni dependencias de animación sin aprobación (`.claude/rules/dependencias.md`). El código lo escribe `senior-fullstack` y la sesión principal orquesta (`.claude/CLAUDE.md` §4); CodeGraph primero; pruebas según `.claude/rules/testing.md`.
