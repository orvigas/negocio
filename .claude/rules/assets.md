# Assets

---

paths:

- "/restaurante/landing-pages/public/css"
- "/restaurante/landing-pages/public/js"
- "/restaurante/landing-pages/public/img"
- "/restaurante/inventory-manager/public/css"
- "/restaurante/inventory-manager/public/js"

---

Antes de agregar un nuevo asset:

1. Busca primero en el `public/` de la app correspondiente (`restaurante/landing-pages/public` o `restaurante/inventory-manager/public`) y después en el de la otra app: `inventory-manager` reutiliza los iconos de `restaurante/landing-pages/public/img` en lugar de copiarlos.
2. Reutiliza un asset existente cuando sea apropiado.
3. Evita duplicaciones innecesarias.
4. Conserva las convenciones de nomenclatura existentes.

No incrustes assets binarios grandes directamente en HTML o JavaScript a menos que se requiera explícitamente.
