import { useEffect, useState } from "react";
import API, { isSuccess } from "../api/client.js";
import "./adminCommerce.css";

const statuses = ["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
const nextItemStatuses = {
  Pending: ["Confirmed"],
  Confirmed: ["Shipped"],
  Shipped: ["Out for Delivery"],
  "Out for Delivery": ["Delivered"],
};
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalOrders: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [returnReview, setReturnReview] = useState(null);
  const [returnMessage, setReturnMessage] = useState("");

  async function loadOrders() {
    setLoading(true);
    setMessage("");
    try {
      const response = await API.get("/admin/orders", { params: { search, status, paymentStatus, page, limit } });
      if (!isSuccess(response)) throw new Error(response.data.message || "Could not load orders.");
      setOrders(response.data.orders || []);
      setPagination(response.data.pagination || { totalPages: 1, totalOrders: 0 });
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not load orders.");
    } finally { setLoading(false); }
  }

  useEffect(() => { loadOrders(); }, [search, status, paymentStatus, page, limit]);

  async function changeItemStatus(order, itemIndex, fulfillmentStatus) {
    setBusyId(order._id);
    setMessage("");
    try {
      const response = await API.patch(
        `/admin/orders/${order._id}/items/${itemIndex}/status`,
        { fulfillmentStatus },
      );
      if (!isSuccess(response)) throw new Error(response.data.message || "Could not update product status.");
      setSelectedOrder((current) => current?._id === order._id
        ? { ...current, ...response.data.order, userId: current.userId }
        : current);
      await loadOrders();
      setMessage(response.data.message || "Product status updated.");
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not update product status.");
    } finally {
      setBusyId("");
    }
  }

  async function decideReturn(order, itemIndex, decision) {
    setBusyId(order._id); setMessage("");
    try {
      const payload = itemIndex === null
        ? { decision, adminMessage: returnMessage }
        : { decision, itemIndex, adminMessage: returnMessage };
      const response = await API.patch(`/admin/orders/${order._id}/return`, payload);
      if (!isSuccess(response)) throw new Error(response.data.message || "Could not review return.");
      await loadOrders();
      if (selectedOrder?._id === order._id) {
        setSelectedOrder({ ...response.data.order, userId: selectedOrder.userId });
      }
      setReturnReview(null);
      setReturnMessage("");
      setMessage(response.data.message);
    } catch (error) { setMessage(error.response?.data?.message || error.message); }
    finally { setBusyId(""); }
  }

  function submitSearch(event) { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }
  function clearFilters() { setSearchInput(""); setSearch(""); setStatus("all"); setPaymentStatus("all"); setPage(1); }

  return <section className="admin-commerce">
    <header className="admin-commerce__heading"><div><span>ADMINISTRATION</span><h1>Order management</h1><p>Review orders, update fulfillment, process returns, and track refunds.</p></div><div className="admin-commerce__metric"><small>Total orders</small><strong>{pagination.totalOrders}</strong></div></header>
    <div className="admin-commerce__panel">
      <form className="admin-commerce__toolbar" onSubmit={submitSearch}>
        <input aria-label="Search orders" placeholder="Search by order number, customer, or email" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <button className="admin-commerce__primary">Search</button><button type="button" onClick={clearFilters}>Clear</button>
        <label>Status <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Payment <select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}><option value="all">All payments</option>{["Pending", "Paid", "Failed", "Cancelled", "Refunded"].map((item) => <option key={item}>{item}</option>)}</select></label>
      </form>
      {message && <p className="admin-commerce__message" role="status">{message}</p>}
      <div className="admin-commerce__table-wrap"><table className="admin-commerce__table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>DATE</th><th>TOTAL</th><th>PAYMENT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="7">Loading orders…</td></tr> : orders.length === 0 ? <tr><td colSpan="7">No orders found.</td></tr> : orders.map((order) => <tr key={order._id}>
          <td>
            <button
              type="button"
              className="admin-commerce__order-link"
              onClick={() => setSelectedOrder(order)}
            >
              {order.orderNumber}
            </button>
            <small>{order.items?.length || 0} product line(s)</small>
            {order.items?.some((item) => item.returnRequest?.status === "Requested") && (
              <small className="admin-commerce__return-needed">Return request needs review</small>
            )}
          </td>
          <td>{order.userId?.fullName || "Customer"}<small>{order.userId?.email || ""}</small></td>
          <td>{new Date(order.createdAt).toLocaleDateString("en-IN")}</td>
          <td>{money(order.totalAmount)}</td>
          <td>{order.paymentMethod}<small>{order.paymentStatus}</small></td>
          <td><span className={`admin-commerce__badge ${order.orderStatus === "Cancelled" ? "is-muted" : ""}`}>{order.orderStatus}</span><small>Overall · see product statuses</small></td>
          <td className="admin-commerce__actions"><button type="button" onClick={() => setSelectedOrder(order)}>Manage products</button></td>
        </tr>)}
      </tbody></table></div>
      <footer className="admin-commerce__pagination"><span>Page {page} of {Math.max(pagination.totalPages, 1)} · {pagination.totalOrders} orders</span><div><label>Rows <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
    </div>
    {selectedOrder && (
      <div className="admin-commerce__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}>
        <section className="admin-commerce__dialog">
          <button className="admin-commerce__close" type="button" onClick={() => setSelectedOrder(null)}>×</button>
          <span>ORDER DETAILS</span>
          <h2>{selectedOrder.orderNumber}</h2>
          <p>{selectedOrder.userId?.fullName} · {selectedOrder.userId?.email}</p>
          <p>{selectedOrder.deliveryAddress?.fullName}<br />{selectedOrder.deliveryAddress?.addressLine1}, {selectedOrder.deliveryAddress?.city}, {selectedOrder.deliveryAddress?.state} {selectedOrder.deliveryAddress?.postalCode}</p>
          {selectedOrder.refundDestination && selectedOrder.refundDestination !== "None" && (
            <div className="admin-commerce__return">
              <p>Refund: {selectedOrder.refundDestination === "Razorpay" ? "Razorpay → original payment method" : selectedOrder.refundDestination} · {money(selectedOrder.refundAmount ?? selectedOrder.totalAmount)} · {selectedOrder.refundStatus || (selectedOrder.paymentStatus === "Refunded" ? "Completed" : "Pending")}</p>
            </div>
          )}
          <h3>Products and fulfillment status</h3>
          {selectedOrder.items?.map((item, index) => {
            const itemStatus = item.isCancelled ? "Cancelled" : item.fulfillmentStatus || selectedOrder.orderStatus;
            return (
              <div className="admin-commerce__detail-item" key={`${item.sku}-${index}`}>
                <span>
                  <strong>{item.name}</strong> {item.options?.color || item.options?.storage ? `· ${item.options.color} ${item.options.storage}` : ""}
                  <small>Qty {item.quantity} × {money(item.unitPrice)}</small>
                  {item.returnRequest?.status && item.returnRequest.status !== "None" && <small>Return: {item.returnRequest.status} · {item.returnRequest.reason}</small>}
                  {item.refundDestination && item.refundDestination !== "None" && <small>Refund: {money(item.refundAmount)} · {item.refundDestination} · {item.refundStatus}</small>}
                </span>
                <strong>{money(item.itemTotal)}</strong>
                <label className="admin-commerce__item-status">
                  Product status
                  <select
                    value={itemStatus}
                    disabled={busyId === selectedOrder._id || item.isCancelled || itemStatus === "Returned"}
                    onChange={(event) => changeItemStatus(selectedOrder, index, event.target.value)}
                  >
                    <option value={itemStatus}>{itemStatus}</option>
                    {(nextItemStatuses[itemStatus] || []).map((nextStatus) => <option key={nextStatus} value={nextStatus}>{nextStatus}</option>)}
                  </select>
                </label>
                {item.returnRequest?.status === "Requested" && (
                  <div className="admin-commerce__return">
                    <button type="button" disabled={busyId === selectedOrder._id} onClick={() => { setReturnReview({ order: selectedOrder, itemIndex: index, decision: "Rejected" }); setReturnMessage(""); }}>Reject return</button>
                    <button type="button" className="admin-commerce__primary" disabled={busyId === selectedOrder._id} onClick={() => { setReturnReview({ order: selectedOrder, itemIndex: index, decision: "Accepted" }); setReturnMessage(""); }}>Accept return</button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="admin-commerce__detail-total">Order total <strong>{money(selectedOrder.totalAmount)}</strong></div>
          {selectedOrder.returnRequest?.status === "Requested" && (
            <div className="admin-commerce__return">
              <h3>Legacy order return request</h3>
              <p>{selectedOrder.returnRequest.reason}</p>
              <button type="button" disabled={busyId === selectedOrder._id} onClick={() => { setReturnReview({ order: selectedOrder, itemIndex: null, decision: "Rejected" }); setReturnMessage(""); }}>Reject</button>
              <button type="button" className="admin-commerce__primary" disabled={busyId === selectedOrder._id} onClick={() => { setReturnReview({ order: selectedOrder, itemIndex: null, decision: "Accepted" }); setReturnMessage(""); }}>Accept</button>
            </div>
          )}
        </section>
      </div>
    )}
    {returnReview && (
      <div className="admin-commerce__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setReturnReview(null); }}>
        <form className="admin-commerce__dialog" onSubmit={(event) => { event.preventDefault(); decideReturn(returnReview.order, returnReview.itemIndex, returnReview.decision); }}>
          <button className="admin-commerce__close" type="button" onClick={() => setReturnReview(null)}>×</button>
          <span>RETURN DECISION</span>
          <h2>{returnReview.decision} return</h2>
          <p>This message will be shown to the customer with the return result.</p>
          <label>Message to customer
            <textarea value={returnMessage} onChange={(event) => setReturnMessage(event.target.value)} maxLength={500} required rows={4} />
          </label>
          <button className="admin-commerce__primary" type="submit" disabled={busyId === returnReview.order._id || !returnMessage.trim()}>
            {busyId === returnReview.order._id ? "Saving…" : `Confirm ${returnReview.decision.toLowerCase()}`}
          </button>
        </form>
      </div>
    )}
  </section>;
}
