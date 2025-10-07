const express = require("express");
const router = express.Router();
const OrderController = require("../controller/order_controller");
const authMiddleware = require("../middleware/authMiddleware"); // Import the authMiddleware

// Lấy danh sách đơn hàng (admin only)
router.get("/", authMiddleware, OrderController.getAllOrders);

// Lấy chi tiết đơn hàng theo ID (admin only)
router.get("/:id", authMiddleware, OrderController.getOrderById);

// Cập nhật trạng thái đơn hàng (admin only)
router.patch("/:id/status", authMiddleware, OrderController.updateOrderStatus);

// Hủy đơn hàng (admin only)
router.delete("/:id", authMiddleware, OrderController.deleteOrder);

module.exports = router;
