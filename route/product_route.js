const express = require("express");
const {
  ProductController,
  upload,
} = require("../controller/product_controller");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Lấy danh sách sản phẩm (public access)
router.get("/", authMiddleware, ProductController.getAllProducts);

// Lấy chi tiết sản phẩm theo ID (public access)
router.get("/:id", ProductController.getProductById);

// Tạo sản phẩm mới (admin only)
router.post("/", authMiddleware, upload, ProductController.createProduct);

// Cập nhật sản phẩm (admin only)
router.put("/:id", authMiddleware, upload, ProductController.updateProduct);

// Xóa sản phẩm (soft delete, admin only)
router.delete("/:id", authMiddleware, ProductController.deleteProduct);

module.exports = router;
