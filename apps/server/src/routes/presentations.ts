import { Router } from 'express';
import multer from 'multer';
import { pdf } from 'pdf-to-img';
import sharp from 'sharp';
import { prisma } from '../lib/prisma.js';
import { supabase } from '../lib/supabase.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  },
});

router.get('/', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const list = await prisma.presentation.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(list);
});

router.get('/:id', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const p = await prisma.presentation.findFirst({
    where: { id: req.params.id, ownerId: userId },
    include: {
      sessions: {
        orderBy: { createdAt: 'desc' },
        include: {
          recording: { select: { id: true, audioUrl: true } },
          questions: { orderBy: { createdAt: 'asc' as const } },
        },
      },
    },
  });
  if (!p) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(p);
});

// PATCH /api/presentations/:id/scripts — 페이지별 스크립트 저장
router.patch('/:id/scripts', requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const body = req.body as { scripts?: string[] };
  if (!Array.isArray(body.scripts)) {
    res.status(400).json({ error: 'scripts 배열이 필요합니다' });
    return;
  }
  const p = await prisma.presentation.findFirst({
    where: { id: req.params.id, ownerId: userId },
  });
  if (!p) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = await prisma.presentation.update({
    where: { id: req.params.id },
    data: { scripts: body.scripts },
  });
  res.json({ ok: true, scripts: updated.scripts });
});

router.post('/', requireAuth, upload.single('pdf'), async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  if (!req.file) { res.status(400).json({ error: 'pdf 파일이 필요합니다' }); return; }

  const title = ((req.body as { title?: string }).title) || req.file.originalname.replace(/\.pdf$/i, '');
  const pdfPath = `pdfs/${userId}/${Date.now()}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from('slides')
    .upload(pdfPath, req.file.buffer, { contentType: 'application/pdf' });

  if (uploadErr) { res.status(500).json({ error: 'PDF 업로드 실패' }); return; }

  const { data: { publicUrl: pdfUrl } } = supabase.storage.from('slides').getPublicUrl(pdfPath);

  const presentation = await prisma.presentation.create({
    data: { title, ownerId: userId, pdfUrl, images: [], status: 'PROCESSING' },
  });
  res.json(presentation);

  convertPdf(req.file.buffer, presentation.id, userId).catch(async (err) => {
    console.error('[pdf-convert] 실패', err);
    await prisma.presentation.update({
      where: { id: presentation.id },
      data: { status: 'FAILED' },
    });
  });
});

async function convertPdf(buffer: Buffer, presentationId: string, userId: string): Promise<void> {
  const images: string[] = [];
  let pageNum = 1;

  for await (const pageBuffer of await pdf(buffer, { scale: 2 })) {
    const webp = await sharp(pageBuffer).resize({ width: 1920 }).webp({ quality: 85 }).toBuffer();
    const path = `slides/${userId}/${presentationId}/page-${pageNum}.webp`;
    await supabase.storage.from('slides').upload(path, webp, { contentType: 'image/webp', upsert: true });
    const { data: { publicUrl } } = supabase.storage.from('slides').getPublicUrl(path);
    images.push(publicUrl);
    pageNum++;
  }

  await prisma.presentation.update({
    where: { id: presentationId },
    data: { images, status: 'READY' },
  });
}

export default router;
