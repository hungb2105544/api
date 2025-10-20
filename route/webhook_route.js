const express = require("express");
const router = express.Router();
const WebhookController = require("../controller/webhook_controller");
router.post("/", WebhookController.handleWebhook);

module.exports = router;
