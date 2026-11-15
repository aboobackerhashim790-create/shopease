import PropTypes from "prop-types";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

function ProductCropModal({
  activeCropItem,
  cropPreviewUrl,
  cropQueueLength,
  cropPosition,
  setCropPosition,
  cropZoom,
  setCropZoom,
  croppedAreaPixels,
  setCroppedAreaPixels,
  cropping,
  onCancel,
  onSkip,
  onUseCrop,
}) {
  if (!activeCropItem || !cropPreviewUrl) return null;

  return (
    <div className="products-modal-backdrop products-crop-backdrop">
      <section
        className="products-crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-dialog-title"
      >
        <h2 id="crop-dialog-title">Crop image</h2>
        <p className="products-crop-filename">
          {activeCropItem.file.name} · {cropQueueLength} image
          {cropQueueLength === 1 ? "" : "s"} to crop
        </p>
        <div className="products-crop-area">
          <Cropper
            image={cropPreviewUrl}
            crop={cropPosition}
            zoom={cropZoom}
            aspect={1}
            onCropChange={setCropPosition}
            onZoomChange={setCropZoom}
            onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
          />
        </div>
        <label className="products-crop-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={cropZoom}
            onChange={(event) => setCropZoom(Number(event.target.value))}
          />
        </label>
        <div className="products-modal-actions">
          <button
            type="button"
            className="products-secondary-button"
            disabled={cropping}
            onClick={onCancel}
          >
            Cancel cropping
          </button>
          <button
            type="button"
            className="products-secondary-button"
            disabled={cropping}
            onClick={onSkip}
          >
            Skip photo
          </button>
          <button
            type="button"
            className="products-primary-button"
            disabled={cropping || !croppedAreaPixels}
            onClick={onUseCrop}
          >
            {cropping ? "Cropping…" : "Use cropped image"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ProductDeleteModal({ product, onCancel, onConfirm }) {
  if (!product) return null;

  return (
    <div className="products-modal-backdrop">
      <div className="products-confirm-modal">
        <h2>Delete product permanently?</h2>
        <p>
          This permanently removes <strong>{product.name}</strong>. If it
          appears in past orders, consider unlisting it instead.
        </p>
        <div className="products-modal-actions">
          <button
            className="products-secondary-button"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="products-danger-button"
            type="button"
            onClick={onConfirm}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

ProductCropModal.propTypes = {
  activeCropItem: PropTypes.shape({
    file: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
  }),
  cropPreviewUrl: PropTypes.string.isRequired,
  cropQueueLength: PropTypes.number.isRequired,
  cropPosition: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
  setCropPosition: PropTypes.func.isRequired,
  cropZoom: PropTypes.number.isRequired,
  setCropZoom: PropTypes.func.isRequired,
  croppedAreaPixels: PropTypes.object,
  setCroppedAreaPixels: PropTypes.func.isRequired,
  cropping: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
  onUseCrop: PropTypes.func.isRequired,
};

ProductDeleteModal.propTypes = {
  product: PropTypes.shape({ name: PropTypes.string.isRequired }),
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

export { ProductCropModal, ProductDeleteModal };
