# Git

Respeta las convenciones Git existentes.

Antes de modificar código:

- revisa el estado del repositorio
- comprende los cambios existentes
- evita sobrescribir trabajo ajeno
- No agregues referencias a Claude o Anthropic en los commits

No elimines cambios realizados por otros agentes o desarrolladores.

No hagas commits automáticamente salvo que las instrucciones del proyecto lo permitan explícitamente.

## Rama de destino de los Pull Requests

- Todo PR va a `main` (`gh pr create --base main`), salvo las excepciones de abajo.
- Si una épica futura necesita una rama intermedia, la define el usuario en su ticket.

### Rama intermedia de la épica de inventario (`epic/inventario`)

Excepción a la regla general, decidida por el usuario en REQ-F-049 (D-4, PV-12 y DT-4) y ampliada en REQ-F-051 (P-3):

- Los PR de los tickets de la épica de inventario (REQ-F-049 a REQ-F-053 y sus seguimientos, como REQ-F-054) van a `epic/inventario` (`gh pr create --base epic/inventario`) hasta que T1 a T3 sean utilizables. La rama de trabajo de cada PR sale de la punta de `epic/inventario`.
- El CI valida esos PR igual que uno hacia `main`, sin las pruebas de humo del despliegue y de los respaldos, y sin publicar ni desplegar. No se hace push directo a `epic/inventario`: todo entra por PR.
- Tras cada cambio a `main`, se integra `main` en la épica con un PR de `main` hacia `epic/inventario` (`gh pr create --base epic/inventario --head main`), mergeado con merge commit (nunca squash). Si hay conflictos, se resuelven en una rama aparte que sale de la épica.
- La épica llega a `main` con un PR de `epic/inventario` hacia `main` cuando T1 a T3 se puedan usar. Ese PR corre el CI completo.
- Después de ese merge, T4 y T5 van directo a `main`, la rama se borra y se quita de `on.pull_request` en `.github/workflows/ci.yml`.

## Pull Requests en borrador

- El CI no corre las validaciones (`calidad`, `docker` y `auditoria`) en un PR en borrador: quedan omitidas (*skipped*) y corren completas al marcarlo como listo.
- Si vas a subir varios commits a un PR antes de necesitar el CI, ábrelo como borrador (`gh pr create --draft`) y márcalo como listo (`gh pr ready <número>`) después del último push. Así no se gasta una ejecución completa por cada commit intermedio.
- Las comprobaciones omitidas de un PR en borrador **no** cuentan como superadas: solo vale el CI que corre con el PR listo.
- Marca el PR como listo solo cuando haya terminado la ejecución del último commit, nunca en el mismo comando que un `git push` (`git push && gh pr ready`): la ejecución de `ready_for_review` se cancela y la del commit omite las validaciones (REQ-F-044, #134). Tras `gh pr ready` no subas más commits hasta que termine el CI.
- Antes de dar un PR por listo para mergear, comprueba con `gh pr checks` que `calidad`, `docker`, `auditoria` y `pruebas` están en `pass`, no en `skipping`. GitHub deja mergear un PR con comprobaciones omitidas, y un PR que solo toca `.claude/` o documentación no lanza las validaciones.
