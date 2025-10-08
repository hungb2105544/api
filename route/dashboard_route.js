const express = require("express");
const router = express.Router();
const DashboardController = require("../controller/dashboard_controller");
const { isAuthenticated } = require("../middleware/authMiddleware");

router.get("/stats", isAuthenticated, DashboardController.getStats);

module.exports = router;
