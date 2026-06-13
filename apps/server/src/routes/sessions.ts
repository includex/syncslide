import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/presentations/:id/sessions — 세션 생성 (발표자만)
router.post('/presentations/:id/sessions', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const p = await prisma.presentation.findFirst({
    where: { id: req.params.id, ownerId: userId, status: 'READY' },
  });
  if (!p) {
    res.status(404).json({ error: '발표 자료를 찾을 수 없거나 변환이 완료되지 않았습니다' });
    return;
  }
  const session = await prisma.session.create({ data: { presentationId: p.id } });
  res.json(session);
});

// GET /api/sessions/:id — 공개 (디스플레이·청중 화면이 슬라이드 이미지 가져올 때)
router.get('/sessions/:id', async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
    include: {
      presentation: { select: { title: true, images: true } },
      questions: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!session) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(session);
});

export default router;
