/**
 * Red de seguridad de REQ-F-009 (RF-11.1, CA-24) y REQ-F-012 (RF-8.1): ninguna prueba llama a Meta
 * ni a Twilio. Si algún código intentara usar el `fetch` global contra la Graph API o la API de
 * Twilio, la prueba falla en lugar de salir a internet. Las demás peticiones (p. ej. al servidor
 * local de las pruebas de arranque) no cambian.
 */
const realFetch = globalThis.fetch;

const BLOCKED = [
  { domain: 'facebook.com', provider: 'Meta', double: 'tests/support/cloud-api-double.ts' },
  { domain: 'twilio.com', provider: 'Twilio', double: 'tests/support/twilio-api-double.ts' },
] as const;

globalThis.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = input instanceof Request ? input.url : String(input);
  const { hostname } = new URL(url);
  const blocked = BLOCKED.find(({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`));
  if (blocked) {
    return Promise.reject(new Error(`Una prueba intentó llamar a ${blocked.provider} (${hostname}): usa el doble de ${blocked.double}`));
  }
  return realFetch(input, init);
};
