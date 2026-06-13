/**
 * SyncSlide 백엔드 엔트리포인트 — Express + Socket.io
 *
 * REST API(인증/PDF/세션/리코딩)는 Dev B가 src/routes/* 에 추가.
 * 실시간 Socket 핸들러는 Dev A가 src/socket/* 에서 관리.
 */
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@syncslide/shared';
import { registerSocketHandlers } from './socket/index.js';

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'syncslide-server' });
});

// TODO(Dev B): app.use('/api/auth', authRouter) 등 REST 라우터 마운트

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`[syncslide-server] listening on http://localhost:${PORT}`);
});
