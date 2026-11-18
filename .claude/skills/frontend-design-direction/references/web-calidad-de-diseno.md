# Estándares de calidad de diseño web

<!-- Traducción al español de `rules/web/design-quality.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

> Este archivo amplía `common/patterns.md` de ECC (no incluido en este proyecto) con pautas de calidad de diseño específicas de la web.

## Política contra las plantillas

No publiques UI con aspecto de plantilla genérica. El resultado frontend debe verse intencionado, con criterio propio y específico del producto.

### Patrones prohibidos

- Cuadrículas de tarjetas por defecto con espaciado uniforme y sin jerarquía
- Sección hero de archivo con titular centrado, mancha de degradado y CTA genérico
- Valores por defecto de bibliotecas sin modificar presentados como diseño terminado
- Maquetaciones planas sin capas, profundidad ni movimiento
- Radios, espaciados y sombras uniformes en todos los componentes
- Estilo seguro de gris sobre blanco con un único color de acento decorativo
- Paneles de manual con barra lateral + tarjetas + gráficos y sin un punto de vista
- Pilas de fuentes por defecto usadas sin una razón deliberada

### Cualidades obligatorias

Toda superficie frontend significativa debe mostrar al menos cuatro de estas:

1. Jerarquía clara mediante el contraste de escala
2. Ritmo intencionado en el espaciado, no el mismo relleno en todas partes
3. Profundidad o capas mediante superposición, sombras, superficies o movimiento
4. Tipografía con carácter y una estrategia real de combinación
5. Color usado con significado, no solo como decoración
6. Estados hover, focus y active que se sientan diseñados
7. Composición editorial o bento que rompa la cuadrícula donde corresponda
8. Textura, grano o atmósfera cuando encaje con la dirección visual
9. Movimiento que aclare el flujo en lugar de distraer de él
10. Visualización de datos tratada como parte del sistema de diseño, no como un añadido posterior

## Antes de escribir código frontend

1. Elige una dirección de estilo concreta. Evita valores por defecto vagos como «limpio y minimalista».
2. Define una paleta de forma intencionada.
3. Elige la tipografía de forma deliberada.
4. Reúne al menos un pequeño conjunto de referencias reales.
5. Usa las skills de diseño/frontend de ECC cuando sean pertinentes.

## Direcciones de estilo que merecen la pena

- Editorial / revista
- Neobrutalismo
- Glassmorphism con profundidad real
- Lujo oscuro o lujo claro con un contraste disciplinado
- Maquetaciones bento
- Scrollytelling
- Integración 3D
- Suizo / Internacional
- Retrofuturismo

No elijas el modo oscuro automáticamente. Elige la dirección visual que el producto realmente quiere.

## Lista de comprobación de componentes

- [ ] ¿Evita parecer una plantilla por defecto de Tailwind o de shadcn?
- [ ] ¿Tiene estados hover/focus/active intencionados?
- [ ] ¿Usa la jerarquía en lugar de un énfasis uniforme?
- [ ] ¿Resultaría creíble en una captura de un producto real?
- [ ] Si admite ambos temas, ¿se sienten intencionados tanto el claro como el oscuro?

## Adaptación a este proyecto

No es traducción; prevalece sobre lo anterior. **Solo aplica donde `./_stich_source_/` no define nada** (p. ej., una pantalla nueva del admin, diseñada con Stitch y aprobada por el usuario; `.claude/rules/stitch-diseno.md`): lo definido en el diseño fuente prevalece y no se «mejora» con estas pautas. Stack: Koa SSR, HTML5 semántico, Tailwind, BEM y JavaScript Vanilla, sin React ni shadcn. «Las skills de ECC» son `.claude/skills/frontend-design-direction` y `design-system`. No aplican el modo oscuro (no existe) ni las direcciones que exijan dependencias nuevas (3D). Referencias externas sin enviar datos del proyecto, personales, credenciales ni de producción. El código lo escribe `senior-fullstack`; la sesión principal orquesta (`.claude/CLAUDE.md` §4). CodeGraph primero; las revisiones visuales son evidencia, no pruebas permanentes (`.claude/rules/testing.md`).
