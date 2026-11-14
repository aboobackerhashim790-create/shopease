import mongoose from "mongoose";

const offerCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, default: "", maxlength: 300 },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator(value) {
          return this.discountType !== "percentage" || value <= 99;
        },
        message: "Percentage discounts cannot exceed 99%.",
      },
    },
    appliesTo: { type: String, enum: ["all", "category", "product"], required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "category", default: null },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "product", default: null },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("OfferCampaign", offerCampaignSchema);
