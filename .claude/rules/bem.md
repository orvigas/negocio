## BEM

Utiliza BEM para la nomenclatura de clases orientada a componentes.

Formato:

- ".block"
- ".block\_\_element"
- ".block--modifier"
- ".block\_\_element--modifier"

Ejemplo:

```html
<section class="card card--featured">
  <h2 class="card__title">...</h2>
  <p class="card__description">...</p>
  <button class="card__action">...</button>
</section>
```

No crees nombres de clases excesivamente anidados o ambiguos.

Evita selectores que dependan excesivamente de la estructura del DOM.
