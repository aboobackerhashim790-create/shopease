import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API, { isSuccess } from "../api/client.js";
import "./adminCommerce.css";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    API.get("/admin/dashboard")
      .then((response) => {
        if (!isSuccess(response))
          throw new Error(response.data.message || "Could not load dashboard.");
        if (active) setData(response.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const summary = data?.summary;
  const statusCounts = Object.fromEntries(
    (summary?.orderStatus || []).map((item) => [item._id, item.count]),
  );
  const revenueDays = data?.revenueDays || [];
  const chartWidth = 680;
  const chartHeight = 190;
  const maxRevenue = Math.max(...revenueDays.map((day) => day.amount), 1);
  const points = revenueDays.map((day, index) => ({
    x:
      revenueDays.length > 1
        ? 10 + (index * (chartWidth - 20)) / (revenueDays.length - 1)
        : chartWidth / 2,
    y: chartHeight - 12 - (day.amount / maxRevenue) * (chartHeight - 28),
  }));
  const chartLine = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <section className="admin-commerce">
      <header className="admin-commerce__heading">
        <div>
          <span>ADMINISTRATION</span>
          <h1>Dashboard</h1>
          <p>A current snapshot of your store and recent orders.</p>
        </div>
      </header>
      {error && (
        <p className="admin-commerce__message" role="alert">
          {error}
        </p>
      )}
      {!data && !error ? (
        <div className="admin-commerce__panel">Loading dashboard…</div>
      ) : (
        <>
          <div className="admin-dashboard-cards">
            <article>
              <small>Total orders</small>
              <strong>{summary?.totalOrders ?? 0}</strong>
              <span>All order records</span>
            </article>
            <article>
              <small>Customers</small>
              <strong>{summary?.customers ?? 0}</strong>
              <span>Registered customer accounts</span>
            </article>
            <article>
              <small>Blocked Customers</small>
              <strong>{summary?.blockedUsers ?? 0}</strong>
              <span>Blocked customer accounts</span>
            </article>
            <article>
              <small>Listed products</small>
              <strong>{summary?.listedProducts ?? 0}</strong>
              <span>Active products</span>
            </article>
            <article>
              <small>Paid revenue</small>
              <strong>{money(summary?.paidRevenue)}</strong>
              <span>Paid orders less accepted returns and cancelled orders</span>
            </article>
          </div>
          <div className="admin-dashboard-grid">
            <section className="admin-commerce__panel admin-dashboard-revenue">
              <div className="admin-commerce__section-title">
                <div>
                  <h2>Revenue received</h2>
                  <p>Paid orders over the last 7 days, after accepted returns.</p>
                </div>
              </div>
              <div className="admin-dashboard-revenue__total">
                {money(revenueDays.reduce((sum, day) => sum + day.amount, 0))}
                <span>Last 7 days</span>
              </div>
              <div className="admin-dashboard-revenue__chart">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  role="img"
                  aria-label="Daily paid revenue for the last seven days"
                >
                  {[0.25, 0.5, 0.75, 1].map((fraction) => (
                    <line
                      key={fraction}
                      x1="0"
                      x2={chartWidth}
                      y1={chartHeight - 12 - fraction * (chartHeight - 28)}
                      y2={chartHeight - 12 - fraction * (chartHeight - 28)}
                      className="admin-dashboard-revenue__gridline"
                    />
                  ))}
                  {points.length > 1 && (
                    <polyline points={chartLine} className="admin-dashboard-revenue__line" />
                  )}
                  {points.map((point, index) => (
                    <circle
                      key={revenueDays[index]?.date}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      className="admin-dashboard-revenue__point"
                    >
                      <title>{`${revenueDays[index]?.date}: ${money(revenueDays[index]?.amount)}`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="admin-dashboard-revenue__labels">
                  {revenueDays.map((day) => (
                    <span key={day.date}>
                      {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  ))}
                </div>
              </div>
            </section>
            <section className="admin-commerce__panel">
              <div className="admin-commerce__section-title">
                <div>
                  <h2>Order status</h2>
                  <p>Counts update from order records.</p>
                </div>
                <Link to="/admin/orders">Manage orders →</Link>
              </div>
              <div className="admin-dashboard-status">
                {[
                  "Pending",
                  "Confirmed",
                  "Shipped",
                  "Out for Delivery",
                  "Delivered",
                  "Cancelled",
                ].map((status) => (
                  <div key={status}>
                    <span>{status}</span>
                    <strong>{statusCounts[status] || 0}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="admin-commerce__panel">
              <div className="admin-commerce__section-title">
                <div>
                  <h2>Recent orders</h2>
                  <p>Newest orders first.</p>
                </div>
                <Link to="/admin/orders">View all →</Link>
              </div>
              <div className="admin-dashboard-recent">
                {data?.recentOrders?.length ? (
                  data.recentOrders.map((order) => (
                    <div key={order._id}>
                      <span>
                        <strong>{order.orderNumber}</strong>
                        <small>
                          {order.userId?.fullName || "Customer"} ·{" "}
                          {new Date(order.createdAt).toLocaleDateString("en-IN")}
                        </small>
                      </span>
                      <span>
                        <strong>{money(order.totalAmount)}</strong>
                        <small>{order.orderStatus}</small>
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No orders yet.</p>
                )}
              </div>
            </section>
          </div>
          <div className="admin-dashboard-shortcuts">
            <Link to="/admin/products">Manage products</Link>
            <Link to="/admin/category">Manage categories</Link>
            <Link to="/admin/coupons">Manage coupons</Link>
            <Link to="/admin/orders">Manage orders</Link>
          </div>
        </>
      )}
    </section>
  );
}
