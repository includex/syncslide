'use client';

/**
 * Socket.io 클라이언트 팩토리 — 타입은 @syncslide/shared 계약을 따른다.
 * 발표자/디스플레이/청중 페이지가 공통으로 사용.
 */
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@syncslide/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

export function createSocket(): AppSocket {
  return io(SERVER_URL, {
    autoConnect: true,
    transports: ['websocket'],
  });
}
