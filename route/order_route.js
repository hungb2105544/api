const express = require("express");
const router = express.Router();
const OrderController = require("../controller/order_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, OrderController.getAllOrders);

router.get("/:id", authMiddleware, OrderController.getOrderById);

router.patch("/:id/status", authMiddleware, OrderController.updateOrderStatus);

router.delete("/:id", authMiddleware, OrderController.deleteOrder);

module.exports = router;
