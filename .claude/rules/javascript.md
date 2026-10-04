# JavaScript Vanilla

Alcance: **solo el frontend** (`restaurante/public/js`). El backend (`src/`, `tests/`, `scripts/`) usa TypeScript y sigue `.claude/rules/typescript.md`.

Utiliza JavaScript Vanilla moderno.

Prefiere:

- módulos ES
- `const` y `let`
- funciones con responsabilidades claras
- delegación de eventos
- atributos `data-*` como hooks de comportamiento
- módulos reutilizables
- acceso defensivo al DOM
- gestión explícita del estado

Evita:

- variables globales
- JavaScript inline
- manipulación innecesaria del DOM
- manejadores de eventos duplicados
- scripts monolíticos de gran tamaño

Ejemplo:

```html
<button class="button button--primary" data-action="open-modal">Open</button>
```

JavaScript debe identificar el comportamiento mediante atributos `data-*` en lugar de acoplar directamente el comportamiento a las clases de presentación siempre que sea práctico.
