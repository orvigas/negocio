# Tailwind CSS

Utiliza Tailwind CSS para estilos y diseño.

Prefiere clases utilitarias para:

- espaciado
- tipografía
- colores
- diseño
- comportamiento responsivo
- estados
- bordes
- sombras
- dimensiones

Las clases BEM deben representar los componentes y la estructura semántica, mientras que las utilidades de Tailwind proporcionan el estilo a nivel de implementación.

No crees grandes cantidades de CSS personalizado cuando Tailwind pueda resolver el problema de forma limpia.

Cuando sea necesario utilizar CSS personalizado, mantenlo pequeño, intencional y limitado al componente.

Los tokens de diseño (colores, tipografía, espaciado, duraciones y curvas) se definen una vez como variables en el `@theme` de Tailwind de cada hoja, tomados de `./_stich_source_/`, que prevalece; no repitas esos valores a mano. Qué propiedades animar: `rendimiento.md`. Referencia completa (traducción de ECC, con partes que no aplican a este stack): `.claude/skills/frontend-design-direction/references/web-estilo-css.md`.
