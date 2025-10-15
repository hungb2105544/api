const express = require("express");
const router = express.Router();
const ProductDiscountController = require("../controller/product_discount_controller");
const authMiddleware = require("../middleware/authMiddleware");

// Middleware xác thực sẽ được áp dụng cho tất cả các route bên dưới
router.use(authMiddleware);

// Lấy tất cả giảm giá (có thể lọc theo query params)
router.get("/", ProductDiscountController.getAllDiscounts);

// Lấy tất cả giảm giá của một sản phẩm cụ thể
router.get(
  "/product/:productId",
  ProductDiscountController.getDiscountsByProductId
);

// Lấy giảm giá tốt nhất đang áp dụng cho một sản phẩm
router.get(
  "/applicable/:productId",
  ProductDiscountController.getApplicableDiscount
);

// Tạo một giảm giá mới
router.post("/", ProductDiscountController.createDiscount);

// Lấy chi tiết, cập nhật, xóa một giảm giá cụ thể
router
  .route("/:id")
  .get(ProductDiscountController.getDiscountById)
  .patch(ProductDiscountController.updateDiscount)
  .delete(ProductDiscountController.deleteDiscount);

module.exports = router;
