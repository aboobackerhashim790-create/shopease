import "../config/loadEnvironment.js";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

const productGroups = [
  {
    categorySlug: "audio-headphones",
    categoryMatch: /audio|headphone/i,
    code: "AUD",
    brand: "ShopEase Audio",
    names: ["Wireless Headphones", "Bluetooth Earbuds", "Portable Speaker", "Noise Cancelling Headset", "USB Microphone"],
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85",
    ],
    basePrice: 1499,
  },
  {
    categorySlug: "computers-accessories",
    categoryMatch: /computer|accessor/i,
    code: "CMP",
    brand: "ShopEase Studio",
    names: ["Mechanical Keyboard", "Wireless Mouse", "Laptop Stand", "USB-C Hub", "HD Webcam"],
    images: [
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85",
    ],
    basePrice: 899,
  },
  {
    categorySlug: "mobile-accessories",
    categoryMatch: /mobile|phone/i,
    code: "MOB",
    brand: "ShopEase Connect",
    names: ["USB-C Fast Charger", "Portable Power Bank", "Braided Charging Cable", "Wireless Charging Pad", "Phone Tripod"],
    images: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85",
    ],
    basePrice: 399,
  },
  {
    categorySlug: "smart-wearables",
    categoryMatch: /wearable|watch/i,
    code: "WEA",
    brand: "ShopEase Active",
    names: ["Fitness Smart Watch", "GPS Sports Watch", "Fitness Tracker", "Smart Watch Strap", "Smart Glasses"],
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=900&q=85",
    ],
    basePrice: 999,
  },
];

function makeProduct(group, category, groupIndex, modelIndex) {
  const number = String(modelIndex + 1).padStart(2, "0");
  const name = `${group.names[modelIndex]} Series ${number}`;
  const slug = `store-demo-${group.code.toLowerCase()}-${groupIndex + 1}-${number}`;
  const productNumber = String(groupIndex * 25 + modelIndex + 1).padStart(3, "0");
  const price = group.basePrice + modelIndex * 275 + groupIndex * 350;

  return {
    name,
    slug,
    description: `${name} is a dependable ${category.name.toLowerCase()} product designed for daily use. It combines practical features, comfortable use, and a clean design.`,
    categoryId: category._id,
    brand: group.brand,
    sku: `SHOP-DEMO-${group.code}-${productNumber}`,
    price,
    compareAtPrice: Math.round(price * 1.18),
    stockQuantity: 5 + ((groupIndex * 25 + modelIndex * 7) % 45),
    images: [group.images[modelIndex % group.images.length], group.images[(modelIndex + 1) % group.images.length]],
    specifications: {
      Model: `${group.code}-${number}`,
      Category: category.name,
      Condition: "New",
      Warranty: "1 year",
    },
    warranty: "1 year",
    tags: [group.brand, "New arrival", "Available now"],
    isFeatured: modelIndex === 0,
    active: true,
  };
}

async function seed100Products() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);

  const categories = await Category.find({ active: true }).sort({ sortOrder: 1, name: 1 });
  const targets = productGroups.map((group, index) => {
    const category = categories.find((item) => item.slug === group.categorySlug)
      || categories.find((item) => group.categoryMatch.test(item.name))
      || categories[index];
    if (!category) throw new Error(`No active category found for ${group.names[0]}.`);
    return { group, category, groupIndex: index };
  });

  let inserted = 0;
  let alreadyPresent = 0;
  for (const { group, category, groupIndex } of targets) {
    for (let modelIndex = 0; modelIndex < 25; modelIndex += 1) {
      const product = makeProduct(group, category, groupIndex, modelIndex);
      const exists = await Product.exists({ $or: [{ slug: product.slug }, { sku: product.sku }] });
      if (exists) {
        alreadyPresent += 1;
        continue;
      }
      await Product.create(product);
      inserted += 1;
    }
  }

  console.log(`100 product records checked. Added: ${inserted}; already present: ${alreadyPresent}.`);
}

seed100Products()
  .catch((error) => {
    console.error("Could not seed the products:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
