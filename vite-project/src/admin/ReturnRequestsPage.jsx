import { useCallback, useEffect, useState } from "react";
import API, { isSuccess } from "../api/client.js";
import "./ReturnRequestsPage.css";

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatMoney(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function ReturnRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("Requested");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalRequests: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [decisionRequest, setDecisionRequest] = useState(null);
  const [adminMessage, setAdminMessage] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await API.get("/admin/returns", {
        params: { status, page, limit: PAGE_SIZE },
      });
      if (!isSuccess(response)) {
        throw new Error(response.data?.message || "Could not load return requests.");
      }
      setRequests(response.data.requests || []);
      setPagination(response.data.pagination || { totalRequests: 0, totalPages: 0 });
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not load return requests.");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function submitDecision(event) {
    event.preventDefault();
    if (!decisionRequest) return;
    const request = decisionRequest.request;
    setBusyId(request.id);
    setMessage("");
    try {
      const payload = { decision: decisionRequest.decision, adminMessage };
      if (request.itemIndex !== null) payload.itemIndex = request.itemIndex;
      const response = await API.patch(`/admin/orders/${request.orderId}/return`, payload);
      if (!isSuccess(response)) {
        throw new Error(response.data?.message || "Could not review this return request.");
      }
      setDecisionRequest(null);
      setAdminMessage("");
      await loadRequests();
      setMessage(response.data?.message || "Return request reviewed.");
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not review this return request.");
    } finally {
      setBusyId("");
    }
  }

  const totalPages = Math.max(pagination.totalPages, 1);

  return (
    <main className="admin-returns">
      <header className="admin-returns__heading">
        <div>
          <span>ADMINISTRATION</span>
          <h1>Return requests</h1>
          <p>Review the customer’s reason and photos, then accept or reject each request.</p>
        </div>
        <div className="admin-returns__metric">
          <small>{status === "Requested" ? "Awaiting review" : "Matching requests"}</small>
          <strong>{pagination.totalRequests}</strong>
        </div>
      </header>

      <section className="admin-returns__panel" aria-label="Return requests">
        <div className="admin-returns__toolbar">
          <label>
            Request status
            <select
              name="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="Requested">Awaiting review</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="all">All requests</option>
            </select>
          </label>
          <button type="button" onClick={loadRequests} disabled={loading}>
            Refresh
          </button>
        </div>

        {message && (
          <p className="admin-returns__message" role="status">
            {message}
          </p>
        )}

        {loading ? (
          <p className="admin-returns__empty" role="status">Loading return requests…</p>
        ) : requests.length === 0 ? (
          <div className="admin-returns__empty">
            <h2>No return requests found</h2>
            <p>
              {status === "Requested"
                ? "New customer requests will appear here."
                : "Try another status filter."}
            </p>
          </div>
        ) : (
          <div className="admin-returns__list">
            {requests.map((request) => {
              const returnRequest = request.returnRequest || {};
              const item = request.item;
              const pending = returnRequest.status === "Requested";
              return (
                <article className="admin-return-card" key={request.id}>
                  <header className="admin-return-card__header">
                    <div>
                      <span className="admin-returns__eyebrow">ORDER</span>
                      <h2>{request.orderNumber}</h2>
                      <p>{item?.name || "Whole order"}{item?.quantity ? ` · Qty ${item.quantity}` : ""}</p>
                    </div>
                    <span className={`admin-returns__badge admin-returns__badge--${returnRequest.status?.toLowerCase()}`}>
                      {returnRequest.status}
                    </span>
                  </header>

                  <div className="admin-return-card__customer">
                    <div><span>Customer</span><strong>{request.customer?.fullName || "Customer"}</strong></div>
                    <div><span>Email</span><strong>{request.customer?.email || "—"}</strong></div>
                    <div><span>Requested</span><strong>{formatDate(returnRequest.requestedAt)}</strong></div>
                    <div><span>Payment</span><strong>{request.paymentMethod} · {request.paymentStatus}</strong></div>
                    {item && <div><span>Item value</span><strong>{formatMoney(item.itemTotal, request.currency)}</strong></div>}
                  </div>

                  <div className="admin-return-card__reason">
                    <span>Reason</span>
                    <strong>{returnRequest.reason || "Not provided"}</strong>
                    <p>{returnRequest.description || "No additional description was provided."}</p>
                  </div>

                  {returnRequest.evidenceImages?.length > 0 && (
                    <div className="admin-return-card__evidence">
                      <span>Customer photos</span>
                      <div>
                        {returnRequest.evidenceImages.map((image, index) => (
                          <a
                            href={image.url}
                            key={image.publicId || image.url || index}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img src={image.url} alt={`Return evidence ${index + 1}`} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {returnRequest.adminMessage && (
                    <p className="admin-return-card__reply">
                      Previous admin response: {returnRequest.adminMessage}
                    </p>
                  )}

                  {pending && (
                    <div className="admin-return-card__actions">
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionRequest({ request, decision: "Rejected" });
                          setAdminMessage("");
                        }}
                      >
                        Reject request
                      </button>
                      <button
                        className="admin-returns__primary"
                        type="button"
                        onClick={() => {
                          setDecisionRequest({ request, decision: "Accepted" });
                          setAdminMessage("");
                        }}
                      >
                        Accept return
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {!loading && pagination.totalRequests > 0 && (
          <footer className="admin-returns__pagination">
            <span>Page {page} of {totalPages} · {pagination.totalRequests} request(s)</span>
            <div>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          </footer>
        )}
      </section>

      {decisionRequest && (
        <div className="admin-returns__backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busyId) setDecisionRequest(null);
        }}>
          <form className="admin-returns__dialog" onSubmit={submitDecision}>
            <span>RETURN DECISION</span>
            <h2>{decisionRequest.decision} return</h2>
            <p>
              {decisionRequest.request.orderNumber} · {decisionRequest.request.item?.name || "Whole order"}
            </p>
            <label>
              Message to customer
              <textarea
                name="adminMessage"
                value={adminMessage}
                onChange={(event) => setAdminMessage(event.target.value)}
                maxLength={500}
                required
                rows={4}
              />
            </label>
            <div className="admin-returns__dialog-actions">
              <button type="button" disabled={Boolean(busyId)} onClick={() => setDecisionRequest(null)}>
                Back
              </button>
              <button className="admin-returns__primary" type="submit" disabled={!adminMessage.trim() || Boolean(busyId)}>
                {busyId ? "Saving…" : `Confirm ${decisionRequest.decision.toLowerCase()}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
