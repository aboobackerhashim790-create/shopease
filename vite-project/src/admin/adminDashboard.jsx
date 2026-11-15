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
    API.get("/admin/dashboard").then((response) => {
      if (!isSuccess(response)) throw new Error(response.data.message || "Could not load dashboard.");
      if (active) setData(response.data);
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || requestError.message); });
    return () => { active = false; };
  }, []);
  const summary = data?.summary;
  const statusCounts = Object.fromEntries((summary?.orderStatus || []).map((item) => [item._id, item.count]));
  return <section className="admin-commerce">
    <header className="admin-commerce__heading"><div><span>ADMINISTRATION</span><h1>Dashboard</h1><p>A current snapshot of your store and recent orders.</p></div></header>
    {error && <p className="admin-commerce__message" role="alert">{error}</p>}
    {!data && !error ? <div className="admin-commerce__panel">Loading dashboard…</div> : <>
      <div className="admin-dashboard-cards">
        <article><small>Total orders</small><strong>{summary?.totalOrders ?? 0}</strong><span>All order records</span></article>
        <article><small>Customers</small><strong>{summary?.customers ?? 0}</strong><span>Registered customer accounts</span></article>
        <article><small>Listed products</small><strong>{summary?.listedProducts ?? 0}</strong><span>Active products</span></article>
        <article><small>Paid revenue</small><strong>{money(summary?.paidRevenue)}</strong><span>Paid orders less accepted returns and cancelled orders</span></article>
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-commerce__panel"><div className="admin-commerce__section-title"><div><h2>Order status</h2><p>Counts update from order records.</p></div><Link to="/admin/orders">Manage orders →</Link></div><div className="admin-dashboard-status">{["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"].map((status) => <div key={status}><span>{status}</span><strong>{statusCounts[status] || 0}</strong></div>)}</div></section>
        <section className="admin-commerce__panel"><div className="admin-commerce__section-title"><div><h2>Recent orders</h2><p>Newest orders first.</p></div><Link to="/admin/orders">View all →</Link></div><div className="admin-dashboard-recent">{data?.recentOrders?.length ? data.recentOrders.map((order) => <div key={order._id}><span><strong>{order.orderNumber}</strong><small>{order.userId?.fullName || "Customer"} · {new Date(order.createdAt).toLocaleDateString("en-IN")}</small></span><span><strong>{money(order.totalAmount)}</strong><small>{order.orderStatus}</small></span></div>) : <p>No orders yet.</p>}</div></section>
      </div>
      <div className="admin-dashboard-shortcuts"><Link to="/admin/products">Manage products</Link><Link to="/admin/category">Manage categories</Link><Link to="/admin/coupons">Manage coupons</Link><Link to="/admin/orders">Manage orders</Link></div>
    </>}
  </section>;
}
