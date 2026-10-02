import { describe, expect, it } from 'vitest';

import { buildWhatsAppLink, isHttpsUrl } from '../../src/services/whatsapp.js';

describe('buildWhatsAppLink', () => {
  it('da prioridad a la URL explícita sobre número y mensaje', () => {
    const link = buildWhatsAppLink({
      url: 'https://example.com/bot?id=1',
      phone: '5210000000001',
      message: 'hola',
    });
    expect(link).toBe('https://example.com/bot?id=1');
  });

  it('construye wa.me con el mensaje codificado', () => {
    const link = buildWhatsAppLink({ phone: '5210000000001', message: 'Hola, ¿1 & 2? #pedido' });
    expect(link).toBe(
      'https://wa.me/5210000000001?text=Hola%2C%20%C2%BF1%20%26%202%3F%20%23pedido',
    );
    expect(new URL(link).searchParams.get('text')).toBe('Hola, ¿1 & 2? #pedido');
  });

  it('omite text si no hay mensaje', () => {
    expect(buildWhatsAppLink({ phone: '5210000000001' })).toBe('https://wa.me/5210000000001');
  });

  it.each(['http://example.com', 'javascript:alert(1)', 'ftp://example.com', 'example.com', 'https://user:pass@example.com'])(
    'rechaza URL no https o insegura: %s',
    (url) => {
      expect(isHttpsUrl(url)).toBe(false);
      expect(() => buildWhatsAppLink({ url })).toThrow(TypeError);
    },
  );

  it.each(['+5210000000001', '52 1000 0000', '123', 'abc', undefined])('rechaza número inválido: %s', (phone) => {
    expect(() => buildWhatsAppLink({ phone })).toThrow(TypeError);
  });

  it('rechaza mensajes demasiado largos', () => {
    expect(() => buildWhatsAppLink({ phone: '5210000000001', message: 'x'.repeat(501) })).toThrow(TypeError);
  });
});
