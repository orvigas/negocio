# Reglas de rendimiento web

<!-- Traducción al español de `rules/web/performance.md` de affaan-m/ECC (licencia MIT), con una sección final de adaptación a este proyecto. -->

> Este archivo amplía `common/performance.md` de ECC (no incluido en este proyecto) con contenido de rendimiento específico de la web.

## Objetivos de Core Web Vitals

| Métrica | Objetivo |
|--------|--------|
| LCP | < 2.5s |
| INP | < 200ms |
| CLS | < 0.1 |
| FCP | < 1.5s |
| TBT | < 200ms |

## Presupuesto de paquetes

| Tipo de página | Presupuesto de JS (gzip) | Presupuesto de CSS |
|-----------|---------------------|------------|
| Landing page | < 150kb | < 30kb |
| Página de aplicación | < 300kb | < 50kb |
| Micrositio | < 80kb | < 15kb |

## Estrategia de carga

1. Incrusta el CSS crítico de la parte visible sin desplazamiento cuando esté justificado
2. Precarga solo la imagen del hero y la fuente principal
3. Aplaza el CSS o el JS no críticos
4. Importa dinámicamente las bibliotecas pesadas

```js
const gsapModule = await import('gsap');
const { ScrollTrigger } = await import('gsap/ScrollTrigger');
```

## Optimización de imágenes

- `width` y `height` explícitos
- `loading="eager"` más `fetchpriority="high"` solo para los medios del hero
- `loading="lazy"` para los recursos por debajo de la parte visible
- Prefiere AVIF o WebP con alternativas
- Nunca publiques imágenes de origen mucho más grandes que su tamaño renderizado

## Carga de fuentes

- Como máximo dos familias tipográficas, salvo una excepción clara
- `font-display: swap`
- Crea subconjuntos cuando sea posible
- Precarga solo el peso o el estilo verdaderamente críticos

## Rendimiento de las animaciones

- Anima solo propiedades aptas para el compositor
- Usa `will-change` de forma acotada y quítalo al terminar
- Prefiere CSS para las transiciones sencillas
- Usa `requestAnimationFrame` o bibliotecas de animación consolidadas para el movimiento con JS
- Evita la sobrecarga de manejadores de scroll; usa IntersectionObserver o bibliotecas bien diseñadas

## Lista de comprobación de rendimiento

- [ ] Todas las imágenes tienen dimensiones explícitas
- [ ] No hay recursos que bloqueen el renderizado por accidente
- [ ] No hay desplazamientos de maquetación por contenido dinámico
- [ ] El movimiento se queda en propiedades aptas para el compositor
- [ ] Los scripts de terceros se cargan con async/defer y solo cuando hacen falta

## Adaptación a este proyecto

No es traducción; prevalece sobre lo anterior. **Los objetivos y presupuestos son de referencia: el CI no los impone** ni hay medición automática; un incumplimiento se informa como hallazgo, no bloquea. Stack: Koa SSR, Tailwind (una hoja por landing, generada con `npm run build:css`), BEM y JavaScript Vanilla sin bundler, sin React; el ejemplo de GSAP no aplica (sin dependencias nuevas sin aprobación). `./_stich_source_/` prevalece en imágenes y tipografías. Amplía `.claude/rules/rendimiento.md`. El código lo escribe `senior-fullstack` y la sesión principal orquesta (`.claude/CLAUDE.md` §4); CodeGraph primero; las mediciones son evidencia, no pruebas permanentes (`.claude/rules/testing.md`); nada de URL privadas ni datos a servicios externos de medición sin autorización.
