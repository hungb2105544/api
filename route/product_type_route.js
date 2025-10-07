const express = require("express");
const router = express.Router();
const ProductTypeController = require("../controller/produtc_type_controller");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../config/multerConfig");
// Lấy tất cả loại sản phẩm
router.get("/", authMiddleware, ProductTypeController.getAllProductTypes);

// Tạo mới loại sản phẩm
router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  ProductTypeController.createProductType
);
router.put(
  "/:id",
  authMiddleware,
  upload.single("image"),
  ProductTypeController.updateProductType
);
// Xóa loại sản phẩm
router.delete("/:id", authMiddleware, ProductTypeController.deleteProductType);

module.exports = router;
