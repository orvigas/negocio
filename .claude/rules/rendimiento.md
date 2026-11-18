# Rendimiento

La implementación frontend debe minimizar:

- JavaScript innecesario
- operaciones sobre el DOM
- CSS duplicado
- assets duplicados
- solicitudes de red excesivas
- imágenes innecesariamente grandes

Prefiere las capacidades nativas del navegador siempre que sean suficientes.

## Referencia web

Objetivos orientativos: el CI no los impone ni los mide; un incumplimiento se informa como hallazgo, no bloquea. Texto completo (traducción de ECC) en `.claude/skills/frontend-design-direction/references/web-rendimiento.md`.

- Core Web Vitals: LCP < 2.5 s, INP < 200 ms, CLS < 0.1, FCP < 1.5 s, TBT < 200 ms.
- Presupuesto (gzip): landing, JS < 150 kB y CSS < 30 kB; admin, JS < 300 kB y CSS < 50 kB.
- Carga: precarga solo la imagen del hero y la fuente principal; aplaza el CSS y el JS no críticos (`import()` dinámico para lo pesado); scripts de terceros con `async`/`defer` y solo si hacen falta; nada que bloquee el renderizado por accidente.
- Imágenes: `width` y `height` explícitos; `loading="eager"` y `fetchpriority="high"` solo en el hero, `loading="lazy"` bajo la parte visible; AVIF o WebP con alternativa; nunca mucho mayores que su tamaño renderizado.
- Fuentes: máximo dos familias, `font-display: swap`, subconjuntos cuando se pueda y precarga solo del peso crítico.
- Animación: solo propiedades del compositor (`transform`, `opacity`; `clip-path` y `filter` con moderación), nunca `width`, `height`, `top`, `left`, `margin`, `padding`, `border` ni `font-size`; `will-change` acotado y retirado al terminar; CSS para transiciones simples y `requestAnimationFrame` para movimiento con JS; `IntersectionObserver` en lugar de manejadores de scroll; sin desplazamientos de maquetación por contenido dinámico.
- `./_stich_source_/` prevalece en imágenes y tipografías; sin dependencias de animación (p. ej. GSAP) sin aprobación (`dependencias.md`). Las mediciones son evidencia, no pruebas permanentes (`testing.md`), y no se envían URL privadas ni datos a servicios externos de medición sin autorización.
