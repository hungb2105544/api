const express = require("express");
const router = express.Router();
const InventoryController = require("../controller/inventory_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, InventoryController.getAllInventory);

router.get("/:id", authMiddleware, InventoryController.getInventoryById);

router.post("/", authMiddleware, InventoryController.upsertInventory);

router.patch(
  "/decrease",
  authMiddleware,
  InventoryController.decreaseInventory
);

router.patch(
  "/increase",
  authMiddleware,
  InventoryController.increaseInventory
);

router.patch(
  "/cancel-order",
  authMiddleware,
  InventoryController.cancelOrderInventory
);

router.delete("/:id", authMiddleware, InventoryController.deleteInventory);

module.exports = router;
