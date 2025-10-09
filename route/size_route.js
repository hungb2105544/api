const express = require("express");
const router = express.Router();
const SizeController = require("../controller/size_controller");
const authMiddleware = require("../middleware/authMiddleware");
router.get("/", SizeController.getAllSizes);

router.post("/", authMiddleware, SizeController.createSize);

router.put("/:id", authMiddleware, SizeController.updateSize);

router.delete("/:id", authMiddleware, SizeController.deleteSize);

module.exports = router;
