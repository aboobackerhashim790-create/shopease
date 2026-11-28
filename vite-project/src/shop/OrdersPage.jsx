import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import API, { isSuccess } from "../api/client.js";
import "./OrdersPage.css";

const ORDER_STEPS = ["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered"];
const PAGE_SIZE = 8;

function formatMoney(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

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

function printInvoice(order) {
  const invoiceWindow = window.open("", "_blank", "width=800,height=900");
  if (!invoiceWindow) return;

  const itemRows = (order.items || [])
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.name)}<small>${escapeHtml(item.sku || "")}</small></td>
      <td>${item.quantity}</td>
      <td>${escapeHtml(formatMoney(item.unitPrice, order.currency))}</td>
      <td>${escapeHtml(formatMoney(item.itemTotal, order.currency))}</td>
    </tr>`,
    )
    .join("");
  const address = order.deliveryAddress || {};

  invoiceWindow.document.write(`<!doctype html>
    <html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(order.orderNumber)}</title>
    <style>
      body{font:14px Arial,sans-serif;color:#17231f;margin:40px;line-height:1.5}header{display:flex;justify-content:space-between;border-bottom:2px solid #124b3d;padding-bottom:18px}h1{margin:0;color:#124b3d}h2{font-size:16px;margin:26px 0 8px}p{margin:3px 0;color:#52615b}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #dfe7e2}th{background:#f3f7f4}small{display:block;color:#687771;margin-top:3px}.totals{width:min(100%,340px);margin:20px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:6px 0}.grand{border-top:1px solid #aebdb4;margin-top:5px;padding-top:12px!important;font-size:16px;font-weight:bold}@media print{body{margin:18mm}button{display:none}}
    </style></head><body>
    <header><div><h1>ShopEase</h1><p>Order invoice</p></div><div><strong>${escapeHtml(order.orderNumber)}</strong><p>${escapeHtml(formatDate(order.createdAt))}</p></div></header>
    <h2>Deliver to</h2><p><strong>${escapeHtml(address.fullName || "")}</strong></p>
    <p>${escapeHtml(address.addressLine1 || "")}${address.addressLine2 ? `, ${escapeHtml(address.addressLine2)}` : ""}</p>
    <p>${escapeHtml([address.city, address.state, address.postalCode].filter(Boolean).join(", "))}</p>
    <p>${escapeHtml(address.country || "")} · ${escapeHtml(address.phone || "")}</p>
    <table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
    <div class="totals"><div><span>Subtotal</span><strong>${escapeHtml(formatMoney(order.subtotal, order.currency))}</strong></div>
    ${order.discountAmount > 0 ? `<div><span>Discount</span><strong>−${escapeHtml(formatMoney(order.discountAmount, order.currency))}</strong></div>` : ""}
    <div><span>Delivery</span><strong>${escapeHtml(formatMoney(order.shippingAmount, order.currency))}</strong></div>
    <div class="grand"><span>Total</span><strong>${escapeHtml(formatMoney(order.totalAmount, order.currency))}</strong></div></div>
    <p style="margin-top:24px">Payment: ${escapeHtml(order.paymentMethod)} · ${escapeHtml(order.paymentStatus)}</p>
    <script>window.onload=()=>{window.print()}</script></body></html>`);
  invoiceWindow.document.close();
}

function OrderTracking({ status, history, createdAt, deliveredAt }) {
  if (["Cancelled", "Returned"].includes(status)) {
    return (
      <p className={`orders-cancelled-note ${status === "Returned" ? "orders-returned-note" : ""}`}>
        {status === "Returned" ? "This product was returned." : "This product was cancelled."}
      </p>
    );
  }

  const activeIndex = ORDER_STEPS.indexOf(status);
  return (
    <ol className="orders-tracking" aria-label={`Order tracking: ${status}`}>
      {ORDER_STEPS.map((step, index) => {
        const statusEvent = history.filter((event) => event.status === step).at(-1);
        const changedAt =
          statusEvent?.updatedAt ||
          (step === "Pending" ? createdAt : step === "Delivered" ? deliveredAt : null);
        return (
          <li className={index <= activeIndex ? "is-complete" : ""} key={step}>
            <span className="orders-tracking__dot" />
            <span>{step}</span>
            {changedAt && (
              <time className="orders-tracking__time">{formatDateTime(changedAt)}</time>
            )}
          </li>
        );
      })}
    </ol>
  );
}

OrderTracking.propTypes = {
  status: PropTypes.string.isRequired,
  history: PropTypes.arrayOf(
    PropTypes.shape({
      status: PropTypes.string.isRequired,
      updatedAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]).isRequired,
    }),
  ),
  createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  deliveredAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
};
OrderTracking.defaultProps = { history: [], createdAt: null, deliveredAt: null };

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, totalOrders: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [returnImages, setReturnImages] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/profile/orders", {
        params: { search, status, page, limit: PAGE_SIZE },
      });
      if (!isSuccess(response))
        throw new Error(response.data?.message || "Could not load your orders.");
      setOrders(response.data.orders || []);
      setPagination(response.data.pagination || { page, totalPages: 0, totalOrders: 0 });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not load your orders.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  async function submitOrderAction(event) {
    event.preventDefault();
    if (!action) return;
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      let response;
      if (action.type === "cancel") {
        response = await API.patch(`/profile/orders/${action.order._id}/cancel`, { reason });
      } else if (action.type === "cancel-item") {
        response = await API.patch(
          `/profile/orders/${action.order._id}/items/${action.itemIndex}/cancel`,
          { reason },
        );
      } else {
        const body = new FormData();
        body.append("reason", reason);
        body.append("description", returnDescription);
        body.append("itemIndex", String(action.itemIndex));
        returnImages.forEach((image) => body.append("images", image));
        response = await API.post(`/profile/orders/${action.order._id}/return`, body);
      }
      if (!isSuccess(response))
        throw new Error(response.data?.message || "Could not update this order.");
      setAction(null);
      setReason("");
      setReturnDescription("");
      setReturnImages([]);
      setSuccessMessage(response.data?.message || "Order updated.");
      await loadOrders();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not update this order.",
      );
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(pagination.totalPages, 1);

  return (
    <main className="orders-page">
      <header className="orders-page__header">
        <div>
          <p className="orders-eyebrow">YOUR ACCOUNT</p>
          <h1>Orders &amp; tracking</h1>
          <p className="orders-page__intro">
            Review your purchases and follow each order’s progress.
          </p>
        </div>
        <div className="orders-count">
          <span>Total orders</span>
          <strong>{pagination.totalOrders}</strong>
        </div>
      </header>

      <section className="orders-panel" aria-label="Your orders">
        <form className="orders-toolbar" onSubmit={handleSearch}>
          <label className="orders-search">
            <span className="sr-only">Search orders</span>
            <input
              name="search-input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by order number or product"
            />
          </label>
          <button className="orders-button orders-button--primary" type="submit">
            Search
          </button>
          <button className="orders-button" type="button" onClick={clearSearch}>
            Clear
          </button>
          <label className="orders-status-filter">
            <span>Status</span>
            <select
              name="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All orders</option>
              {ORDER_STEPS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              <option value="Cancelled">Cancelled</option>
            </select>
          </label>
        </form>

        {error && (
          <p className="orders-message orders-message--error" role="alert">
            {error}
          </p>
        )}
        {successMessage && (
          <p className="orders-message orders-message--success" role="status">
            {successMessage}
          </p>
        )}
        {loading ? (
          <p className="orders-message" role="status">
            Loading your orders…
          </p>
        ) : orders.length === 0 ? (
          <div className="orders-empty">
            <h2>{search || status !== "all" ? "No matching orders" : "No orders yet"}</h2>
            <p>
              {search || status !== "all"
                ? "Try another search or status."
                : "Your completed checkouts will appear here."}
            </p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const expanded = expandedOrderId === order._id;
              const activeItems = (order.items || []).filter((item) => !item.isCancelled);
              const canCancel =
                activeItems.length > 0 &&
                activeItems.every((item) =>
                  ["Pending", "Confirmed"].includes(item.fulfillmentStatus || order.orderStatus),
                );
              // If every non-cancelled item is Returned, show "Returned" on the badge
              const allItemsReturned =
                activeItems.length > 0 &&
                activeItems.every((item) => item.fulfillmentStatus === "Returned");
              const displayStatus = allItemsReturned ? "Returned" : order.orderStatus;
              // Only show the return hint if at least one item can still be returned
              const hasReturnableItem = activeItems.some(
                (item) =>
                  (item.fulfillmentStatus || order.orderStatus) === "Delivered" &&
                  !["Requested", "Accepted", "Rejected"].includes(
                    item.returnRequest?.status || "None",
                  ),
              );

              return (
                <article className="order-card" key={order._id}>
                  <div className="order-card__top">
                    <div>
                      <span className="orders-eyebrow">ORDER NUMBER</span>
                      <h2>{order.orderNumber}</h2>
                    </div>
                    <span
                      className={`order-status order-status--${displayStatus.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {displayStatus}
                    </span>
                  </div>

                  <div className="order-card__summary">
                    <div>
                      <span>Placed</span>
                      <strong>{formatDate(order.createdAt)}</strong>
                    </div>
                    <div>
                      <span>Items</span>
                      <strong>
                        {order.items?.reduce(
                          (sum, item) => sum + (item.isCancelled ? 0 : item.quantity),
                          0,
                        ) || 0}
                      </strong>
                    </div>
                    <div>
                      <span>Payment</span>
                      <strong>
                        {order.paymentMethod === "COD" ? "Cash on Delivery" : "Razorpay"} ·{" "}
                        {order.paymentStatus}
                      </strong>
                    </div>
                    <div>
                      <span>Total</span>
                      <strong>{formatMoney(order.totalAmount, order.currency)}</strong>
                    </div>
                    {order.refundDestination && order.refundDestination !== "None" && (
                      <div>
                        <span>Refund</span>
                        <strong>
                          {order.refundDestination === "Razorpay"
                            ? "Razorpay → original payment method"
                            : order.refundDestination}{" "}
                          ·{" "}
                          {order.refundStatus ||
                            (order.paymentStatus === "Refunded" ? "Completed" : "Pending")}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className="order-card__items-preview">
                    {(order.items || []).slice(0, 2).map((item, index) => (
                      <span key={`${item.sku}-${index}`}>
                        {item.name} × {item.quantity}
                      </span>
                    ))}
                    {(order.items?.length || 0) > 2 && (
                      <span>+{order.items.length - 2} more item(s)</span>
                    )}
                  </div>

                  <div className="order-card__actions">
                    <button
                      className="orders-button"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedOrderId(expanded ? "" : order._id)}
                    >
                      {expanded ? "Hide details" : "Track order"}
                    </button>
                    <button
                      className="orders-button"
                      type="button"
                      onClick={() => printInvoice(order)}
                    >
                      Invoice / Save PDF
                    </button>
                    {canCancel && (
                      <button
                        className="orders-button orders-button--danger"
                        type="button"
                        onClick={() => {
                          setAction({ type: "cancel", order });
                          setReason("");
                        }}
                      >
                        Cancel order
                      </button>
                    )}
                    {!canCancel &&
                      order.orderStatus !== "Delivered" &&
                      order.orderStatus !== "Cancelled" && (
                        <span className="order-action-hint">
                          Cancellation closes after shipment.
                        </span>
                      )}
                    {order.orderStatus === "Delivered" && hasReturnableItem && (
                      <span className="order-action-hint">
                        Open order details to request a return for an individual item.
                      </span>
                    )}
                  </div>

                  {order.orderStatus === "Cancelled" && order.cancellationReason && (
                    <p className="order-return-state">
                      Cancellation reason: <strong>{order.cancellationReason}</strong>
                    </p>
                  )}

                  {expanded && (
                    <div className="order-details">
                      <section>
                        <h3>Items</h3>
                        <div className="order-detail-items">
                          {(order.items || []).map((item, index) => {
                            const itemReturnStatus = item.returnRequest?.status || "None";
                            const itemStatus = item.isCancelled
                              ? "Cancelled"
                              : item.fulfillmentStatus || order.orderStatus;
                            const itemDeliveredAt =
                              item.deliveredAt || order.deliveredAt || order.updatedAt;
                            const itemReturnDeadline = itemDeliveredAt
                              ? new Date(
                                  new Date(itemDeliveredAt).getTime() + 7 * 24 * 60 * 60 * 1000,
                                )
                              : null;
                            const itemReturnWindowOpen =
                              itemReturnDeadline && Date.now() <= itemReturnDeadline.getTime();
                            const canCancelItem =
                              ["Pending", "Confirmed"].includes(itemStatus) && !item.isCancelled;
                            const canReturnItem =
                              itemStatus === "Delivered" &&
                              itemReturnWindowOpen &&
                              !item.isCancelled &&
                              !["Requested", "Accepted", "Rejected"].includes(itemReturnStatus);
                            return (
                              <div className="order-detail-item" key={`${item.sku}-${index}`}>
                                {item.image && <img src={item.image} alt="" />}
                                <div>
                                  <strong>{item.name}</strong>
                                  <span>
                                    {[item.options?.color, item.options?.storage]
                                      .filter(Boolean)
                                      .join(" · ") ||
                                      item.sku ||
                                      "Product"}{" "}
                                    · Qty {item.quantity} · Status: {itemStatus}
                                  </span>
                                </div>
                                <strong>{formatMoney(item.itemTotal, order.currency)}</strong>
                                {item.refundDestination && item.refundDestination !== "None" && (
                                  <span className="order-item-refund">
                                    Refund: {formatMoney(item.refundAmount, order.currency)} ·{" "}
                                    {item.refundDestination === "Razorpay"
                                      ? "Razorpay / original method"
                                      : item.refundDestination}{" "}
                                    · {item.refundStatus}
                                  </span>
                                )}
                                <div className="order-item-progress">
                                  <strong>Delivery progress</strong>
                                  <OrderTracking
                                    status={itemStatus}
                                    history={item.fulfillmentHistory || []}
                                    createdAt={order.createdAt}
                                    deliveredAt={item.deliveredAt || order.deliveredAt}
                                  />
                                </div>
                                {item.isCancelled ? (
                                  <span className="order-item-cancelled">Cancelled</span>
                                ) : canCancelItem ? (
                                  <button
                                    className="orders-button orders-button--danger"
                                    type="button"
                                    onClick={() => {
                                      setAction({
                                        type: "cancel-item",
                                        order,
                                        item,
                                        itemIndex: index,
                                      });
                                      setReason("");
                                    }}
                                  >
                                    Cancel this product
                                  </button>
                                ) : null}
                                {itemStatus === "Delivered" && (
                                  <div className="order-item-return">
                                    {itemReturnStatus === "Rejected" ? (
                                      <span className="order-return-response">
                                        <strong>Return request rejected:</strong>{" "}
                                        {item.returnRequest?.adminMessage ||
                                          "The return request was rejected."}
                                      </span>
                                    ) : itemReturnStatus === "Accepted" ? (
                                      <span className="order-return-response">
                                        <strong>Return request accepted:</strong>{" "}
                                        {item.returnRequest?.adminMessage ||
                                          "Your return request was accepted."}
                                      </span>
                                    ) : itemReturnStatus === "Requested" ? (
                                      <span className="order-return-response">
                                        Your return request is waiting for review.
                                      </span>
                                    ) : canReturnItem ? (
                                      <>
                                        <button
                                          className="orders-button"
                                          type="button"
                                          onClick={() => {
                                            setAction({
                                              type: "return",
                                              order,
                                              itemIndex: index,
                                              item,
                                            });
                                            setReason("");
                                            setReturnDescription("");
                                            setReturnImages([]);
                                          }}
                                        >
                                          Request return
                                        </button>
                                        <span>
                                          Return this item by {formatDate(itemReturnDeadline)}.
                                        </span>
                                      </>
                                    ) : (
                                      <span>
                                        Return window ended{" "}
                                        {itemReturnDeadline
                                          ? formatDate(itemReturnDeadline)
                                          : "(delivery date unavailable)"}
                                        .
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                      <section>
                        <h3>Delivery address</h3>
                        <p className="order-address">
                          <strong>{order.deliveryAddress?.fullName}</strong>
                          <br />
                          {order.deliveryAddress?.addressLine1}
                          {order.deliveryAddress?.addressLine2
                            ? `, ${order.deliveryAddress.addressLine2}`
                            : ""}
                          <br />
                          {order.deliveryAddress?.city}, {order.deliveryAddress?.state}{" "}
                          {order.deliveryAddress?.postalCode}
                          <br />
                          {order.deliveryAddress?.country} · {order.deliveryAddress?.phone}
                        </p>
                      </section>
                      <section className="order-total-lines">
                        <div>
                          <span>Subtotal</span>
                          <strong>{formatMoney(order.subtotal, order.currency)}</strong>
                        </div>
                        {order.discountAmount > 0 && (
                          <div>
                            <span>Discount</span>
                            <strong>−{formatMoney(order.discountAmount, order.currency)}</strong>
                          </div>
                        )}
                        <div>
                          <span>Delivery</span>
                          <strong>{formatMoney(order.shippingAmount, order.currency)}</strong>
                        </div>
                        <div className="order-total-lines__grand">
                          <span>Total paid / due</span>
                          <strong>{formatMoney(order.totalAmount, order.currency)}</strong>
                        </div>
                      </section>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {!loading && pagination.totalOrders > 0 && (
          <footer className="orders-pagination">
            <span>
              Page {page} of {totalPages} · {pagination.totalOrders} order(s)
            </span>
            <div>
              <button
                className="orders-button"
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <button
                className="orders-button"
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </section>

      {action && (
        <div
          className="orders-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setAction(null);
          }}
        >
          <form className="orders-action-modal" onSubmit={submitOrderAction}>
            <p className="orders-eyebrow">
              {action.type === "cancel-item"
                ? "CANCEL PRODUCT"
                : action.type === "cancel"
                  ? "CANCEL ORDER"
                  : "RETURN REQUEST"}
            </p>
            <h2>
              {action.type === "cancel-item"
                ? "Cancel this product?"
                : action.type === "cancel"
                  ? "Cancel this order?"
                  : "Request a return"}
            </h2>
            <p>
              {action.type === "cancel"
                ? action.order.orderNumber
                : `${action.item?.name || "Product"} · ${action.order.orderNumber}`}
            </p>
            {(action.type === "cancel" || action.type === "cancel-item") &&
              action.order.paymentStatus === "Paid" && (
                <p className="orders-wallet-refund-note">
                  {action.type === "cancel"
                    ? `Your paid amount (${formatMoney(action.order.totalAmount, action.order.currency)}) will be refunded to your ShopEase Wallet.`
                    : "The paid amount for this product will be refunded to your ShopEase Wallet."}
                </p>
              )}
            {action.type === "return" ? (
              <>
                <label>
                  Return reason
                  <select
                    name="reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    required
                  >
                    <option value="">Choose a reason</option>
                    <option value="Damaged item">Damaged item</option>
                    <option value="Defective item">Defective item</option>
                    <option value="Wrong item received">Wrong item received</option>
                    <option value="Missing parts or accessories">
                      Missing parts or accessories
                    </option>
                    <option value="Item not as described">Item not as described</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>
                  Describe the issue
                  <textarea
                    name="description"
                    value={returnDescription}
                    onChange={(event) => setReturnDescription(event.target.value)}
                    maxLength={1000}
                    required
                    rows={4}
                    placeholder="Tell us what happened with this product."
                  />
                </label>
                <label>
                  Add photos (optional, up to 4 images)
                  <input
                    name="images"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      const invalidFile = files.find(
                        (file) =>
                          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
                          file.size > 5 * 1024 * 1024,
                      );
                      if (files.length > 4) {
                        setError("You can attach up to 4 images.");
                        setReturnImages([]);
                      } else if (invalidFile) {
                        setError("Choose JPG, PNG, or WebP images up to 5 MB each.");
                        setReturnImages([]);
                      } else {
                        setError("");
                        setReturnImages(files);
                      }
                    }}
                  />
                  {returnImages.length > 0 && (
                    <small>{returnImages.map((image) => image.name).join(", ")}</small>
                  )}
                </label>
              </>
            ) : (
              <label>
                Reason (optional)
                <textarea
                  name="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  rows={4}
                />
              </label>
            )}
            <div className="orders-action-modal__buttons">
              <button
                className="orders-button"
                type="button"
                disabled={saving}
                onClick={() => setAction(null)}
              >
                Keep order
              </button>
              <button
                className={`orders-button ${action.type === "return" ? "orders-button--primary" : "orders-button--danger"}`}
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Submitting…"
                  : action.type === "cancel-item"
                    ? "Confirm product cancellation"
                    : action.type === "cancel"
                      ? "Confirm cancellation"
                      : "Submit return request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default OrdersPage;
