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
          <p className="customers-subtitle">
            Search, review, and manage registered customers.
          </p>
        </div>

        <div className="customers-total">
          <span>Total customers</span>
          <strong>{pagination.totalUsers}</strong>
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

          <button
            className="button button-secondary"
            type="button"
            onClick={clearSearch}
          >
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
          <input type="date" aria-label="Registered from date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
            }} />
          <input type="date" aria-label="Registered to date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
            }} />
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
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td className="customer-name">
                      <Link to={`/admin/users/${user._id}`}>
                        {user.fullName}
                      </Link>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${user.isBlocked ? "status-blocked" : "status-active"
                          }`}
                      >
                        {user.isBlocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`button ${user.isBlocked ? "button-unblock" : "button-block"
                          }`}
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
