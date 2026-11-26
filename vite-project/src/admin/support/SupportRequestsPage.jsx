import { useEffect, useState } from "react";
import API, { isSuccess } from "../../api/client.js";
import "../adminCommerce.css";

const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const PAGE_SIZE = 20;

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SupportRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalPages: 1,
    totalRequests: 0,
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("Open");
  const [adminResponseText, setAdminResponseText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);

  async function loadRequests() {
    setLoading(true);
    setMessage("");

    try {
      const response = await API.get("/admin/support", {
        params: { search, status, page, limit: PAGE_SIZE },
      });

      if (!isSuccess(response)) {
        throw new Error(response.data?.message || "Could not load help requests.");
      }

      setRequests(response.data.requests || []);
      setPagination(response.data.pagination || { totalPages: 1, totalRequests: 0 });
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not load help requests.");
      setIsSuccessMessage(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [search, status, page]);

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setPage(1);
  }

  function openRequest(request) {
    setSelectedRequest(request);
    setSelectedStatus(request.status);
    setAdminResponseText(
      request.adminResponse ||
        (request.status === "Resolved"
          ? "We have resolved your problem. Thank you for reaching out to ShopEase!"
          : ""),
    );
    setMessage("");
  }

  async function saveStatus() {
    if (!selectedRequest) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await API.patch(`/admin/support/${selectedRequest._id}/status`, {
        status: selectedStatus,
        adminResponse: adminResponseText.trim(),
      });

      if (!isSuccess(response)) {
        throw new Error(response.data?.message || "Could not update request status.");
      }

      setSelectedRequest(response.data.request);
      await loadRequests();
      setMessage(response.data.message || "Request status updated.");
      setIsSuccessMessage(true);
    } catch (error) {
      setMessage(
        error.response?.data?.message || error.message || "Could not update request status.",
      );
      setIsSuccessMessage(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-commerce">
      <header className="admin-commerce__heading">
        <div>
          <span>ADMINISTRATION</span>
          <h1>Help requests</h1>
          <p>Read customer messages and keep each request’s status up to date.</p>
        </div>
        <div className="admin-commerce__metric">
          <small>Total requests</small>
          <strong>{pagination.totalRequests}</strong>
        </div>
      </header>

      <div className="admin-commerce__panel">
        <form className="admin-commerce__toolbar" onSubmit={submitSearch}>
          <input
            name="search-input"
            aria-label="Search help requests"
            placeholder="Search subject, message, customer, or email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button className="admin-commerce__primary" type="submit">
            Search
          </button>
          <button type="button" onClick={clearFilters}>
            Clear
          </button>
          <label>
            Status
            <select
              name="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </form>

        {message && (
          <p
            className={`admin-commerce__message${isSuccessMessage ? " is-success" : ""}`}
            role="status"
          >
            {message}
          </p>
        )}

        {loading ? (
          <p>Loading help requests…</p>
        ) : requests.length === 0 ? (
          <p>No help requests found.</p>
        ) : (
          <div className="admin-commerce__table-wrap">
            <table className="admin-commerce__table">
              <thead>
                <tr>
                  <th>CUSTOMER</th>
                  <th>ISSUE</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request._id}>
                    <td>
                      {request.userId?.fullName || "Customer"}
                      <small>{request.userId?.email || "Account unavailable"}</small>
                    </td>
                    <td>
                      <strong>{request.subject}</strong>
                      <small>{request.category}</small>
                    </td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td>
                      <span className="admin-commerce__badge">{request.status}</span>
                    </td>
                    <td>
                      <button type="button" onClick={() => openRequest(request)}>
                        Read message
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-commerce__pagination">
          <span>
            Page {page} of {Math.max(1, pagination.totalPages)} · {pagination.totalRequests}{" "}
            requests
          </span>
          <div>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedRequest && (
        <div
          className="admin-commerce__backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedRequest(null);
          }}
        >
          <section
            className="admin-commerce__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-dialog-title"
          >
            <button
              type="button"
              className="admin-commerce__close"
              aria-label="Close"
              onClick={() => setSelectedRequest(null)}
            >
              ×
            </button>
            <span>{selectedRequest.category}</span>
            <h2 id="support-dialog-title">{selectedRequest.subject}</h2>
            <p>
              From {selectedRequest.userId?.fullName || "Customer"} ·{" "}
              {selectedRequest.userId?.email || "Email unavailable"}
            </p>
            <p>Sent {formatDate(selectedRequest.createdAt)}</p>
            <div className="admin-support-message">{selectedRequest.message}</div>

            <label className="admin-support-status">
              Request status
              <select
                name="selected-status"
                value={selectedStatus}
                onChange={(event) => {
                  const newStatus = event.target.value;
                  setSelectedStatus(newStatus);
                  if (newStatus === "Resolved" && !adminResponseText) {
                    setAdminResponseText(
                      "We have reviewed and resolved your problem. Thank you for reaching out to ShopEase support!",
                    );
                  }
                }}
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label
              className="admin-support-status"
              style={{ marginTop: "12px", display: "grid", gap: "6px" }}
            >
              <span>Reply to customer</span>
              <textarea
                name="admin-response-text"
                rows={4}
                value={adminResponseText}
                onChange={(e) => setAdminResponseText(e.target.value)}
                placeholder="Write a message to the customer (e.g. We have resolved your problem...)"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #dce4e0",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                <button
                  type="button"
                  style={{
                    padding: "4px 9px",
                    fontSize: "11px",
                    background: "#eef6f2",
                    border: "1px solid #c7ded3",
                    borderRadius: "6px",
                    color: "#124b3d",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setAdminResponseText(
                      "We have resolved your problem. Thank you for your patience!",
                    )
                  }
                >
                  ⚡ Quick: &quot;Resolved your problem&quot;
                </button>
                <button
                  type="button"
                  style={{
                    padding: "4px 9px",
                    fontSize: "11px",
                    background: "#f0f4f8",
                    border: "1px solid #d0dbe5",
                    borderRadius: "6px",
                    color: "#2c4c68",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setAdminResponseText(
                      "We are currently investigating your issue and working on a solution.",
                    )
                  }
                >
                  ⚡ Quick: &quot;Investigating&quot;
                </button>
              </div>
            </label>

            <div className="admin-support-actions">
              <button type="button" onClick={() => setSelectedRequest(null)}>
                Close
              </button>
              <button
                className="admin-commerce__primary"
                type="button"
                disabled={
                  saving ||
                  (selectedStatus === selectedRequest.status &&
                    adminResponseText === (selectedRequest.adminResponse || ""))
                }
                onClick={saveStatus}
              >
                {saving ? "Saving…" : "Save status & reply"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
