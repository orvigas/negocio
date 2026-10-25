# Git

Respeta las convenciones Git existentes.

Antes de modificar código:

- revisa el estado del repositorio
- comprende los cambios existentes
- evita sobrescribir trabajo ajeno
- No agregues referencias a Claude o Anthropic en los commits

No elimines cambios realizados por otros agentes o desarrolladores.

No hagas commits automáticamente salvo que las instrucciones del proyecto lo permitan explícitamente.

## Rama intermedia `epic/arquitectura`

- Los PR de los pasos del plan de migración (`restaurante/docs/arquitectura.md` §8) van a `epic/arquitectura` (`gh pr create --base epic/arquitectura`), no a `main`. Para esos tickets, esta regla prevalece sobre el "PR siempre a `main`" de `.claude/agents/senior-fullstack.md`.
- Siguen yendo a `main`: las correcciones urgentes de producción, los cierres de documentación de otros tickets y los cambios ajenos a la épica.
- Un PR hacia `epic/arquitectura` corre las mismas validaciones del CI (`calidad`, `docker`, `despliegue` y `auditoria`), pero su merge no publica ni despliega nada.
- Tras cada cambio que llegue directo a `main`, se integra `main` en `epic/arquitectura` con un PR de `main` hacia `epic/arquitectura` (así el CI valida la combinación) antes de seguir con la épica.
- La épica llega a `main` con un PR de `epic/arquitectura` hacia `main` cuando esté madura; ese PR corre su propio CI y, al mergearlo, se publica y se despliega como cualquier PR hacia `main`.
