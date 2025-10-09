const express = require("express");
const router = express.Router();
const BranchController = require("../controller/branch_controller");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, BranchController.getAllBranches);

router.get("/:id", authMiddleware, BranchController.getBranchById);

router.post("/", authMiddleware, BranchController.createBranch);

router.put("/:id", authMiddleware, BranchController.updateBranch);

router.delete("/:id", authMiddleware, BranchController.deleteBranch);

module.exports = router;
