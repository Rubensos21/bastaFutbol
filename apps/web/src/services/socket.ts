import { io, type Socket } from 'socket.io-client';
import type { Ack, Command, Snapshot } from '@basta/shared';
let socket: Socket | undefined;
export function gameSocket() {
  return (socket ??= io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
    autoConnect: false,
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 800,
    timeout: 10000,
  }));
}
export async function bootstrap() {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/session`, {
    credentials: 'include',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('El servidor no está disponible.');
  return (await response.json()) as { id: string; expiresAt: string };
}
export function command(c: Command): Promise<Ack> {
  return new Promise((resolve) => {
    const s = gameSocket();
    if (!s.connected) {
      resolve({
        ok: false,
        error: {
          code: 'OFFLINE',
          message: 'Sin conexión. Conservamos tu borrador en este dispositivo.',
        },
      });
      return;
    }
    s.timeout(10000).emit('command', c, (error: Error | null, ack: Ack<Snapshot>) =>
      resolve(
        error
          ? {
              ok: false,
              error: {
                code: 'ACK_TIMEOUT',
                message: 'No llegó la confirmación. Reintenta con el mismo identificador.',
              },
            }
          : ack,
      ),
    );
  });
}
