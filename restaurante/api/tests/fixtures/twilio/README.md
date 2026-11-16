# Entregas de ejemplo del webhook de Twilio para WhatsApp (REQ-F-012)

Parámetros del formulario `application/x-www-form-urlencoded` que Twilio envía al webhook, con la
forma de su documentación ("Messaging webhooks" y "Track the message status of outbound
messages"): mensaje de texto, imagen, ubicación (sin `Body`) y `StatusCallback` (`delivered`,
`failed` y `undelivered`). Números, SID y cuenta son ficticios (la cuenta y el número del bot
coinciden con `TWILIO_BOT_ENV` de `tests/helpers.ts`; el número es el del sandbox).
Los usa `tests/support/twilio.ts` para construir y firmar las entregas de las pruebas.
