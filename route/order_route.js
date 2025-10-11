const express = require("express");
const router = express.Router();
const OrderController = require("../controller/order_controller");
const authMiddleware = require("../middleware/authMiddleware");

// Route lấy danh sách (có thể có filter)
router.get("/", authMiddleware, OrderController.getAllOrders);

// Route tĩnh phải được đặt trước route động
router.get("/stats", authMiddleware, OrderController.getOrderStats);
router.get("/:id", authMiddleware, OrderController.getOrderById);

router.patch("/:id/status", authMiddleware, OrderController.updateOrderStatus);

router.delete("/:id", authMiddleware, OrderController.deleteOrder);

module.exports = router;
