const express = require("express");
const router = express.Router();
const VoucherController = require("../controller/voucher_controller.js");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, VoucherController.getAllVouchers);

router.get("/:id", authMiddleware, VoucherController.getVoucherById);

router.post("/", authMiddleware, VoucherController.createVoucher);

router.patch("/:id", authMiddleware, VoucherController.updateVoucher);

router.delete("/:id", authMiddleware, VoucherController.deleteVoucher);

module.exports = router;
