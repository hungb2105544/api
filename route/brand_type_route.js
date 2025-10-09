const express = require("express");
const router = express.Router();
const BrandTypeController = require("../controller/brand_type_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", BrandTypeController.getAllBrandTypes);

router.get("/brand/:brandId", BrandTypeController.getTypeByBrandId);

router.post("/", authMiddleware, BrandTypeController.createBrandType);

router.delete("/:id", authMiddleware, BrandTypeController.deleteBrandType);

module.exports = router;
