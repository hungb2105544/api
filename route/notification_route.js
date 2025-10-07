const express = require("express");
const router = express.Router();
const NotificationController = require("../controller/notification_controller");
const authMiddleware = require("../middleware/authMiddleware");

// Tạo thông báo cập nhật trạng thái đơn hàng
router.post(
  "/order",
  authMiddleware,
  NotificationController.createOrderUpdateNotification
);

// Tạo thông báo voucher mới
router.post(
  "/voucher",
  authMiddleware,
  NotificationController.createVoucherNotification
);

// Tạo thông báo hệ thống
router.post(
  "/system",
  authMiddleware,
  NotificationController.createSystemNotification
);

module.exports = router;
