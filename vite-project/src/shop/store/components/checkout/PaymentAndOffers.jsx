import { formatPrice } from "../../StoreProductCard.jsx";
import PropTypes from "prop-types";

function PaymentAndOffers({
  onBack,
  paymentMethod,
  onPaymentMethodChange,
  walletBalance,
  totalAmount,
  couponCode,
  onCouponCodeChange,
  onApplyCoupon,
  couponMessage,
  couponIsError = false,
  availableCoupons,
}) {
  return (
    <section className="store-panel checkout-section checkout-payment-section">
      <button className="checkout-back-step" type="button" onClick={onBack}>← Back to address</button>
      <h2>Payment and offers</h2>
      <p className="store-muted">Choose how you want to pay and enter a coupon if you have one.</p>

      <div className="checkout-payment-options">
        <label className="checkout-payment-option">
          <input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === "COD"} onChange={() => onPaymentMethodChange("COD")} />
          <span><strong>Cash on Delivery</strong><small>Pay when your order arrives.</small></span>
        </label>

        <label className={`checkout-payment-option ${walletBalance < totalAmount || totalAmount <= 0 ? "checkout-payment-option--disabled" : ""}`}>
          <input
            type="radio"
            name="paymentMethod"
            value="Wallet"
            checked={paymentMethod === "Wallet"}
            disabled={walletBalance < totalAmount || totalAmount <= 0}
            onChange={() => onPaymentMethodChange("Wallet")}
          />
          <span>
            <strong>ShopEase Wallet</strong>
            <small>
              Balance: {formatPrice(walletBalance)}
              {totalAmount <= 0
                ? " · Wallet payment requires a positive order total"
                : walletBalance < totalAmount
                  ? ` · Need ${formatPrice(totalAmount - walletBalance)} more`
                  : " · Pay using your wallet balance"}
            </small>
          </span>
        </label>

        <label className={`checkout-payment-option ${totalAmount < 1 ? "checkout-payment-option--disabled" : ""}`}>
          <input
            type="radio"
            name="paymentMethod"
            value="Razorpay"
            checked={paymentMethod === "Razorpay"}
            disabled={totalAmount < 1}
            onChange={() => onPaymentMethodChange("Razorpay")}
          />
          <span>
            <strong>Online payment</strong>
            <small>
              {totalAmount < 1
                ? "Online payment requires a total of at least ₹1 · Use Cash on Delivery"
                : "Pay securely using Razorpay."}
            </small>
          </span>
        </label>
      </div>

      <div className="checkout-coupon">
        <label htmlFor="checkout-coupon-code">Coupon code</label>
        <div className="checkout-coupon__controls">
          <input
            id="checkout-coupon-code"
            value={couponCode}
            onChange={(event) => onCouponCodeChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onApplyCoupon(couponCode);
              }
            }}
            placeholder="Enter coupon code"
          />
          <button
            className="store-button"
            type="button"
            onClick={() => onApplyCoupon(couponCode)}
          >
            Apply
          </button>
        </div>
        {couponMessage && (
          <p
            className={`checkout-coupon__message ${couponIsError ? "checkout-coupon__message--error" : "checkout-coupon__message--success"}`}
            role={couponIsError ? "alert" : "status"}
          >
            {couponMessage}
          </p>
        )}
      </div>

      <div className="checkout-available-coupons">
        <h3>Coupons available for you</h3>
        {availableCoupons.length === 0 ? (
          <p className="checkout-coupon__message">No coupons are currently available for this order.</p>
        ) : (
          <div className="checkout-available-coupons__list">
            {availableCoupons.map((coupon) => (
              <article className="checkout-available-coupon" key={coupon._id}>
                <div>
                  <strong>{coupon.code}</strong>
                  <span>
                    {coupon.discountType === "percentage"
                      ? `${coupon.discountValue}% off${coupon.maximumDiscount ? ` (up to ${formatPrice(coupon.maximumDiscount)})` : ""}`
                      : `${formatPrice(coupon.discountValue)} off`}
                  </span>
                  {coupon.description && <small>{coupon.description}</small>}
                  {coupon.firstOrderOnly && <small>Welcome offer · first order</small>}
                  {coupon.minimumSubtotal > 0 && <small>Minimum order: {formatPrice(coupon.minimumSubtotal)}</small>}
                  {coupon.expiresAt && <small>Expires: {new Date(coupon.expiresAt).toLocaleDateString("en-IN")}</small>}
                </div>
                <button className="store-button" type="button" onClick={() => onApplyCoupon(coupon.code)}>
                  Use coupon
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

PaymentAndOffers.propTypes = {
  onBack: PropTypes.func.isRequired,
  paymentMethod: PropTypes.string.isRequired,
  onPaymentMethodChange: PropTypes.func.isRequired,
  walletBalance: PropTypes.number.isRequired,
  totalAmount: PropTypes.number.isRequired,
  couponCode: PropTypes.string.isRequired,
  onCouponCodeChange: PropTypes.func.isRequired,
  onApplyCoupon: PropTypes.func.isRequired,
  couponMessage: PropTypes.string.isRequired,
  couponIsError: PropTypes.bool,
  availableCoupons: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default PaymentAndOffers;
