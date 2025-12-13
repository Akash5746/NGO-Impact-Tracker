import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { nanoid } from 'nanoid';
import { upsertReport, insertJob, updateJobProgress, updateJobTotals, markJobProcessing, completeJob, failJob } from './db.js';

function normalizeRow(row) {
  const ngoId = row.ngo_id || row.NGO_ID || row.ngoId || row['NGO ID'] || '';
  const monthRaw = row.month || row.Month || row.MONTH || row['Month '] || '';
  const peopleHelped = row.people_helped || row.peopleHelped || row.People_Helped || row['People Helped'] || row['People Helped '];
  const eventsConducted = row.events_conducted || row.eventsConducted || row.Events_Conducted || row['Events Conducted'];
  const fundsUtilized = row.funds_utilized || row.fundsUtilized || row.Funds_Utilized || row['Funds Utilized'];

  return { ngoId, monthRaw, peopleHelped, eventsConducted, fundsUtilized };
}

function validateRow({ ngoId, monthRaw, peopleHelped, eventsConducted, fundsUtilized }) {
  const errors = [];
  if (!ngoId) errors.push('Missing NGO ID');
  if (!monthRaw) errors.push('Missing month');
  const month = monthRaw?.toString().trim();
  const monthPattern = /^\d{4}-\d{2}$/;
  if (!monthPattern.test(month || '')) errors.push('Month must be YYYY-MM');
  const people = Number(peopleHelped || 0);
  const events = Number(eventsConducted || 0);
  const funds = Number(fundsUtilized || 0);
  if (Number.isNaN(people) || people < 0) errors.push('people_helped must be a non-negative number');
  if (Number.isNaN(events) || events < 0) errors.push('events_conducted must be a non-negative number');
  if (Number.isNaN(funds) || funds < 0) errors.push('funds_utilized must be a non-negative number');
  return { isValid: errors.length === 0, errors, month, people, events, funds };
}

async function processJob(jobId, filePath, fileName) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const rows = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
    const totalRows = rows.length;
    let processedRows = 0;
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    for (const row of rows) {
      const normalized = normalizeRow(row);
      const { isValid, errors: rowErrors, month, people, events, funds } = validateRow(normalized);
      if (!isValid) {
        failureCount += 1;
        errors.push({ row: processedRows + 1, errors: rowErrors });
      } else {
        try {
          await upsertReport({
            ngo_id: normalized.ngoId.trim(),
            month,
            people_helped: people,
            events_conducted: events,
            funds_utilized: funds,
          });
          successCount += 1;
        } catch (err) {
          failureCount += 1;
          errors.push({ row: processedRows + 1, errors: ['DB error'] });
        }
      }
      processedRows += 1;
      await updateJobProgress(jobId, {
        processed_rows: processedRows,
        success_count: successCount,
        failure_count: failureCount,
        error_messages: JSON.stringify(errors),
      });
    }

    await completeJob(jobId);
    await fs.unlink(filePath).catch(() => {});
  } catch (err) {
    await failJob(jobId, err.message || 'Processing failed');
    await fs.unlink(filePath).catch(() => {});
  }
}

export async function enqueueJob(uploadDir, file) {
  const jobId = nanoid();
  await insertJob({
    id: jobId,
    status: 'pending',
    file_name: file.originalname,
    total_rows: 0,
    processed_rows: 0,
    success_count: 0,
    failure_count: 0,
    error_messages: '[]',
  });

  // Kick off background processing after the response returns
  setTimeout(async () => {
    try {
      const stats = await fs.stat(file.path);
      if (!stats.isFile()) throw new Error('Upload not found');
      const fileContent = await fs.readFile(file.path, 'utf-8');
      const rows = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
      const totalRows = rows.length;
      await updateJobTotals(jobId, totalRows);
      await updateJobProgress(jobId, { processed_rows: 0, success_count: 0, failure_count: 0, error_messages: '[]' });
      const tempPath = path.join(uploadDir, `${jobId}-${file.originalname}`);
      await fs.rename(file.path, tempPath);
      await markJobProcessing(jobId);
      // Process in next tick
      setImmediate(() => processJob(jobId, tempPath, file.originalname));
    } catch (err) {
      await failJob(jobId, err.message || 'Failed to start job');
    }
  }, 0);

  return jobId;
}
