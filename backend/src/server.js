import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDb, upsertReport, getJob, getDashboard } from './db.js';
import { enqueueJob } from './jobQueue.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const DATABASE_URL = process.env.DATABASE_URL || './data';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

initDb(DATABASE_URL);

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN }));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.post('/report', async (req, res) => {
  const { ngoId, month, peopleHelped, eventsConducted, fundsUtilized } = req.body || {};
  if (!ngoId || !month) {
    return res.status(400).json({ message: 'ngoId and month are required' });
  }
  const monthPattern = /^\d{4}-\d{2}$/;
  if (!monthPattern.test(month)) {
    return res.status(400).json({ message: 'month must be YYYY-MM' });
  }
  const people = Number(peopleHelped || 0);
  const events = Number(eventsConducted || 0);
  const funds = Number(fundsUtilized || 0);
  if ([people, events, funds].some((n) => Number.isNaN(n) || n < 0)) {
    return res.status(400).json({ message: 'Numeric fields must be non-negative numbers' });
  }
  try {
    await upsertReport({
      ngo_id: ngoId.trim(),
      month,
      people_helped: people,
      events_conducted: events,
      funds_utilized: funds,
    });
    return res.status(201).json({ message: 'Report saved' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to save report' });
  }
});

app.post('/reports/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'CSV file is required' });
  }
  const jobId = await enqueueJob(UPLOAD_DIR, req.file);
  res.status(202).json({ jobId });
});

app.get('/job-status/:id', async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  const errors = (() => {
    try {
      return JSON.parse(job.error_messages || '[]');
    } catch (err) {
      return [];
    }
  })();
  res.json({
    id: job.id,
    status: job.status,
    fileName: job.file_name,
    totalRows: job.total_rows,
    processedRows: job.processed_rows,
    successCount: job.success_count,
    failureCount: job.failure_count,
    errors,
  });
});

app.get('/dashboard', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ message: 'month is required (YYYY-MM)' });
  const monthPattern = /^\d{4}-\d{2}$/;
  if (!monthPattern.test(month)) return res.status(400).json({ message: 'month must be YYYY-MM' });
  const data = await getDashboard(month);
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
