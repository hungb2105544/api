const express = require("express");
const router = express.Router();
const BrandController = require("../controller/brand_controller");
const upload = require("../config/multerConfig");
const authMiddleware = require("../middleware/authMiddleware");
// Lấy tất cả thương hiệu
router.get("/", authMiddleware, BrandController.getAllBrands);

// Tạo mới thương hiệu với upload ảnh
router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  BrandController.createBrand
);

// Cập nhật thương hiệu
router.put(
  "/:id",
  authMiddleware,
  upload.single("image"),
  BrandController.updateBrand
);

// Xóa thương hiệu
router.delete("/:id", authMiddleware, BrandController.deleteBrand);

module.exports = router;
