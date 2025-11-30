const express = require("express");
const router = express.Router();
const ProductTypeController = require("../controller/produtc_type_controller");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../config/multerConfig");

router.get("/", ProductTypeController.getAllProductTypes);

router.get("/:id", ProductTypeController.getProductTypeById);

router.get("/parent/:parentId/children", ProductTypeController.getChildTypes);

router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  ProductTypeController.createProductType
);

router.put(
  "/:id",
  authMiddleware,
  upload.single("image"),
  ProductTypeController.updateProductType
);

router.delete("/:id", authMiddleware, ProductTypeController.deleteProductType);

module.exports = router;
