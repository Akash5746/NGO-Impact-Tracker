# NGO Impact Tracker

Simple two-tier app for collecting NGO monthly reports (single or CSV bulk) with a lightweight dashboard.

### Backend
```
cd backend
npm install
npm run dev               # starts on http://localhost:4000
```

### Frontend
```powershell
cd frontend
npm install
npm run dev               # starts on http://localhost:5173
```

## API
- `POST /report` – JSON body `{ ngoId, month:"YYYY-MM", peopleHelped, eventsConducted, fundsUtilized }`
- `POST /reports/upload` – `multipart/form-data` with `file` (CSV). Returns `{ jobId }` immediately.
- `GET /job-status/{jobId}` – Returns job status and row-level errors.
- `GET /dashboard?month=YYYY-MM` – Aggregated counts for the month.

CSV headers accepted: `ngo_id, month, people_helped, events_conducted, funds_utilized` (case/spacing tolerant). Rows are validated; invalid rows are reported in the job status without blocking other rows.
