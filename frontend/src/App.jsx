import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const initialForm = {
  ngoId: "",
  month: "",
  peopleHelped: "",
  eventsConducted: "",
  fundsUtilized: "",
};

function useJobPolling(jobId) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!jobId) return undefined;
    let isCancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/job-status/${jobId}`);
        if (!res.ok) throw new Error("Failed to fetch job status");
        const data = await res.json();
        if (!isCancelled) setStatus(data);
        if (["pending", "processing"].includes(data.status)) {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        if (!isCancelled) setStatus({ status: "failed", message: err.message });
      }
    };
    poll();
    return () => {
      isCancelled = true;
    };
  }, [jobId]);
  return status;
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [singleMessage, setSingleMessage] = useState("");
  const [loadingSingle, setLoadingSingle] = useState(false);

  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState("");
  const jobStatus = useJobPolling(jobId);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const [dashboardMonth, setDashboardMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardMessage, setDashboardMessage] = useState("");

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    setLoadingSingle(true);
    setSingleMessage("");
    try {
      const res = await fetch(`${API_BASE}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ngoId: form.ngoId.trim(),
          month: form.month,
          peopleHelped: Number(form.peopleHelped || 0),
          eventsConducted: Number(form.eventsConducted || 0),
          fundsUtilized: Number(form.fundsUtilized || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      setSingleMessage("Saved");
      setForm(initialForm);
    } catch (err) {
      setSingleMessage(err.message);
    } finally {
      setLoadingSingle(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadMessage("Please select a CSV file");
      return;
    }
    setUploading(true);
    setUploadMessage("");
    setJobId("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/reports/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setJobId(data.jobId);
      setUploadMessage("Upload accepted. Tracking job...");
    } catch (err) {
      setUploadMessage(err.message);
    } finally {
      setUploading(false);
    }
  };

  const fetchDashboard = async () => {
    if (!dashboardMonth) return;
    setDashboardMessage("");
    try {
      const res = await fetch(`${API_BASE}/dashboard?month=${dashboardMonth}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load dashboard");
      setDashboardData(data);
    } catch (err) {
      setDashboardMessage(err.message);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const jobSummary = useMemo(() => {
    if (!jobStatus) return null;
    if (jobStatus.status === "failed")
      return { label: "Job failed", color: "#d72c16" };
    if (jobStatus.status === "completed")
      return { label: "Completed", color: "#0f8a5f" };
    return { label: "Processing", color: "#f0a202" };
  }, [jobStatus]);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <div className="logo">
            <a className="logo-link" href="/">
              <div className="logo-badge">
                <span className="logo-badge-text">NGO</span>
              </div>
              <span className="logo-word">Impact Tracker</span>
            </a>
          </div>
          <h1>Capture impact, even at scale.</h1>
          <p className="lede">
            Submit monthly reports, upload CSVs for bulk intake, and keep admins
            aligned with a live dashboard.
          </p>
        </div>
      </header>

      <section className="grid">
        <div className="card">
          <div className="card-header">
            <h2>Report Submission</h2>
            <p>Quickly log a single NGO monthly report.</p>
          </div>
          <form className="form" onSubmit={handleSubmitSingle}>
            <label>
              NGO ID
              <input
                name="ngoId"
                value={form.ngoId}
                onChange={handleFormChange}
                required
              />
            </label>
            <label>
              Month (YYYY-MM)
              <input
                name="month"
                value={form.month}
                onChange={handleFormChange}
                placeholder="2025-01"
                required
              />
            </label>
            <div className="inline">
              <label>
                People Helped
                <input
                  type="number"
                  min="0"
                  name="peopleHelped"
                  value={form.peopleHelped}
                  onChange={handleFormChange}
                />
              </label>
              <label>
                Events Conducted
                <input
                  type="number"
                  min="0"
                  name="eventsConducted"
                  value={form.eventsConducted}
                  onChange={handleFormChange}
                />
              </label>
            </div>
            <label>
              Funds Utilized
              <input
                type="number"
                min="0"
                step="0.01"
                name="fundsUtilized"
                value={form.fundsUtilized}
                onChange={handleFormChange}
              />
            </label>
            <button type="submit" disabled={loadingSingle}>
              {loadingSingle ? "Submitting..." : "Submit report"}
            </button>
            {singleMessage && <p className="hint">{singleMessage}</p>}
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Bulk CSV Upload</h2>
            <p>Upload multiple rows; processing happens in the background.</p>
          </div>
          <form className="form" onSubmit={handleUpload}>
            <label className="file-input">
              <span>Select CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload and process"}
            </button>
            {uploadMessage && <p className="hint">{uploadMessage}</p>}
          </form>

          {jobStatus && (
            <div className="job">
              <div className="job-row">
                <span
                  className="badge"
                  style={{ background: jobSummary?.color }}
                >
                  {jobSummary?.label}
                </span>
                <span className="mono">Job ID: {jobStatus.id || jobId}</span>
              </div>
              <div className="progress">
                <div
                  className="progress-bar"
                  style={{
                    width: jobStatus.totalRows
                      ? `${Math.round(
                          (jobStatus.processedRows / jobStatus.totalRows) * 100
                        )}%`
                      : "0%",
                  }}
                />
              </div>
              <div className="job-stats">
                <span>Processed: {jobStatus.processedRows ?? 0}</span>
                <span>Success: {jobStatus.successCount ?? 0}</span>
                <span>Failed: {jobStatus.failureCount ?? 0}</span>
              </div>
              {Array.isArray(jobStatus.errors) &&
                jobStatus.errors.length > 0 && (
                  <details>
                    <summary>
                      View row errors ({jobStatus.errors.length})
                    </summary>
                    <ul className="errors">
                      {jobStatus.errors.map((err, idx) => (
                        <li key={`${err.row}-${idx}`}>
                          Row {err.row}: {err.errors?.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Admin Dashboard</h2>
            <p>Select a month to view aggregate impact.</p>
          </div>
          <div className="inline">
            <input
              type="month"
              value={dashboardMonth}
              onChange={(e) => setDashboardMonth(e.target.value)}
            />
            <button type="button" onClick={fetchDashboard}>
              Refresh
            </button>
          </div>
        </div>
        {dashboardMessage && <p className="hint">{dashboardMessage}</p>}
        {dashboardData && (
          <div className="stats">
            <div className="stat">
              <p className="label">Total NGOs Reporting</p>
              <p className="value">{dashboardData.totalNgosReporting}</p>
            </div>
            <div className="stat">
              <p className="label">People Helped</p>
              <p className="value">{dashboardData.totalPeopleHelped}</p>
            </div>
            <div className="stat">
              <p className="label">Events Conducted</p>
              <p className="value">{dashboardData.totalEventsConducted}</p>
            </div>
            <div className="stat">
              <p className="label">Funds Utilized</p>
              <p className="value">
                ₹
                {Number(dashboardData.totalFundsUtilized || 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
