/**
 * Red de seguridad de REQ-F-009 (RF-11.1, CA-24): ninguna prueba llama a Meta. Si algún código
 * intentara usar el `fetch` global contra la Graph API, la prueba falla en lugar de salir a
 * internet. Las demás peticiones (p. ej. al servidor local de las pruebas de arranque) no cambian.
 */
const realFetch = globalThis.fetch;

globalThis.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = input instanceof Request ? input.url : String(input);
  if (new URL(url).hostname.endsWith('facebook.com')) {
    return Promise.reject(new Error(`Una prueba intentó llamar a Meta (${new URL(url).hostname}): usa el doble de tests/support/cloud-api-double.ts`));
  }
  return realFetch(input, init);
};
