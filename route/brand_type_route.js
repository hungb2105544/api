const express = require("express");
const router = express.Router();
const BrandTypeController = require("../controller/brand_type_controller");
const authMiddleware = require("../middleware/authMiddleware");

// Lấy tất cả quan hệ thương hiệu-loại sản phẩm
router.get("/", BrandTypeController.getAllBrandTypes);

// Lấy danh sách loại sản phẩm theo brand_id
router.get("/brand/:brandId", BrandTypeController.getTypeByBrandId);

// Tạo mới quan hệ thương hiệu-loại sản phẩm
router.post("/", authMiddleware, BrandTypeController.createBrandType);

// Xóa quan hệ thương hiệu-loại sản phẩm
router.delete("/:id", authMiddleware, BrandTypeController.deleteBrandType);

module.exports = router;
