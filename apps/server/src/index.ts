import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@syncslide/shared';
import { registerSocketHandlers } from './socket/index.js';
import authRouter from './routes/auth.js';
import presentationsRouter from './routes/presentations.js';
import sessionsRouter from './routes/sessions.js';
import recordingsRouter from './routes/recordings.js';

// 라우트(DB/스토리지)에서 발생한 비동기 오류로 소켓 서버 전체가 죽지 않도록 가드.
// (MVP: DB 미연결 환경에서도 실시간 동기화는 계속 동작해야 함 — PRD §21)
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'syncslide-server' });
});

app.use('/api/auth', authRouter);
app.use('/api/presentations', presentationsRouter);
app.use('/api', sessionsRouter);
app.use('/api', recordingsRouter);

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`[syncslide-server] listening on http://localhost:${PORT}`);
});
