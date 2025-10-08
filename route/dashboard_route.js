const express = require("express");
const router = express.Router();
const DashboardController = require("../controller/dashboard_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/stats", authMiddleware, DashboardController.getStats);

module.exports = router;
