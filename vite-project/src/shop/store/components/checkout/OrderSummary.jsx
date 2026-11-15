import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { formatPrice } from "../../StoreProductCard.jsx";

function OrderSummary({
  buyNow,
  cart,
  totalAmount,
  appliedCoupon,
  selectedAddress,
  addresses,
  checkoutStep,
  paymentMethod,
  walletBalance,
  placingOrder,
  onContinue,
  onPlaceOrder,
}) {
  const returnTo = buyNow ? "/home/products" : "/home/cart";

  return (
    <aside className="store-panel checkout-summary">
      <span className="store-eyebrow">PAYMENT SUMMARY</span>
      <h2>Order total</h2>
      <div className="checkout-summary__row"><span>Subtotal</span><strong>{formatPrice(cart?.total || 0)}</strong></div>
      <div className="checkout-summary__row"><span>Delivery</span><strong>₹0</strong></div>
      {appliedCoupon && (
        <div className="checkout-summary__row">
          <span>Coupon · {appliedCoupon.code}</span>
          <strong>−{formatPrice((cart?.total || 0) - totalAmount)}</strong>
        </div>
      )}
      <div className="checkout-summary__total"><span>Total payable</span><strong>{formatPrice(totalAmount)}</strong></div>

      {!cart?.canCheckout && <p className="store-cart-summary-note">Fix unavailable items or quantities in your cart before continuing.</p>}
      {!selectedAddress && addresses.length > 0 && <p className="store-cart-summary-note">Select a delivery address to continue.</p>}

      {checkoutStep === 1 ? (
        <button
          className="store-button store-button--primary checkout-continue"
          type="button"
          disabled={!cart?.canCheckout || !selectedAddress}
          onClick={onContinue}
        >Continue</button>
      ) : (
        <button
          className="store-button store-button--primary checkout-continue"
          type="button"
          disabled={!cart?.canCheckout || !selectedAddress || placingOrder || (paymentMethod === "Wallet" && (walletBalance < totalAmount || totalAmount <= 0)) || (paymentMethod === "Razorpay" && totalAmount < 1)}
          onClick={onPlaceOrder}
        >
          {placingOrder
            ? paymentMethod === "Razorpay" ? "Opening payment…" : "Placing order…"
            : paymentMethod === "Razorpay" ? "Pay now" : paymentMethod === "Wallet" ? "Pay with wallet" : "Place order with COD"}
        </button>
      )}
      <Link className="store-cart-back-link" to={returnTo}>{buyNow ? "Return to products" : "Return to cart"}</Link>
    </aside>
  );
}

OrderSummary.propTypes = {
  buyNow: PropTypes.object,
  cart: PropTypes.object,
  totalAmount: PropTypes.number.isRequired,
  appliedCoupon: PropTypes.object,
  selectedAddress: PropTypes.object,
  addresses: PropTypes.arrayOf(PropTypes.object).isRequired,
  checkoutStep: PropTypes.number.isRequired,
  paymentMethod: PropTypes.string.isRequired,
  walletBalance: PropTypes.number.isRequired,
  placingOrder: PropTypes.bool.isRequired,
  onContinue: PropTypes.func.isRequired,
  onPlaceOrder: PropTypes.func.isRequired,
};

export default OrderSummary;
