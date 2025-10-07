const express = require("express");
const router = express.Router();
const InventoryController = require("../controller/inventory_controller");
const authMiddleware = require("../middleware/authMiddleware"); // Import the authMiddleware

// Lấy danh sách tồn kho (admin only)
router.get("/", authMiddleware, InventoryController.getAllInventory);

// Lấy chi tiết tồn kho theo ID (admin only)
router.get("/:id", authMiddleware, InventoryController.getInventoryById);

// Thêm hoặc cập nhật tồn kho (admin only)
router.post("/", authMiddleware, InventoryController.upsertInventory);

// Giảm tồn kho (khi đặt hàng, admin only)
router.patch(
  "/decrease",
  authMiddleware,
  InventoryController.decreaseInventory
);

// Tăng tồn kho (khi nhập hàng, admin only)
router.patch(
  "/increase",
  authMiddleware,
  InventoryController.increaseInventory
);

// Hoàn tồn kho (khi hủy đơn hàng, admin only)
router.patch(
  "/cancel-order",
  authMiddleware,
  InventoryController.cancelOrderInventory
);

// Xóa tồn kho (admin only)
router.delete("/:id", authMiddleware, InventoryController.deleteInventory);

module.exports = router;
