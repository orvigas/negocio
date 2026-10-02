# Manejo de errores

Implementa manejo centralizado de errores.

Los errores internos no deben exponerse directamente al cliente.

Las respuestas de error deben ser:

- consistentes
- predecibles
- útiles para el cliente
- seguras

Ejemplo:

{
"error": {
"code": "USER_NOT_FOUND",
"message": "User not found"
}
}

No devuelvas:

- stack traces en producción
- SQL queries
- credenciales
- variables de entorno
- información interna de infraestructura

Registra detalles suficientes en el servidor para diagnosticar el problema.
