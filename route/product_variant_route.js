const express = require("express");
const router = express.Router();
const ProductVariantController = require("../controller/product_variant_controller");
const upload = require("../config/multerConfig");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", ProductVariantController.getAllVariants);
router.get("/:id", ProductVariantController.getVariantById);
router.post(
  "/",
  authMiddleware,
  upload.array("images", 5),
  ProductVariantController.createVariant
);
router.post(
  "/bulk-with-shared-images",
  authMiddleware,
  upload.array("images", 5),
  ProductVariantController.handleBulkCreateWithSharedImages
);
router.put(
  "/:id",
  authMiddleware,
  upload.array("images", 5),
  ProductVariantController.updateVariant
);
router.delete("/:id", authMiddleware, ProductVariantController.deleteVariant);

module.exports = router;
