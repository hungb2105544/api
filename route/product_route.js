const express = require("express");
const {
  ProductController,
  upload,
} = require("../controller/product_controller");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, ProductController.getAllProducts);

router.get("/:id", ProductController.getProductById);

router.post("/", authMiddleware, upload, ProductController.createProduct);

router.put("/:id", authMiddleware, upload, ProductController.updateProduct);

router.delete("/:id", authMiddleware, ProductController.deleteProduct);

module.exports = router;
