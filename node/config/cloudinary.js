import cloudinaryPackage from "cloudinary";
const cloudinary = cloudinaryPackage.v2;

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

function configureCloudinary() {
  if (!isCloudinaryConfigured()) return false;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return true;
}

function uploadProfileImage(buffer, userId) {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "shopease/profiles",
          public_id: String(userId),
          overwrite: true,
          resource_type: "image",
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      )
      .end(buffer);
  });
}

function uploadProductImage(buffer) {
  if (!configureCloudinary()) {
    throw new Error("Cloudinary is not configured.");
  }
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "shopease/products",
          resource_type: "image",
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      )
      .end(buffer);
  });
}

async function deleteCloudinaryImage(publicId) {
  if (!publicId || !configureCloudinary()) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

export {
  isCloudinaryConfigured,
  uploadProfileImage,
  uploadProductImage,
  deleteCloudinaryImage,
};
