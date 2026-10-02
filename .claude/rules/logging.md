# Logging

Utiliza logging estructurado cuando el proyecto lo permita.

Los logs deben ayudar a diagnosticar:

- errores
- requests
- operaciones importantes
- tiempos de respuesta
- fallos de dependencias externas

Nunca registres:

- passwords
- tokens
- secrets
- datos sensibles innecesarios
- Performance

Minimiza:

- operaciones innecesarias
- consultas duplicadas
- N+1 queries
- llamadas externas innecesarias
- serialización excesiva
- uso innecesario de memoria
- procesamiento síncrono bloqueante

Prefiere APIs nativas de Node.js cuando sean suficientes.

Utiliza caching únicamente cuando exista una necesidad real y una estrategia clara de invalidación.
