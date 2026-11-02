import * as storeService from "../services/storeService.js";

export async function listCategories(_req, res) {
  const result = await storeService.listStoreCategories();
  return res.status(result.status).json(result.body);
}

export async function listProducts(req, res) {
  const result = await storeService.listStoreProducts({ query: req.query });
  return res.status(result.status).json(result.body);
}

export async function getProductDetails(req, res) {
  const result = await storeService.getStoreProductDetails({ params: req.params });
  return res.status(result.status).json(result.body);
}
