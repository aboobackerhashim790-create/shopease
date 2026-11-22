import mongoose from "mongoose";
import Counter from "../models/Counter.js";

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.")
  }

  await mongoose.connect(uri);
  await Counter.updateOne(
    { _id: "orderNumber" },
    { $setOnInsert: { sequence: 999 } },
    { upsert: true },
  );
  console.log("Connected to MongoDB.");
}

export default connectDatabase;
