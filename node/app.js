import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import storeRoutes from "./routes/storeRoutes.js";

const app = express();
const clientOrigin = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/store", storeRoutes);

app.use("/api", (_req, res) => {
  return res.status(404).json({ message: "API endpoint not found." });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res
      .status(400)
      .json({ message: "Request body contains invalid JSON." });
  }
  if (error.name === "MulterError") {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each image file must be 5 MB or smaller."
        : "Could not process the uploaded image files.";
    return res.status(400).json({ message });
  }
  if (error.message === "Upload a JPG, PNG, or WebP image.") {
    return res.status(400).json({ message: error.message });
  }
  console.error("Unhandled API error:", error);
  return res
    .status(500)
    .json({ message: "An unexpected server error occurred." });
});

export default app;
