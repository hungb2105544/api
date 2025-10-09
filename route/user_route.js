const express = require("express");
const router = express.Router();
const UserController = require("../controller/user_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/:id", authMiddleware, UserController.getUserById);

module.exports = router;
