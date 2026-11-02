import multer from "multer";

const uploadProfileImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return callback(new Error("Upload a JPG, PNG, or WebP image."));
    }
    callback(null, true);
  },
});

export default uploadProfileImage;
