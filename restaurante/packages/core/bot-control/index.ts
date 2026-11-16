// Control del bot de WhatsApp: bloqueos, pausa y uso (store y su versión en memoria), el estado
// compartido entre el bot y la página "Bot" de /admin, los contadores, los umbrales, su configuración
// y los números de teléfono (REQ-F-025; en core desde REQ-F-042, H-4).
// Lo único que se importa desde fuera del módulo (REQ-F-037, restaurante/docs/arquitectura.md §4).
export * from './bot-config.ts';
export * from './bot-control.ts';
export * from './bot-control-store.ts';
export * from './bot-usage.ts';
export * from './limits.ts';
export * from './memory-bot-control-store.ts';
export * from './phone.ts';
