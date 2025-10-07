const express = require("express");
const AuthController = require("../controller/authController");

const router = express.Router();

// Tuyến đăng nhập
router.post("/", AuthController.login);

module.exports = router;
