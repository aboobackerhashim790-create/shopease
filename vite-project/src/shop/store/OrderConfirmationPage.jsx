import { Link, useLocation } from "react-router-dom";
import { formatPrice } from "./StoreProductCard.jsx";
import "./StorePages.css";

function OrderConfirmationPage() {
  const { state } = useLocation();
  const order = state?.order;

  return (
    <main className="store-page order-confirmation">
      <section className="store-panel order-confirmation__card" aria-live="polite">
        <div className="order-confirmation__mark" aria-hidden="true">✓</div>
        <span className="store-eyebrow">ORDER UPDATE</span>
        <h1>{order ? "Thank you for your order" : "Order details"}</h1>
        <p className="store-muted">
          {order
            ? "Your order has been placed. You can follow its progress from your account."
            : "Order information is not available in this page session. Check your orders for the latest status."}
        </p>

        {order && (
          <dl className="order-confirmation__summary">
            {order.orderNumber && (
              <div>
                <dt>Order number</dt>
                <dd>{order.orderNumber}</dd>
              </div>
            )}
            {order.orderStatus && (
              <div>
                <dt>Status</dt>
                <dd>{order.orderStatus}</dd>
              </div>
            )}
            {Number.isFinite(Number(order.totalAmount)) && (
              <div>
                <dt>Total</dt>
                <dd>{formatPrice(order.totalAmount)}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="order-confirmation__actions">
          <Link className="store-button store-button--primary" to="/home/products">
            Continue shopping
          </Link>
          <Link className="store-button" to="/home/account/orders">
            View your orders
          </Link>
        </div>
      </section>
    </main>
  );
}

export default OrderConfirmationPage;
