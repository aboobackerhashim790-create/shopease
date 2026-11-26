import API, { isSuccess } from "../../api/client.js";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./UserManagementPage.css";

function UserManagementPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  });
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number.parseInt(searchParams.get("page"), 10) || 1, 1);
  const requestedLimit = Number.parseInt(searchParams.get("limit"), 10) || 10;
  const limit = Math.min(Math.max(requestedLimit, 1), 50);
  const [pagination, setPagination] = useState({
    totalPages: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [userToToggle, setUserToToggle] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  function escapeHtml(value = "") {
    return String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  async function handleDownloadPdf() {
    setExportingPdf(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "1000",
        search,
        sort,
        status,
      });
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const response = await API.get(`/admin/users?${params}`);
      const exportList = isSuccess(response) && response.data?.users ? response.data.users : users;

      if (!exportList || exportList.length === 0) {
        alert("No customers found to export.");
        return;
      }

      const printWindow = window.open("", "_blank", "width=1000,height=900");
      if (!printWindow) {
        alert("Please allow popups in your browser to view and download the PDF report.");
        return;
      }

      const tableRows = exportList
        .map(
          (customer, index) => `
        <tr>
          <td style="text-align: center; color: #64748b; font-weight: 600;">${index + 1}</td>
          <td style="font-weight: 600; color: #0f172a;">${escapeHtml(customer.fullName || "—")}</td>
          <td style="color: #334155;">${escapeHtml(customer.email || "—")}</td>
          <td>${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—"}</td>
          <td style="font-weight: 700; color: #124b3d; text-align: right;">₹${Number(customer.totalSpent || 0).toLocaleString("en-IN")}</td>
          <td style="text-align: center;">
            <span class="badge ${customer.isBlocked ? "badge-blocked" : "badge-active"}">
              ${customer.isBlocked ? "Blocked" : "Active"}
            </span>
          </td>
        </tr>
      `,
        )
        .join("");

      const totalRevenue = exportList.reduce((sum, u) => sum + (Number(u.totalSpent) || 0), 0);
      const activeCount = exportList.filter((u) => !u.isBlocked).length;
      const blockedCount = exportList.filter((u) => u.isBlocked).length;
      const formattedDate = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date());

      printWindow.document.write(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>ShopEase Customer Report - ${new Date().toISOString().slice(0, 10)}</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 12mm 15mm;
              }
              * { box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                color: #1e293b;
                margin: 0;
                padding: 16px;
                line-height: 1.4;
                font-size: 12px;
                background: #ffffff;
              }
              .report-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #124b3d;
                padding-bottom: 12px;
                margin-bottom: 16px;
              }
              .brand-title {
                margin: 0;
                font-size: 24px;
                font-weight: 800;
                color: #124b3d;
                letter-spacing: -0.5px;
              }
              .report-subtitle {
                margin: 4px 0 0;
                color: #64748b;
                font-size: 13px;
                font-weight: 500;
              }
              .report-meta {
                text-align: right;
                font-size: 11px;
                color: #64748b;
              }
              .report-meta div {
                margin-bottom: 3px;
              }
              .stat-cards {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 18px;
              }
              .stat-card {
                padding: 10px 14px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
              }
              .stat-card span {
                display: block;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 700;
                color: #64748b;
              }
              .stat-card strong {
                display: block;
                margin-top: 3px;
                font-size: 17px;
                font-weight: 800;
                color: #0f172a;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 8px;
              }
              th {
                background: #f1f5f9;
                color: #334155;
                font-weight: 700;
                text-align: left;
                padding: 9px 10px;
                border-top: 1px solid #cbd5e1;
                border-bottom: 2px solid #cbd5e1;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              td {
                padding: 9px 10px;
                border-bottom: 1px solid #e2e8f0;
              }
              tr:nth-child(even) {
                background: #fafafa;
              }
              .badge {
                display: inline-block;
                padding: 3px 9px;
                border-radius: 999px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
              }
              .badge-active {
                background: #dcfce7;
                color: #166534;
              }
              .badge-blocked {
                background: #fee2e2;
                color: #991b1b;
              }
              .report-footer {
                margin-top: 24px;
                padding-top: 12px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: #94a3b8;
              }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="report-header">
              <div>
                <h1 class="brand-title">ShopEase</h1>
                <p class="report-subtitle">Customer Management &amp; Revenue Report</p>
              </div>
              <div class="report-meta">
                <div><strong>Generated on:</strong> ${escapeHtml(formattedDate)}</div>
                <div><strong>Filter:</strong> ${escapeHtml(status === "all" ? "All Customers" : status === "active" ? "Active Only" : "Blocked Only")}</div>
                ${search ? `<div><strong>Search:</strong> "${escapeHtml(search)}"</div>` : ""}
              </div>
            </div>

            <div class="stat-cards">
              <div class="stat-card">
                <span>Total Customers</span>
                <strong>${exportList.length}</strong>
              </div>
              <div class="stat-card">
                <span>Active Customers</span>
                <strong style="color: #166534;">${activeCount}</strong>
              </div>
              <div class="stat-card">
                <span>Blocked Customers</span>
                <strong style="color: #991b1b;">${blockedCount}</strong>
              </div>
              <div class="stat-card">
                <span>Total Revenue Generated</span>
                <strong style="color: #124b3d;">₹${totalRevenue.toLocaleString("en-IN")}</strong>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 38px; text-align: center;">#</th>
                  <th>Customer Name</th>
                  <th>Email Address</th>
                  <th>Registered Date</th>
                  <th style="text-align: right;">Total Spent</th>
                  <th style="text-align: center; width: 100px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div class="report-footer">
              <span>ShopEase Administration · Confidential System Report</span>
              <span>Page 1 of 1</span>
            </div>

            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF: " + (err.message || "Unknown error"));
    } finally {
      setExportingPdf(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      setLoading(true);
      setMessage("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search,
          sort,
          status,
        });
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const response = await API.get(`/admin/users?${params}`);

        const result = response.data;

        if (!isSuccess(response)) {
          throw new Error(result.message || "Could not load customers.");
        }

        if (active) {
          setUsers(result.users);
          setPagination(result.pagination);
        }
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, [page, limit, search, sort, status, fromDate, toDate]);

  function updatePage(nextPage) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("page", String(nextPage));
      nextParams.set("limit", String(limit));
      return nextParams;
    });
  }

  function updateLimit(nextLimit) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set("page", "1");
      nextParams.set("limit", String(nextLimit));
      return nextParams;
    });
  }

  function toggleBlock(user) {
    setUserToToggle(user);
  }

  async function confirmToggleBlock() {
    if (!userToToggle) return;

    const user = userToToggle;
    const isBlocked = !user.isBlocked;

    setUpdatingUserId(user._id);
    setMessage("");

    try {
      const response = await API.patch(`/admin/users/${user._id}/block`, {
        isBlocked,
      });

      const result = response.data;

      if (!isSuccess(response)) {
        throw new Error(result.message || "Could not update this customer.");
      }

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser._id === user._id ? result.user : currentUser,
        ),
      );

      setMessage(result.message);
      setUserToToggle(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUpdatingUserId(null);
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    updatePage(1);
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    updatePage(1);
  }

  const totalPages = Math.max(pagination.totalPages, 1);
  const pageOptions = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pageOptions.push(pageNumber);
  }

  return (
    <section className="customers-page">
      <div className="customers-heading">
        <div>
          <p className="customers-eyebrow">ADMINISTRATION</p>
          <h1>User Management</h1>
          <p className="customers-subtitle">Search, review, and manage registered customers.</p>
        </div>

        <div className="customers-heading-actions">
          <button
            type="button"
            className="button download-pdf-btn"
            onClick={handleDownloadPdf}
            disabled={exportingPdf || loading}
            title="Export and print customer list as PDF"
          >
            {exportingPdf ? (
              <span>Generating PDF…</span>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download PDF</span>
              </>
            )}
          </button>
          <div className="customers-total">
            <span>Total customers</span>
            <strong>{pagination.totalUsers}</strong>
          </div>
        </div>
      </div>

      <section className="customers-panel">
        <form className="customers-toolbar" onSubmit={handleSearch}>
          <input
            className="customers-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or email"
            aria-label="Search customers by name or email"
          />

          <button className="button button-primary" type="submit">
            Search
          </button>

          <button className="button button-secondary" type="button" onClick={clearSearch}>
            Clear
          </button>
          <label className="status-control">
            <span>Show</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                updatePage(1);
              }}
            >
              <option value="all">All customers</option>
              <option value="active">Active customers</option>
              <option value="blocked">Blocked customers</option>
            </select>
          </label>
          <label className="sort-control">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                updatePage(1);
              }}
            >
              <option value="latest">Newest registered</option>
              <option value="oldest">Oldest registered</option>
            </select>
          </label>
          <input
            type="date"
            aria-label="Registered from date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
            }}
          />
          <input
            type="date"
            aria-label="Registered to date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
            }}
          />
        </form>

        {message && (
          <p className="customers-message" role="alert">
            {message}
          </p>
        )}

        {loading ? (
          <p className="customers-state">Loading customers…</p>
        ) : users.length === 0 ? (
          <p className="customers-state">No customers found.</p>
        ) : (
          <div className="customers-table-wrap">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Registered</th>
                  <th>Total Spent</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td className="customer-name">
                      <Link to={`/admin/users/${user._id}`}>{user.fullName}</Link>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                    <td>₹{(user.totalSpent || 0).toLocaleString("en-IN")}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          user.isBlocked ? "status-blocked" : "status-active"
                        }`}
                      >
                        {user.isBlocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`button ${user.isBlocked ? "button-unblock" : "button-block"}`}
                        type="button"
                        onClick={() => toggleBlock(user)}
                        disabled={updatingUserId === user._id}
                      >
                        {updatingUserId === user._id
                          ? "Updating…"
                          : user.isBlocked
                            ? "Unblock"
                            : "Block"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="customers-pagination">
          <span>
            Page {page} of {totalPages} · {pagination.totalUsers} customers
          </span>

          <div className="customers-pagination__controls">
            <label>
              Page
              <select
                value={page}
                onChange={(event) => updatePage(Number(event.target.value))}
                disabled={loading}
              >
                {pageOptions.map((pageNumber) => (
                  <option key={pageNumber} value={pageNumber}>
                    {pageNumber}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Show
              <select
                value={limit}
                onChange={(event) => updateLimit(Number(event.target.value))}
                disabled={loading}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              customers per page
            </label>
          </div>
        </div>
      </section>

      {userToToggle && (
        <div className="customer-modal-backdrop">
          <section
            className="customer-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-confirm-title"
          >
            <h2 id="customer-confirm-title">
              {userToToggle.isBlocked ? "Unblock customer?" : "Block customer?"}
            </h2>
            <p>
              Are you sure you want to {userToToggle.isBlocked ? "unblock" : "block"}{" "}
              <strong>{userToToggle.fullName}</strong>?
            </p>
            <div className="customer-confirm-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setUserToToggle(null)}
                disabled={updatingUserId === userToToggle._id}
              >
                Cancel
              </button>
              <button
                className={`button ${userToToggle.isBlocked ? "button-unblock" : "button-block"}`}
                type="button"
                onClick={confirmToggleBlock}
                disabled={updatingUserId === userToToggle._id}
              >
                {updatingUserId === userToToggle._id
                  ? "Updating…"
                  : userToToggle.isBlocked
                    ? "Unblock customer"
                    : "Block customer"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default UserManagementPage;
