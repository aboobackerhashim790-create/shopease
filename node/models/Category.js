import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 160,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    unique: true,
  },
  parentCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "category"
  }, active: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    min: 0,
    default: 0,
  }
}, {
  timestamps: true
})

export default mongoose.model("category", categorySchema)
