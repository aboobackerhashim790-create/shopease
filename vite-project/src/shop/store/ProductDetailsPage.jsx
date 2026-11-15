import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import API, { isSuccess } from "../../api/client.js";
import StoreProductCard from "./StoreProductCard.jsx";
import { formatPrice } from "./StoreProductCard.jsx";
import "./StorePages.css";

function ProductDetailsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    runProtectedAction,
    refreshShopCounts,
    wishlistIds = [],
  } = useOutletContext();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [variantId, setVariantId] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [magnifier, setMagnifier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    let hasLoaded = false;
    const loadProduct = async () => {
      if (!hasLoaded) setLoading(true);
      setError("");
      try {
        const response = await API.get(
          `/store/products/${encodeURIComponent(slug)}`,
        );
        if (!active) return;
        if (!isSuccess(response)) {
          if (response.status === 404) {
            setError(
              "This product is no longer available. Taking you back to the products…",
            );
            window.setTimeout(
              () => navigate("/home/products", { replace: true }),
              1800,
            );
            return;
          }
          throw new Error(
            response.data.message || "Could not load this product.",
          );
        }
        setProduct(response.data.product);
        setRelatedProducts(response.data.relatedProducts || []);
        setVariantId(response.data.product.variants?.[0]?._id || "");
        setImageIndex(0);
        hasLoaded = true;
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Could not load this product.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProduct();
    // Campaigns can be edited in another tab while this product page stays open.
    // Refresh the product's server-calculated sale price when the shopper returns.
    window.addEventListener("focus", loadProduct);
    return () => {
      active = false;
      window.removeEventListener("focus", loadProduct);
    };
  }, [slug, navigate]);

  const selectedVariant = product?.variants?.find(
    (variant) => variant._id === variantId,
  );
  const images = useMemo(() => {
    const optionImages = selectedVariant?.images || [];
    const mainImages = product?.images || [];
    return optionImages.length ? optionImages : mainImages;
  }, [product, selectedVariant]);

  function handleImageMouseMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    setMagnifier({ x, y });
  }

  const price =
    selectedVariant?.salePrice ?? product?.salePrice ?? selectedVariant?.price ?? product?.price;
  const compareAtPrice =
    selectedVariant?.saleCompareAtPrice ??
    product?.saleCompareAtPrice ??
    selectedVariant?.compareAtPrice ??
    product?.compareAtPrice;
  const stock = selectedVariant?.stockQuantity ?? product?.stockQuantity ?? 0;
  const discount =
    compareAtPrice > price ? Math.round((1 - price / compareAtPrice) * 100) : 0;

  function notifyWishlist(productToToggle) {
    runProtectedAction(() => {
      (async () => {
        const wished = wishlistIds.includes(productToToggle._id);
        const response = wished
          ? await API.delete(`/store/wishlist/items/${productToToggle._id}`)
          : await API.post(`/store/wishlist/items/${productToToggle._id}`);
        if (!isSuccess(response))
          throw new Error(
            response.data.message || "Could not update your wishlist.",
          );
        await refreshShopCounts();
      })().catch((requestError) =>
        setNotice(requestError.response?.data?.message || requestError.message),
      );
    });
  }

  function addToCart(productToAdd = product, optionId = variantId || null) {
    if (!productToAdd) return;
    runProtectedAction(() => {
      (async () => {
        const response = await API.post("/store/cart/items", {
          productId: productToAdd._id,
          variantId: optionId,
          quantity: 1,
        });
        if (!isSuccess(response))
          throw new Error(
            response.data.message || "Could not add this item to your cart.",
          );
        await refreshShopCounts();
        setNotice(`${productToAdd.name} added to your cart.`);
      })().catch((requestError) =>
        setNotice(requestError.response?.data?.message || requestError.message),
      );
    });
  }

  function buyNow() {
    if (!product) return;
    runProtectedAction(() => navigate("/home/checkout", {
      state: {
        buyNow: {
          productId: product._id,
          variantId: variantId || null,
          quantity: 1,
        },
      },
    }));
  }

  if (loading)
    return (
      <section className="store-page">
        <div className="store-panel store-empty">Loading product…</div>
      </section>
    );
  if (error || !product)
    return (
      <section className="store-page">
        <div className="store-error" role="alert">
          {error || "Product not found."}
          <p>
            <Link to="/home/products">Browse available products</Link>
          </p>
        </div>
      </section>
    );

  const isUnavailable = product.variants?.length
    ? !selectedVariant
    : stock <= 0;
  return (
    <section className="store-page">
      <nav className="store-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/home">Home</Link>
        <span>/</span>
        <Link to="/home/products">Products</Link>
        <span>/</span>
        {product.categoryId?.name && (
          <>
            <Link to={`/home/products?categoryId=${product.categoryId._id}`}>
              {product.categoryId.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span>{product.name}</span>
      </nav>

      <div className="store-detail">
        <div className="store-gallery">
          <button
            className="store-gallery__main"
            type="button"
            onClick={() => images[imageIndex] && setZoomed(true)}
            onMouseMove={handleImageMouseMove}
            onMouseLeave={() => setMagnifier(null)}
            aria-label="Zoom product image"
          >
            {images[imageIndex] ? (
              <>
                <img
                  src={images[imageIndex]}
                  alt={`${product.name} image ${imageIndex + 1}`}
                />
                {magnifier && (
                  <span
                    className="store-gallery__magnifier"
                    aria-hidden="true"
                    style={{
                      left: `${magnifier.x}%`,
                      top: `${magnifier.y}%`,
                      backgroundImage: `url("${images[imageIndex]}")`,
                      backgroundPosition: `${magnifier.x}% ${magnifier.y}%`,
                    }}
                  />
                )}
              </>
            ) : (
              <span className="store-muted">No product image</span>
            )}
          </button>
          {images.length > 1 && (
            <div className="store-gallery__thumbs">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  className={index === imageIndex ? "is-selected" : ""}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Show image ${index + 1}`}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="store-detail__info">
          <span className="store-eyebrow">
            {product.brand || product.categoryId?.name || "ShopEase product"}
          </span>
          <h1>{product.name}</h1>
          <div className="store-detail__price">
            <strong>{formatPrice(price)}</strong>
            {compareAtPrice > price && (
              <>
                <del>{formatPrice(compareAtPrice)}</del>
                <span className="store-eyebrow">{discount}% off</span>
              </>
            )}
          </div>
          {product.variants?.length > 0 && (
            <label className="store-field">
              Select option
              <select
                value={variantId}
                onChange={(event) => {
                  setVariantId(event.target.value);
                  setImageIndex(0);
                }}
              >
                {product.variants.map((variant) => (
                  <option key={variant._id} value={variant._id}>
                    {[variant.options?.color, variant.options?.storage]
                      .filter(Boolean)
                      .join(" · ") || variant.sku}{" "}
                    — {formatPrice(variant.salePrice ?? variant.price)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className={`store-stock ${stock <= 3 ? "is-low" : ""}`}>
            {isUnavailable
              ? "Currently unavailable"
              : stock <= 3
                ? `Only ${stock} left in stock`
                : "In stock"}
          </p>
          <p className="store-muted">{product.description}</p>
          {notice && (
            <p className="store-result-line" role="status">
              {notice}
            </p>
          )}
          <div className="store-detail__actions">
            <button
              type="button"
              className="store-button store-button--primary"
              disabled={isUnavailable}
              onClick={() => addToCart()}
            >
              Add to cart
            </button>
            <button
              type="button"
              className="store-button store-button--buy-now"
              disabled={isUnavailable}
              onClick={buyNow}
            >
              Buy now
            </button>
            <button
              type="button"
              className="store-button"
              aria-pressed={wishlistIds.includes(product._id)}
              onClick={() => notifyWishlist(product)}
            >
              {wishlistIds.includes(product._id) ? "♥ Saved" : "♡ Wishlist"}
            </button>
          </div>
          {(product.tags?.length > 0 || product.warranty) && (
            <div className="store-highlights">
              <h2>Highlights</h2>
              <ul>
                {product.tags?.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
                {product.warranty && <li>{product.warranty} warranty</li>}
              </ul>
            </div>
          )}
          {product.specifications &&
            Object.keys(product.specifications).length > 0 && (
              <>
                <h2>Specifications</h2>
                <div className="store-specs">
                  {Object.entries(product.specifications).map(
                    ([key, value]) => (
                      <div key={key}>
                        <strong>{key}</strong>
                        <br />
                        {String(value)}
                      </div>
                    ),
                  )}
                </div>
              </>
            )}
        </div>
      </div>

      <section className="store-related store-page">
        <div className="store-page__heading">
          <div>
            <span className="store-eyebrow">
              MORE FROM {product.categoryId?.name || "THIS CATEGORY"}
            </span>
            <h2>Related products</h2>
          </div>
        </div>
        {relatedProducts.length > 0 ? (
          <div className="store-product-grid">
            {relatedProducts.map((related) => (
              <StoreProductCard
                key={related._id}
                product={related}
                wished={wishlistIds.includes(related._id)}
                onAdd={addToCart}
                onBuyNow={(relatedProduct, optionId) =>
                  runProtectedAction(() => navigate("/home/checkout", {
                    state: { buyNow: { productId: relatedProduct._id, variantId: optionId || null, quantity: 1 } },
                  }))
                }
                onToggleWishlist={notifyWishlist}
              />
            ))}
          </div>
        ) : (
          <div className="store-panel store-empty">
            There are no other available products in this category yet.
          </div>
        )}
      </section>
      {zoomed && images[imageIndex] && (
        <button
          className="store-zoom"
          type="button"
          aria-label="Close zoomed image"
          onClick={() => setZoomed(false)}
        >
          <img src={images[imageIndex]} alt={product.name} />
        </button>
      )}
    </section>
  );
}

export default ProductDetailsPage;
