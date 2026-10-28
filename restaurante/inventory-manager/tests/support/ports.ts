import { createServer } from 'node:net';

/** URL de un puerto libre en 127.0.0.1 donde no escucha nadie (una API caída). */
export function freePortUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(`http://127.0.0.1:${address.port}`) : reject(new Error('Sin puerto'))));
    });
  });
}
