# NGO Impact Tracker

Simple two-tier app for collecting NGO monthly reports (single or CSV bulk) with a lightweight dashboard. Backend is Express + SQLite; frontend is Vite + React.

## Stack
- Backend: Node.js, Express, Multer, csv-parse, nedb-promises (file-backed)
- Frontend: React (Vite)
- Storage: SQLite (file-based)
- Background CSV processing: in-process worker with per-row progress + partial failure tracking

## Quickstart

### Backend
```powershell
cd backend
npm install
copy .env.example .env   # adjust ALLOWED_ORIGIN / PORT if needed
npm run dev               # starts on http://localhost:4000
```

### Frontend
```powershell
cd frontend
npm install
# optional: set API base
$env:VITE_API_URL="http://localhost:4000"
npm run dev               # starts on http://localhost:5173
```

## API
- `POST /report` – JSON body `{ ngoId, month:"YYYY-MM", peopleHelped, eventsConducted, fundsUtilized }`
- `POST /reports/upload` – `multipart/form-data` with `file` (CSV). Returns `{ jobId }` immediately.
- `GET /job-status/{jobId}` – Returns job status and row-level errors.
- `GET /dashboard?month=YYYY-MM` – Aggregated counts for the month.

CSV headers accepted: `ngo_id, month, people_helped, events_conducted, funds_utilized` (case/spacing tolerant). Rows are validated; invalid rows are reported in the job status without blocking other rows.

### Sample cURL
```bash
curl -X POST http://localhost:4000/report \
  -H "Content-Type: application/json" \
  -d '{"ngoId":"NGO-42","month":"2025-01","peopleHelped":120,"eventsConducted":3,"fundsUtilized":54000}'

curl -F "file=@reports.csv" http://localhost:4000/reports/upload
curl http://localhost:4000/job-status/<jobId>
curl "http://localhost:4000/dashboard?month=2025-01"
```

## Notes on behavior
- Idempotency: `(ngo_id, month)` is unique; new submissions overwrite existing row for that pair.
- CSV uploads run asynchronously; job status includes `processedRows`, `successCount`, `failureCount`, and per-row errors.
- Partial failures are surfaced without aborting the job.

## What could be next
- Move background jobs to Redis-backed queue (e.g., BullMQ) + worker process.
- Auth for admin dashboard and rate limiting on write endpoints.
- Pagination and filters on dashboard; region support.
- Dockerization and CI/CD.

## AI usage
Built with GPT-5.1-Codex-Max (Preview) for scaffolding and wiring the API + UI.
