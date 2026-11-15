/* eslint-disable react/prop-types */

function ProductFormModal({
  editingProduct,
  form,
  setForm,
  categories,
  selectedImageFiles,
  setSelectedImageFiles,
  saving,
  error,
  fieldErrors = {},
  onFieldChange,
  onSubmit,
  onClose,
  onSelectProductImages,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
  onSelectVariantImages,
}) {
  function fieldError(field) {
    return fieldErrors[field] ? (
      <span className="products-inline-error" role="alert">
        {fieldErrors[field]}
      </span>
    ) : null;
  }

  function fieldClass(field) {
    return fieldErrors[field] ? "products-input--invalid" : "";
  }

  return (
    <div className="products-modal-backdrop">
      <form className="products-modal" onSubmit={onSubmit} noValidate>
        <h2>{editingProduct ? "Edit product" : "Create product"}</h2>
        <div className="products-form-grid">
          <label>
            Product name
            <input
              className={fieldClass("name")}
              value={form.name}
              aria-invalid={Boolean(fieldErrors.name)}
              onChange={(event) => onFieldChange("name", event.target.value)}
            />
            {fieldError("name")}
          </label>
          <label>
            Slug
            <input
              className={fieldClass("slug")}
              value={form.slug}
              aria-invalid={Boolean(fieldErrors.slug)}
              onChange={(event) => onFieldChange("slug", event.target.value)}
            />
            {fieldError("slug")}
          </label>
          <label>
            Category
            <select
              className={fieldClass("categoryId")}
              value={form.categoryId}
              aria-invalid={Boolean(fieldErrors.categoryId)}
              onChange={(event) => onFieldChange("categoryId", event.target.value)}
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
            {fieldError("categoryId")}
          </label>
          <label>
            Brand
            <input
              value={form.brand}
              onChange={(event) => onFieldChange("brand", event.target.value)}
            />
          </label>
          <label>
            SKU (optional)
            <input
              value={form.sku}
              onChange={(event) => onFieldChange("sku", event.target.value)}
              disabled={form.variants.length > 0}
            />
          </label>
          <label>
            Price (₹)
            <input
              className={fieldClass("price")}
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              aria-invalid={Boolean(fieldErrors.price)}
              onChange={(event) => onFieldChange("price", event.target.value)}
              // required={form.variants.length === 0}
              disabled={form.variants.length > 0}
            />
            {fieldError("price")}
          </label>
          <label>
            Compare-at price (₹)
            <input
              className={fieldClass("compareAtPrice")}
              type="number"
              min="0"
              step="0.01"
              value={form.compareAtPrice}
              aria-invalid={Boolean(fieldErrors.compareAtPrice)}
              onChange={(event) => onFieldChange("compareAtPrice", event.target.value)}
              disabled={form.variants.length > 0}
            />
            {fieldError("compareAtPrice")}
          </label>
          <label>
            Stock quantity
            <input
              className={fieldClass("stockQuantity")}
              type="number"
              min="0"
              step="1"
              value={form.stockQuantity}
              aria-invalid={Boolean(fieldErrors.stockQuantity)}
              onChange={(event) => onFieldChange("stockQuantity", event.target.value)}
              // required={form.variants.length === 0}
              disabled={form.variants.length > 0}
            />
            {fieldError("stockQuantity")}
          </label>
        </div>
        <label>
          Description
          <textarea
            className={fieldClass("description")}
            rows="4"
            value={form.description}
            aria-invalid={Boolean(fieldErrors.description)}
            onChange={(event) => onFieldChange("description", event.target.value)}
          />
          {fieldError("description")}
        </label>
        <label className="products-image-picker">
          Product images{" "}
          <span className="products-field-hint">
            Choose 2–5 JPG, PNG, or WebP files. They will be uploaded to
            Cloudinary when you save.
          </span>
          <input
            className={fieldClass("images")}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-invalid={Boolean(fieldErrors.images)}
            onChange={onSelectProductImages}
          />
          {fieldError("images")}
        </label>
        {(form.images.length > 0 || selectedImageFiles.length > 0) && (
          <div
            className="products-image-list"
            aria-label="Selected product images"
          >
            {form.images.map((url, index) => (
              <div
                className="products-image-item"
                key={`saved-${url}-${index}`}
              >
                <img src={url} alt={`Product image ${index + 1}`} />
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      images: current.images.filter(
                        (_, imageIndex) => imageIndex !== index,
                      ),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {selectedImageFiles.map((file, index) => (
              <div
                className="products-image-item products-image-item--file"
                key={`${file.name}-${file.lastModified}-${index}`}
              >
                <span>{file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedImageFiles((current) =>
                      current.filter((_, fileIndex) => fileIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <section className="product-variants-section">
          <div className="product-variants-heading">
            <div>
              <h3>Variants</h3>
              <p>
                Add options such as color or storage. Each variant has its own
                SKU, price, and stock.
              </p>
            </div>
            <button
              className="products-secondary-button"
              type="button"
              onClick={onAddVariant}
            >
              Add variant
            </button>
          </div>
          {form.variants.map((variant, index) => (
            <fieldset className="product-variant-card" key={`variant-${index}`}>
              <legend>Variant {index + 1}</legend>
              <div className="products-form-grid">
                <label>
                  Variant SKU
                  <input
                    className={fieldClass(`variants.${index}.sku`)}
                    value={variant.sku}
                    aria-invalid={Boolean(fieldErrors[`variants.${index}.sku`])}
                    onChange={(event) =>
                      onUpdateVariant(index, "sku", event.target.value)
                    }
                  />
                  {fieldError(`variants.${index}.sku`)}
                </label>
                <label>
                  Color
                  <input
                    value={variant.color}
                    onChange={(event) =>
                      onUpdateVariant(index, "color", event.target.value)
                    }
                  />
                </label>
                <label>
                  Storage
                  <input
                    value={variant.storage}
                    onChange={(event) =>
                      onUpdateVariant(index, "storage", event.target.value)
                    }
                  />
                </label>
                <label>
                  Price (₹)
                  <input
                    className={fieldClass(`variants.${index}.price`)}
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.price}
                    aria-invalid={Boolean(fieldErrors[`variants.${index}.price`])}
                    onChange={(event) =>
                      onUpdateVariant(index, "price", event.target.value)
                    }
                  />
                  {fieldError(`variants.${index}.price`)}
                </label>
                <label>
                  Compare-at price (₹)
                  <input
                    className={fieldClass(`variants.${index}.compareAtPrice`)}
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.compareAtPrice}
                    aria-invalid={Boolean(fieldErrors[`variants.${index}.compareAtPrice`])}
                    onChange={(event) =>
                      onUpdateVariant(
                        index,
                        "compareAtPrice",
                        event.target.value,
                      )
                    }
                  />
                  {fieldError(`variants.${index}.compareAtPrice`)}
                </label>
                <label>
                  Stock quantity
                  <input
                    className={fieldClass(`variants.${index}.stockQuantity`)}
                    type="number"
                    min="0"
                    step="1"
                    value={variant.stockQuantity}
                    aria-invalid={Boolean(fieldErrors[`variants.${index}.stockQuantity`])}
                    onChange={(event) =>
                      onUpdateVariant(
                        index,
                        "stockQuantity",
                        event.target.value,
                      )
                    }
                  />
                  {fieldError(`variants.${index}.stockQuantity`)}
                </label>
              </div>
              <label className="products-variant-active-control">
                <input
                  type="checkbox"
                  checked={variant.active}
                  onChange={(event) =>
                    onUpdateVariant(index, "active", event.target.checked)
                  }
                />
                Listed on store
              </label>
              <label className="products-image-picker">
                Variant images{" "}
                <span className="products-field-hint">
                  Optional. Choose up to 5 JPG, PNG, or WebP files; they upload
                  to Cloudinary when you save.
                </span>
                <input
                  className={fieldClass(`variants.${index}.images`)}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  aria-invalid={Boolean(fieldErrors[`variants.${index}.images`])}
                  onChange={(event) => onSelectVariantImages(index, event)}
                />
                {fieldError(`variants.${index}.images`)}
              </label>
              {(variant.images.length > 0 || variant.imageFiles.length > 0) && (
                <div
                  className="products-image-list"
                  aria-label={`Images for variant ${index + 1}`}
                >
                  {variant.images.map((url, imageIndex) => (
                    <div
                      className="products-image-item"
                      key={`variant-saved-${url}-${imageIndex}`}
                    >
                      <img
                        src={url}
                        alt={`Variant ${index + 1} image ${imageIndex + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateVariant(
                            index,
                            "images",
                            variant.images.filter(
                              (_, currentIndex) => currentIndex !== imageIndex,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {variant.imageFiles.map((file, fileIndex) => (
                    <div
                      className="products-image-item products-image-item--file"
                      key={`${file.name}-${file.lastModified}-${fileIndex}`}
                    >
                      <span>{file.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateVariant(
                            index,
                            "imageFiles",
                            variant.imageFiles.filter(
                              (_, currentIndex) => currentIndex !== fileIndex,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="products-danger-text-button"
                type="button"
                onClick={() => onRemoveVariant(index)}
              >
                Remove variant
              </button>
            </fieldset>
          ))}
        </section>
        <label className="products-featured-control">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(event) =>
              setForm({ ...form, isFeatured: event.target.checked })
            }
          />{" "}
          Featured product
        </label>
        {error && (
          <p className="products-error" role="alert">
            {error}
          </p>
        )}
        <div className="products-modal-actions">
          <button
            className="products-secondary-button"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="products-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : editingProduct
                ? "Save changes"
                : "Create product"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProductFormModal;
