import { Router } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { supabase } from '../lib/supabase.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

// POST /api/sessions/:id/recording — 오디오 + 타임라인 저장
router.post('/sessions/:id/recording', upload.single('audio'), async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
  });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  let audioUrl: string | undefined;
  if (req.file) {
    const path = `audio/${req.params.id}.webm`;
    const { error } = await supabase.storage
      .from('slides')
      .upload(path, req.file.buffer, { contentType: 'audio/webm', upsert: true });
    if (!error) {
      ({ data: { publicUrl: audioUrl } } = supabase.storage.from('slides').getPublicUrl(path));
    }
  }

  const body = req.body as { timeline?: string };
  // 타임라인 JSON (TimelineEvent[]) — Prisma Json 필드용 캐스팅 (머지 빌드 수정)
  const timeline = (
    body.timeline ? JSON.parse(body.timeline) : []
  ) as Prisma.InputJsonValue;

  const recording = await prisma.recording.upsert({
    where: { sessionId: req.params.id },
    create: { sessionId: req.params.id, audioUrl, timeline },
    update: { audioUrl, timeline },
  });
  await prisma.session.update({
    where: { id: req.params.id },
    data: { status: 'FINISHED', endedAt: new Date() },
  });
  res.json(recording);
});

// GET /api/recordings/:id — 리플레이 데이터
router.get('/recordings/:id', async (req, res) => {
  const recording = await prisma.recording.findUnique({
    where: { id: req.params.id },
    include: {
      session: {
        include: {
          presentation: { select: { title: true, images: true } },
        },
      },
    },
  });
  if (!recording) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(recording);
});

export default router;
