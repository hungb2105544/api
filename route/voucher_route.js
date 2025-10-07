const express = require("express");
const router = express.Router();
const VoucherController = require("../controller/voucher_controller.js");
const authMiddleware = require("../middleware/authMiddleware"); // Import the authMiddleware

// Lấy danh sách voucher (admin only)
router.get("/", authMiddleware, VoucherController.getAllVouchers);

// Lấy chi tiết voucher theo ID (admin only)
router.get("/:id", authMiddleware, VoucherController.getVoucherById);

// Tạo voucher mới (admin only)
router.post("/", authMiddleware, VoucherController.createVoucher);

// Cập nhật voucher (admin only)
router.patch("/:id", authMiddleware, VoucherController.updateVoucher);

// Xóa voucher (admin only)
router.delete("/:id", authMiddleware, VoucherController.deleteVoucher);

module.exports = router;
