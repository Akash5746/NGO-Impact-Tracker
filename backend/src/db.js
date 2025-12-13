import Datastore from 'nedb-promises';
import fs from 'fs';
import path from 'path';

let reportsDb;
let jobsDb;

export function initDb(databaseUrl) {
  const baseDir = databaseUrl.endsWith('.db') ? path.dirname(databaseUrl) : databaseUrl;
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  reportsDb = Datastore.create({ filename: path.join(baseDir, 'reports.db'), autoload: true });
  jobsDb = Datastore.create({ filename: path.join(baseDir, 'jobs.db'), autoload: true });
  reportsDb.ensureIndex({ fieldName: 'ngo_month', unique: true });
  jobsDb.ensureIndex({ fieldName: 'id', unique: true });
}

export async function upsertReport(report) {
  await reportsDb.update(
    { ngo_month: `${report.ngo_id}:${report.month}` },
    { ...report, ngo_month: `${report.ngo_id}:${report.month}` },
    { upsert: true }
  );
}

export async function insertJob(job) {
  await jobsDb.insert(job);
}

export async function updateJobTotals(jobId, totalRows) {
  await jobsDb.update({ id: jobId }, { $set: { total_rows: totalRows, updated_at: new Date().toISOString() } });
}

export async function updateJobProgress(jobId, progress) {
  await jobsDb.update(
    { id: jobId },
    {
      $set: {
        processed_rows: progress.processed_rows,
        success_count: progress.success_count,
        failure_count: progress.failure_count,
        error_messages: progress.error_messages,
        updated_at: new Date().toISOString(),
      },
    }
  );
}

export async function markJobProcessing(jobId) {
  await jobsDb.update({ id: jobId }, { $set: { status: 'processing', updated_at: new Date().toISOString() } });
}

export async function completeJob(jobId) {
  await jobsDb.update({ id: jobId }, { $set: { status: 'completed', updated_at: new Date().toISOString() } });
}

export async function failJob(jobId, message) {
  await jobsDb.update(
    { id: jobId },
    { $set: { status: 'failed', error_messages: JSON.stringify([message]), updated_at: new Date().toISOString() } }
  );
}

export async function getJob(jobId) {
  return jobsDb.findOne({ id: jobId });
}

export async function getDashboard(month) {
  const reports = await reportsDb.find({ month });
  const aggregate = reports.reduce(
    (acc, r) => {
      acc.totalNgos.add(r.ngo_id);
      acc.totalPeopleHelped += Number(r.people_helped || 0);
      acc.totalEventsConducted += Number(r.events_conducted || 0);
      acc.totalFundsUtilized += Number(r.funds_utilized || 0);
      return acc;
    },
    { totalNgos: new Set(), totalPeopleHelped: 0, totalEventsConducted: 0, totalFundsUtilized: 0 }
  );
  return {
    totalNgosReporting: aggregate.totalNgos.size,
    totalPeopleHelped: aggregate.totalPeopleHelped,
    totalEventsConducted: aggregate.totalEventsConducted,
    totalFundsUtilized: aggregate.totalFundsUtilized,
  };
}

export function closeDb() {
  // nedb-promises handles persistence automatically; nothing to close.
}
