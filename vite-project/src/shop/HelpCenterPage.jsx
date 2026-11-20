import { useCallback, useEffect, useState } from "react";
import API, { isSuccess } from "../api/client.js";
import "./HelpCenterPage.css";

const categories = ["Order", "Payment", "Return/Refund", "Product", "Account", "Other"];

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function HelpCenterPage() {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ subject: "", category: "Order", message: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRequests = useCallback(async () => {
    setError("");
    try {
      const response = await API.get("/profile/support");
      if (!isSuccess(response)) throw new Error(response.data?.message || "Could not load your requests.");
      setRequests(response.data.requests || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Could not load your requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function submitRequest(event) {
    event.preventDefault();
    setSubmitting(true); setError(""); setNotice("");
    try {
      const response = await API.post("/profile/support", form);
      if (!isSuccess(response)) throw new Error(response.data?.message || "Could not send your request.");
      setNotice(response.data.message || "Your request was sent.");
      setForm({ subject: "", category: "Order", message: "" });
      await loadRequests();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Could not send your request.");
    } finally { setSubmitting(false); }
  }

  return <main className="help-center">
    <header className="help-center__header"><p>YOUR ACCOUNT</p><h1>Help Center</h1><span>Tell us what went wrong and our team will review your message.</span></header>
    {error && <p className="help-center__notice is-error" role="alert">{error}</p>}
    {notice && <p className="help-center__notice is-success" role="status">{notice}</p>}
    <section className="help-center__card">
      <h2>Send us a message</h2>
      <form onSubmit={submitRequest} className="help-center__form">
        <label>Issue category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Subject<input required maxLength={120} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Briefly describe the issue" /></label>
        <label>Your message<textarea required maxLength={3000} rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Include any details that will help us understand the problem." /></label>
        <div className="help-center__form-footer"><small>{form.message.length}/3000 characters</small><button disabled={submitting}>{submitting ? "Sending…" : "Send message"}</button></div>
      </form>
    </section>
    <section className="help-center__card">
      <div className="help-center__list-heading"><div><h2>Your requests</h2><p>Check the latest status of messages you sent.</p></div><span>{requests.length} request{requests.length === 1 ? "" : "s"}</span></div>
      {loading ? <p>Loading your requests…</p> : requests.length === 0 ? <p className="help-center__empty">You haven’t sent a help request yet.</p> : <ul className="help-center__requests">{requests.map((request) => <li key={request._id}><div className="help-center__request-top"><div><strong>{request.subject}</strong><small>{request.category} · {formatDate(request.createdAt)}</small></div><span className={`help-center__status status-${request.status.toLowerCase().replaceAll(" ", "-")}`}>{request.status}</span></div><p>{request.message}</p>{request.adminResponse && (<div className="help-center__admin-reply"><strong>Support response:</strong><p>{request.adminResponse}</p>{request.resolvedAt && <small>Resolved on {formatDate(request.resolvedAt)}</small>}</div>)}</li>)}</ul>}
    </section>
  </main>;
}
