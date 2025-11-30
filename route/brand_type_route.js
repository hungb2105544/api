const express = require("express");
const router = express.Router();
const BrandTypeController = require("../controller/brand_type_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", BrandTypeController.getAllBrandTypes);

router.get("/:id", BrandTypeController.getBrandTypeById);

router.get("/brand/:brandId/types", BrandTypeController.getTypesByBrandId);

router.get("/type/:typeId/brands", BrandTypeController.getBrandsByTypeId);

router.post("/", authMiddleware, BrandTypeController.createBrandType);

router.post("/bulk", authMiddleware, BrandTypeController.bulkCreateBrandTypes);

router.put("/:id", authMiddleware, BrandTypeController.updateBrandType);

router.delete("/:id", authMiddleware, BrandTypeController.deleteBrandType);

module.exports = router;
