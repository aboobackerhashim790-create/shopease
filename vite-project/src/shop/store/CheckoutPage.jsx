import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import API, { isSuccess } from "../../api/client.js";
import { formatPrice } from "./StoreProductCard.jsx";
import { loadRazorpayCheckout } from "./services/razorpayCheckout.js";
import DeliveryAndItems from "./components/checkout/DeliveryAndItems.jsx";
import PaymentAndOffers from "./components/checkout/PaymentAndOffers.jsx";
import OrderSummary from "./components/checkout/OrderSummary.jsx";
import "./StorePages.css";

function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authLoaded } = useOutletContext();
  const buyNow = location.state?.buyNow || null;

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [cart, setCart] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const orderAttemptKey = useRef("");
  const walletAttemptKey = useRef("");
  const razorpayAttemptKey = useRef("");
  const pendingRazorpayOrderId = useRef("");
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponIsError, setCouponIsError] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);

  useEffect(() => {
    if (!authLoaded) return;

    if (!user) {
      navigate("/auth/login", { state: { from: location }, replace: true });
      return;
    }

    let isMounted = true;

    async function loadCheckout() {
      try {
        const response = await API.get("/store/checkout", {
          params: buyNow ? { buyNow: "true", ...buyNow } : undefined,
        });

        if (!isSuccess(response)) {
          throw new Error(response.data.message || "Could not load checkout information.");
        }

        if (!isMounted) return;

        setAddresses(response.data.addresses || []);
        setSelectedAddressId(response.data.selectedAddressId || "");
        setCart(response.data.cart || null);
        setTotalAmount(response.data.totalAmount || 0);
        setWalletBalance(response.data.walletBalance || 0);

        try {
          const couponResponse = await API.get("/store/coupons/available", {
            params: buyNow ? { buyNow: "true", ...buyNow } : undefined,
          });
          if (isMounted && isSuccess(couponResponse)) {
            setAvailableCoupons(couponResponse.data.coupons || []);
          }
        } catch {
          if (isMounted) setAvailableCoupons([]);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Could not load checkout information.",
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCheckout();

    return () => {
      isMounted = false;
    };
  }, [authLoaded, user, location, navigate, buyNow]);
  async function handlePlaceOrder() {
    setError("");

    if (paymentMethod === "Razorpay") {
      await handleRazorpayPayment();
      return;
    }

    if (!selectedAddressId) {
      setError("Please choose a delivery address.");
      return;
    }
    if (paymentMethod === "Wallet" && walletBalance < totalAmount) {
      setError("Your ShopEase Wallet does not have enough balance for this order.");
      return;
    }

    setPlacingOrder(true);

    try {
      // Keep the same key if this request needs to be retried.
      let response;
      if (paymentMethod === "COD" && pendingRazorpayOrderId.current) {
        response = await API.post("/store/orders/razorpay/convert-to-cod", {
          orderId: pendingRazorpayOrderId.current,
        });
      } else {
        const attemptKey = paymentMethod === "Wallet" ? walletAttemptKey : orderAttemptKey;
        if (!attemptKey.current) attemptKey.current = crypto.randomUUID();
        response = await API.post(
          paymentMethod === "Wallet" ? "/store/orders/wallet" : "/store/orders/cod",
          {
            addressId: selectedAddressId,
            idempotencyKey: attemptKey.current,
            couponCode: appliedCoupon?.code || "",
            ...(buyNow ? { buyNow } : {}),
          },
        );
      }

      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not place your order.");
      }

      navigate("/home/order-confirmation", {
        replace: true,
        state: { order: response.data.order },
      });
      if (paymentMethod === "Wallet") walletAttemptKey.current = "";
      else orderAttemptKey.current = "";
      pendingRazorpayOrderId.current = "";
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not place your order.",
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  async function handleRazorpayPayment() {
    if (!selectedAddressId) {
      setError("Please choose a delivery address.");
      return;
    }

    setPlacingOrder(true);
    setError("");

    try {
      await loadRazorpayCheckout();
      if (!razorpayAttemptKey.current) {
        razorpayAttemptKey.current = crypto.randomUUID();
      }

      const orderResponse = await API.post("/store/orders/razorpay", {
        addressId: selectedAddressId,
        idempotencyKey: razorpayAttemptKey.current,
        couponCode: appliedCoupon?.code || "",
        ...(buyNow ? { buyNow } : {}),
      });
      if (!isSuccess(orderResponse)) {
        throw new Error(orderResponse.data.message || "Could not start online payment.");
      }

      const paymentOrder = orderResponse.data;
      pendingRazorpayOrderId.current = paymentOrder.orderId;
      const checkout = new window.Razorpay({
        key: paymentOrder.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "ShopEase",
        description: `Order ${paymentOrder.orderNumber}`,
        order_id: paymentOrder.razorpayOrderId,
        prefill: {
          name: selectedAddress?.fullName || user?.fullName || "",
          email: user?.email || "",
          contact: selectedAddress?.phone || "",
        },
        notes: { orderNumber: paymentOrder.orderNumber },
        theme: { color: "#124b3c" },
        handler: async (paymentResult) => {
          setPlacingOrder(true);
          setError("");
          try {
            const verifyResponse = await API.post("/store/orders/razorpay/verify", {
              orderId: paymentOrder.orderId,
              ...paymentResult,
            });
            if (!isSuccess(verifyResponse)) {
              throw new Error(verifyResponse.data.message || "Could not verify your payment.");
            }
            navigate("/home/order-confirmation", {
              replace: true,
              state: { order: verifyResponse.data.order },
            });
            razorpayAttemptKey.current = "";
            pendingRazorpayOrderId.current = "";
          } catch (verifyError) {
            setError(
              verifyError.response?.data?.message ||
                verifyError.message ||
                "Payment could not be verified. Please contact support before trying again.",
            );
          } finally {
            setPlacingOrder(false);
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              const cancelResponse = await API.post("/store/orders/razorpay/cancelled", {
                orderId: paymentOrder.orderId,
                razorpayOrderId: paymentOrder.razorpayOrderId,
              });
              if (!isSuccess(cancelResponse)) {
                throw new Error(
                  cancelResponse.data.message || "Could not update the payment status.",
                );
              }
              setError(
                "Payment was cancelled. Your order is still pending; you can retry payment.",
              );
            } catch (cancelError) {
              setError(
                cancelError.response?.data?.message ||
                  cancelError.message ||
                  "Payment window closed, but its status could not be updated. Refresh your orders before retrying.",
              );
            }
            setPlacingOrder(false);
          },
        },
      });

      checkout.on("payment.failed", async (failure) => {
        const failedPaymentId = failure.error?.metadata?.payment_id;
        if (failedPaymentId) {
          try {
            await API.post("/store/orders/razorpay/failed", {
              orderId: paymentOrder.orderId,
              razorpayOrderId: paymentOrder.razorpayOrderId,
              razorpayPaymentId: failedPaymentId,
            });
          } catch {
            // A failed payment can still be retried even if this status update fails.
          }
        }
        setError(
          failure.error?.description ||
            "Payment failed. You can retry without creating another order.",
        );
        setPlacingOrder(false);
      });

      setPlacingOrder(false);
      checkout.open();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not start online payment.",
      );
      setPlacingOrder(false);
    }
  }
  if (loading) {
    return (
      <section className="store-page">
        <div className="store-panel store-empty">Loading checkout…</div>
      </section>
    );
  }

  const items = cart?.items || [];
  const selectedAddress = addresses.find(
    (address) => String(address._id) === String(selectedAddressId),
  );

  function continueToPayment() {
    setError("");
    if (!selectedAddress) {
      setError("Please choose a delivery address.");
      return;
    }
    if (!cart?.canCheckout) {
      setError("Please fix the unavailable cart items before continuing.");
      return;
    }
    setCheckoutStep(2);
  }

  async function applyCoupon(code) {
    const rawCode = typeof code === "string" ? code : couponCode;
    const codeToApply = (rawCode || "").trim();
    if (!codeToApply) {
      setCouponMessage("Please enter a coupon code.");
      setCouponIsError(true);
      setAppliedCoupon(null);
      setTotalAmount(cart?.total || 0);
      return;
    }
    setCouponCode(codeToApply);
    setCouponMessage("Checking coupon…");
    setCouponIsError(false);
    try {
      const response = await API.post("/store/coupons/validate", {
        code: codeToApply,
        ...(buyNow ? { buyNow } : {}),
      });
      if (!isSuccess(response)) {
        throw new Error(response.data?.message || "Invalid coupon code.");
      }
      setAppliedCoupon(response.data.coupon);
      setTotalAmount(response.data.totalAmount);
      setCouponMessage(
        `Coupon ${response.data.coupon.code} applied. You save ${formatPrice(response.data.discountAmount)}.`,
      );
      setCouponIsError(false);
    } catch (requestError) {
      setAppliedCoupon(null);
      setTotalAmount(cart?.total || 0);
      const errMsg =
        requestError.response?.data?.message || requestError.message || "Invalid coupon code.";
      setCouponMessage(errMsg);
      setCouponIsError(true);
    }
  }
  return (
    <section className="store-page checkout-page">
      <div className="store-page__heading">
        <div>
          <span className="store-eyebrow">YOUR ORDER</span>
          <h1>Checkout</h1>
          <p className="store-muted">Choose a delivery address and review your items.</p>
        </div>

        <Link className="store-button" to={buyNow ? "/home/products" : "/home/cart"}>
          {buyNow ? "← Back to products" : "← Back to cart"}
        </Link>
      </div>

      {error && (
        <div className="store-error" role="alert">
          {error}
        </div>
      )}

      <div className="checkout-layout">
        <main className="checkout-main">
          {checkoutStep === 1 && (
            <DeliveryAndItems
              addresses={addresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              items={items}
            />
          )}

          {checkoutStep === 2 && (
            <PaymentAndOffers
              onBack={() => setCheckoutStep(1)}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              walletBalance={walletBalance}
              totalAmount={totalAmount}
              couponCode={couponCode}
              onCouponCodeChange={(value) => {
                setCouponCode(value);
                setCouponMessage("");
                setCouponIsError(false);
                setAppliedCoupon(null);
                setTotalAmount(cart?.total || 0);
              }}
              onApplyCoupon={applyCoupon}
              couponMessage={couponMessage}
              couponIsError={couponIsError}
              availableCoupons={availableCoupons}
            />
          )}
        </main>
        <OrderSummary
          buyNow={buyNow}
          cart={cart}
          totalAmount={totalAmount}
          appliedCoupon={appliedCoupon}
          selectedAddress={selectedAddress}
          addresses={addresses}
          checkoutStep={checkoutStep}
          paymentMethod={paymentMethod}
          walletBalance={walletBalance}
          placingOrder={placingOrder}
          onContinue={continueToPayment}
          onPlaceOrder={handlePlaceOrder}
        />
      </div>
    </section>
  );
}

export default CheckoutPage;
