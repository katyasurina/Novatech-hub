import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { ReviewDto } from '@novatech/shared';

/**
 * Tiny realtime layer: product pages join a room and receive pushed
 * `review:created` events (e.g. another user reviewing the product they're
 * looking at). Rooms are auto-pruned by socket.io, so no manual cleanup.
 */

let io: Server | null = null;

function room(productId: string): string {
  return `product:${productId}`;
}

export function initRealtime(httpServer: HttpServer, webOrigin: string): Server {
  io = new Server(httpServer, {
    cors: { origin: webOrigin, credentials: true },
    transports: ['websocket', 'polling'],
    // In dev the web origin differs from the API origin; in prod they are the
    // same, and the origin check above is what permits connections.
  });

  io.on('connection', (socket: Socket) => {
    socket.on('product:join', (productId: unknown) => {
      if (typeof productId === 'string') socket.join(room(productId));
    });
    socket.on('product:leave', (productId: unknown) => {
      if (typeof productId === 'string') socket.leave(room(productId));
    });
  });

  return io;
}

export function getIo(): Server | null {
  return io;
}

/** Push a newly-created review to everyone viewing that product page. */
export function emitReviewCreated(productId: string, review: ReviewDto): void {
  io?.to(room(productId)).emit('review:created', review);
}

export function closeRealtime(): Promise<void> {
  if (!io) return Promise.resolve();
  return new Promise((resolve) => io!.close(() => resolve()));
}