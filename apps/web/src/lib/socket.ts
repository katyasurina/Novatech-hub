import { io, type Socket } from 'socket.io-client';
import type { ReviewDto } from '@novatech/shared';
import { useAuthStore } from '../stores/auth';

/**
 * Single shared Socket.io connection. The access token is attached at connect
 * time so the server can resolve viewable/voting state the same way HTTP does;
 * we reconnect (with a fresh token) when the session changes.
 */

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '/';

let socket: Socket | null = null;
let tokenAtConnect: string | null = null;

export function getSocket(): Socket {
  const token = useAuthStore.getState().accessToken;
  if (!socket || tokenAtConnect !== token) {
    socket?.disconnect();
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: token ? { token } : undefined,
    });
    tokenAtConnect = token;
  }
  return socket;
}

/** Join the room for a product page so `review:created` events reach us. */
export function joinProductRoom(productId: string): void {
  getSocket().emit('product:join', productId);
}

export function leaveProductRoom(productId: string): void {
  getSocket().emit('product:leave', productId);
}

/** Register a one-shot listener for a pushed review. Returns an unsubscribe. */
export function onReviewCreated(listener: (review: ReviewDto) => void): () => void {
  const handler = (review: ReviewDto) => listener(review);
  getSocket().on('review:created', handler);
  return () => getSocket().off('review:created', handler);
}