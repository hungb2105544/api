const express = require("express");
const router = express.Router();
const BrandController = require("../controller/brand_controller");
const upload = require("../config/multerConfig");
const authMiddleware = require("../middleware/authMiddleware");
router.get("/", authMiddleware, BrandController.getAllBrands);

router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  BrandController.createBrand
);

router.put(
  "/:id",
  authMiddleware,
  upload.single("image"),
  BrandController.updateBrand
);

router.delete("/:id", authMiddleware, BrandController.deleteBrand);

module.exports = router;
