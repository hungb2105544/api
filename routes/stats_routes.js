const express = require("express");
const router = express.Router();
const StatsController = require("../controller/stats_controller");

// Route để lấy tất cả dữ liệu thống kê
router.get("/", StatsController.getStats);

module.exports = router;
