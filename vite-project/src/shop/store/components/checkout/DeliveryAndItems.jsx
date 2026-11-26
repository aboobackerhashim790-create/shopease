import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { formatPrice } from "../../StoreProductCard.jsx";

function DeliveryAndItems({ addresses, selectedAddressId, onSelectAddress, items }) {
  return (
    <>
      <section className="store-panel checkout-section">
        <div className="checkout-section__heading">
          <div>
            <h2>Delivery address</h2>
            <p className="store-muted">Select where you want your order delivered.</p>
          </div>
          <Link className="store-button" to="/home/account/addresses">
            Add or edit address
          </Link>
        </div>

        {addresses.length === 0 ? (
          <p className="checkout-empty">You haven’t saved an address yet. Add one to continue.</p>
        ) : (
          <div className="checkout-address-list">
            {addresses.map((address) => (
              <label className="checkout-address" key={address._id}>
                <input
                  type="radio"
                  name="deliveryAddress"
                  value={address._id}
                  checked={String(selectedAddressId) === String(address._id)}
                  onChange={() => onSelectAddress(address._id)}
                />
                <span>
                  <strong>
                    {address.label || "Address"}
                    {address.isDefault ? " · Default" : ""}
                  </strong>
                  <span>{address.fullName}</span>
                  <span>{address.phone}</span>
                  <span>
                    {address.addressLine1}
                    {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                  </span>
                  <span>
                    {address.city}, {address.state} {address.postalCode}
                  </span>
                  <span>{address.country}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="store-panel checkout-section">
        <h2>Order items</h2>
        {items.length === 0 ? (
          <p className="checkout-empty">Your cart is empty.</p>
        ) : (
          <div className="checkout-item-list">
            {items.map((item) => (
              <article className="checkout-item" key={item._id}>
                {item.product?.images?.[0] ? (
                  <img src={item.product.images[0]} alt={item.product.name} />
                ) : (
                  <div className="checkout-item__image-empty">Image unavailable</div>
                )}
                <div className="checkout-item__details">
                  <strong>{item.product?.name || "Unavailable product"}</strong>
                  {item.variant && (
                    <span>
                      {[item.variant.options?.color, item.variant.options?.storage]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  <span>Quantity: {item.quantity}</span>
                  {!item.available && <span className="store-unavailable">{item.message}</span>}
                </div>
                <strong>{item.available ? formatPrice(item.itemTotal) : "—"}</strong>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

DeliveryAndItems.propTypes = {
  addresses: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedAddressId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectAddress: PropTypes.func.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default DeliveryAndItems;
