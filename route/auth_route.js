const express = require("express");
const AuthController = require("../controller/authController");

const router = express.Router();

router.post("/", AuthController.login);

module.exports = router;
