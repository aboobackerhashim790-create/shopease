import { useCallback, useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom";
import API, { isSuccess } from "../../api/client.js";
import { formatPrice } from "./StoreProductCard.jsx";
import "./StorePages.css";

function CartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authLoaded, refreshShopCounts } = useOutletContext();
  const [cart, setCart] = useState(null);
  const [maxCartItems, setMaxCartItems] = useState(9);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  const loadCart = useCallback(async () => {
    const response = await API.get("/store/cart");
    if (response.status === 401) {
      navigate("/auth/login", { state: { from: location }, replace: true });
      return;
    }
    if (!isSuccess(response))
      throw new Error(response.data.message || "Could not load your cart.");
    setCart(response.data.cart);
    setMaxCartItems(response.data.maxCartItems || 9);
  }, [location, navigate]);

  useEffect(() => {
    if (!authLoaded) return;
    if (!user) {
      navigate("/auth/login", { state: { from: location }, replace: true });
      return;
    }
    let active = true;
    setLoading(true);
    loadCart()
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authLoaded, user, location, navigate, loadCart]);

  async function changeQuantity(item, quantity) {
    setBusyId(item._id);
    setError("");
    try {
      const response =
        quantity < 1
          ? await API.delete(`/store/cart/items/${item._id}`)
          : await API.patch(`/store/cart/items/${item._id}`, { quantity });
      if (!isSuccess(response))
        throw new Error(
          response.data.message || "Could not update this cart item.",
        );
      setCart(response.data.cart);
      setMaxCartItems(response.data.maxCartItems || maxCartItems);
      await refreshShopCounts();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        "Could not update your cart.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function handleCheckoutValidation() {
    setError("");
    setNotice("");
    setCheckingOut(true);

    try {
      const response = await API.post("/store/checkout/validate");

      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not verify your cart.");
      }

      const validatedCart = response.data.cart;
      setCart(validatedCart);

      navigate("/home/checkout", {
        state: { cart: validatedCart },
      });
    } catch (requestError) {
      const latestCart = requestError.response?.data?.cart;

      if (latestCart) {
        setCart(latestCart);
      }

      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        "Could not verify your cart.",
      );
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <section className="store-page">
        <div className="store-panel store-empty">Loading your cart…</div>
      </section>
    );
  }

  const cartItems = cart?.items || [];
  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  return (
    <section className="store-page store-cart-page">
      <div className="store-page__heading store-cart-heading">
        <div>
          <span className="store-eyebrow">YOUR SHOPPING BAG</span>
          <h1>Your cart</h1>
          <p className="store-muted">
            Review your items and quantities before checkout.
          </p>
        </div>
        <Link className="store-button" to="/home/products">
          ← Continue shopping
        </Link>
      </div>

      {error && (
        <div className="store-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="store-notice" role="status">
          {notice}
        </div>
      )}

      {cartItems.length === 0 ? (
        <div className="store-cart-empty store-panel">
          <span className="store-cart-empty__icon" aria-hidden="true">
            🛍
          </span>
          <h2>Your cart is waiting for something good</h2>
          <p className="store-muted">
            Explore the catalog and add a product when you find the right one.
          </p>
          <Link
            className="store-button store-button--primary"
            to="/home/products"
          >
            Browse products
          </Link>
          <button
            className="store-button store-button--primary store-cart-checkout"
            type="button"
            disabled={!cart.canCheckout || checkingOut}
            onClick={handleCheckoutValidation}
          >
            {checkingOut ? "Checking cart…" : "Continue to checkout"}
          </button>
        </div>
      ) : (
        <div className="store-cart-layout">
          <div className="store-cart-main">
            <div className="store-cart-list-heading">
              <h2>Your items</h2>
              <span>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            {cart.hasInvalidItems && (
              <div className="store-cart-warning" role="alert">
                <strong>Some items need attention</strong>
                <span>
                  Stock may have changed. Reduce the quantity or remove
                  unavailable items to continue.
                </span>
              </div>
            )}
            {cart.exceedsMaximum && (
              <div className="store-cart-warning" role="alert">
                <strong>Your cart is over the {maxCartItems}-item limit</strong>
                <span>
                  Reduce quantities or remove items until the cart contains no
                  more than {maxCartItems} units.
                </span>
              </div>
            )}
            <div className="store-cart-list">
              {cartItems.map((item) => {
                const canIncrease =
                  item.available &&
                  cart.totalQuantity < maxCartItems &&
                  item.quantity < item.availableStock;
                return (
                  <article
                    className={`store-cart-item ${!item.available ? "is-invalid" : ""}`}
                    key={item._id}
                  >
                    {item.product?.images?.[0] ? (
                      <img
                        className="store-cart-item__image"
                        src={item.product.images[0]}
                        alt={item.product.name}
                      />
                    ) : (
                      <div className="store-cart-item__image store-cart-item__image--empty">
                        Image unavailable
                      </div>
                    )}
                    <div className="store-cart-item__details">
                      {item.product ? (
                        <Link
                          className="store-cart-item__title"
                          to={`/home/products/${item.product.slug}`}
                        >
                          {item.product.name}
                        </Link>
                      ) : (
                        <strong className="store-cart-item__title">
                          Unavailable product
                        </strong>
                      )}
                      {item.variant && (
                        <p className="store-cart-item__variant">
                          {[
                            item.variant.options?.color,
                            item.variant.options?.storage,
                          ]
                            .filter(Boolean)
                            .join(" · ") || item.variant.sku}
                        </p>
                      )}
                      {item.available ? (
                        <p className="store-cart-stock">
                          {item.availableStock} available
                        </p>
                      ) : (
                        <p className="store-unavailable">{item.message}</p>
                      )}
                      <div
                        className="store-cart-item__controls"
                        aria-label="Quantity controls"
                      >
                        <div className="store-quantity-stepper">
                          <button
                            type="button"
                            aria-label={`Decrease ${item.product?.name || "item"} quantity`}
                            disabled={busyId === item._id}
                            onClick={() =>
                              changeQuantity(item, item.quantity - 1)
                            }
                          >
                            −
                          </button>
                          <output aria-live="polite">{item.quantity}</output>
                          <button
                            type="button"
                            aria-label={`Increase ${item.product?.name || "item"} quantity`}
                            disabled={busyId === item._id || !canIncrease}
                            onClick={() =>
                              changeQuantity(item, item.quantity + 1)
                            }
                          >
                            ＋
                          </button>
                        </div>
                        <span className="store-cart-limit">
                          Maximum {maxCartItems} items in cart
                        </span>
                        <button
                          className="store-cart-remove"
                          type="button"
                          disabled={busyId === item._id}
                          onClick={() => changeQuantity(item, 0)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="store-cart-item__pricing">
                      <strong>
                        {item.available ? formatPrice(item.itemTotal) : "—"}
                      </strong>
                      {item.available && (
                        <span>{formatPrice(item.unitPrice)} each</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="store-cart-summary-card">
            <span className="store-eyebrow">ORDER TOTAL</span>
            <h2>Summary</h2>
            <div className="store-cart-summary-row">
              <span>Items ({itemCount})</span>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <div className="store-cart-summary-row">
              <span>Delivery</span>
              <span className="store-muted">Calculated at checkout</span>
            </div>
            <div className="store-cart-summary-total">
              <span>Subtotal</span>
              <strong>{formatPrice(cart.total)}</strong>
            </div>
            <p className="store-cart-summary-note">
              {cart.exceedsMaximum
                ? `Your cart is limited to ${maxCartItems} items total.`
                : cart.hasInvalidItems
                  ? "Unavailable items are excluded from the subtotal."
                  : "Delivery and any applicable taxes are calculated at checkout."}
            </p>
            <button
              className="store-button store-button--primary store-cart-checkout"
              type="button"
              disabled={!cart.canCheckout}
              onClick={handleCheckoutValidation}
            >
              Continue to checkout
            </button>
            {!cart.canCheckout && (
              <p className="store-cart-summary-note">
                Checkout becomes available when every item is in stock.
              </p>
            )}
            <Link className="store-cart-back-link" to="/home/products">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}

export default CartPage;
