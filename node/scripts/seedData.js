// Seed script to create 10 categories and 100 products in MongoDB Atlas
// Run with: npm run seed

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

// Import models
import Category from "../models/Category.js";
import Product from "../models/Product.js";

async function createCategories() {
  const categories = [];
  for (let i = 1; i <= 10; i++) {
    const name = `Category ${i}`;
    const slug = `category-${i}`;
    const cat = new Category({ name, slug, active: true, sortOrder: i });
    categories.push(cat);
  }
  const saved = await Category.insertMany(categories);
  console.log(`Inserted ${saved.length} categories`);
  return saved;
}

function randomPrice() {
  return Math.round((Math.random() * 2000 + 100) * 100) / 100; // 100‑2100 INR
}

async function createProducts(categories) {
  const products = [];
  let productIndex = 1;
  for (const cat of categories) {
    for (let j = 1; j <= 10; j++) {
      const name = `Product ${productIndex}`;
      const slug = `product-${productIndex}`;
      const description = `Description for ${name}`;
      const price = randomPrice();
      const product = new Product({
        name,
        slug,
        description,
        categoryId: cat._id,
        brand: "ShopEase",
        price,
        stockQuantity: Math.floor(Math.random() * 100),
        images: [],
        specifications: {},
        tags: [],
        active: true,
        variants: [],
      });
      products.push(product);
      productIndex++;
    }
  }
  const saved = await Product.insertMany(products);
  console.log(`Inserted ${saved.length} products`);
}

async function main() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
    const categories = await createCategories();
    await createProducts(categories);
  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected");
  }
}

main();
