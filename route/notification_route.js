const express = require("express");
const router = express.Router();
const NotificationController = require("../controller/notification_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.post(
  "/order",
  authMiddleware,
  NotificationController.createOrderUpdateNotification
);

router.post(
  "/voucher",
  authMiddleware,
  NotificationController.createVoucherNotification
);

router.post(
  "/system",
  authMiddleware,
  NotificationController.createSystemNotification
);

module.exports = router;
