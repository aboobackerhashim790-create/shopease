import PropTypes from "prop-types";
import { Link } from "react-router-dom";

export function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "Price unavailable";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function StoreProductCard({
  product,
  wished,
  available = true,
  onAdd,
  onBuyNow,
  onToggleWishlist,
}) {
  const variants = product.variants || [];
  const price =
    product.listingPrice ??
    (variants.length
      ? Math.min(...variants.map((variant) => variant.salePrice ?? variant.price))
      : product.salePrice ?? product.price);
  const startingVariant = variants.find(
    (variant) => (variant.salePrice ?? variant.price) === price,
  );
  const compareAtPrice =
    startingVariant?.saleCompareAtPrice ??
    product.saleCompareAtPrice ??
    startingVariant?.compareAtPrice ??
    product.compareAtPrice;
  const image = product.images?.[0] || startingVariant?.images?.[0];

  return (
    <article className="store-product-card">
      <div className="store-product-card__image-wrap">
        <Link
          to={`/home/products/${product.slug}`}
          aria-label={`View ${product.name}`}
        >
          {image ? (
            <img src={image} alt={product.name} />
          ) : (
            <div className="store-product-card__image-empty">No image</div>
          )}
        </Link>
        <button
          type="button"
          className={`store-heart ${wished ? "is-wished" : ""}`}
          aria-label={
            wished
              ? `Remove ${product.name} from wishlist`
              : `Add ${product.name} to wishlist`
          }
          aria-pressed={wished}
          onClick={() => onToggleWishlist(product)}
        >
          {wished ? "♥" : "♡"}
        </button>
      </div>
      <div className="store-product-card__body">
        <small>{product.categoryId?.name || "Gadget"}</small>
        <Link
          className="store-product-card__name"
          to={`/home/products/${product.slug}`}
        >
          {product.name}
        </Link>
        <div className="store-product-card__price-row">
          <strong>
            {variants.length > 0
              ? `From ${formatPrice(price)}`
              : formatPrice(price)}
          </strong>
          {compareAtPrice > price && <del>{formatPrice(compareAtPrice)}</del>}
        </div>
        {variants.length > 0 ? (
          <Link
            className={`store-button store-button--primary store-product-card__add ${!available ? "is-disabled" : ""}`}
            to={`/home/products/${product.slug}`}
            aria-disabled={!available}
          >
            {available ? "Choose options" : "Unavailable"}
          </Link>
        ) : (
          <div className="store-product-card__actions">
            <button
              type="button"
              className="store-button store-button--primary store-product-card__add"
              disabled={!available}
              onClick={() => onAdd(product, null)}
            >
              {available ? "Add to cart" : "Unavailable"}
            </button>
            <button
              type="button"
              className="store-button store-product-card__buy-now"
              disabled={!available}
              onClick={() => onBuyNow?.(product, null)}
            >
              Buy now
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const variantShape = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  sku: PropTypes.string,
  options: PropTypes.shape({
    color: PropTypes.string,
    storage: PropTypes.string,
  }),
  price: PropTypes.number,
  compareAtPrice: PropTypes.number,
  salePrice: PropTypes.number,
  saleCompareAtPrice: PropTypes.number,
  stockQuantity: PropTypes.number,
  images: PropTypes.arrayOf(PropTypes.string),
});

StoreProductCard.propTypes = {
  product: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    categoryId: PropTypes.shape({ name: PropTypes.string }),
    variants: PropTypes.arrayOf(variantShape),
    listingPrice: PropTypes.number,
    price: PropTypes.number,
    compareAtPrice: PropTypes.number,
    salePrice: PropTypes.number,
    saleCompareAtPrice: PropTypes.number,
    images: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  wished: PropTypes.bool,
  available: PropTypes.bool,
  onAdd: PropTypes.func.isRequired,
  onBuyNow: PropTypes.func,
  onToggleWishlist: PropTypes.func.isRequired,
};
