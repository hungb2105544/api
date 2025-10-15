const BranchModel = require("../model/branch_model");

class BranchController {
  static async getAllBranches(req, res) {
    try {
      // Lấy các tham số filter từ query string
      const { is_active } = req.query;
      const filters = {};
      if (is_active !== undefined) filters.is_active = is_active === "true";

      const branches = await BranchModel.getAllBranches(filters);
      res.status(200).json({ success: true, data: branches });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBranchById(req, res) {
    try {
      const { id } = req.params;
      const branch = await BranchModel.getBranchById(id);
      res.status(200).json({ success: true, data: branch });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy") ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async createBranch(req, res) {
    try {
      const newBranch = await BranchModel.createBranch(req.body);
      res.status(201).json({
        success: true,
        message: "Tạo chi nhánh thành công.",
        data: newBranch,
      });
    } catch (error) {
      const statusCode =
        error.message.includes("bắt buộc") ||
        error.message.includes("không đầy đủ")
          ? 400
          : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async updateBranch(req, res) {
    try {
      const { id } = req.params;
      const updatedBranch = await BranchModel.updateBranch(id, req.body);
      res.status(200).json({
        success: true,
        message: "Cập nhật chi nhánh thành công.",
        data: updatedBranch,
      });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy") ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async deleteBranch(req, res) {
    try {
      const { id } = req.params;
      await BranchModel.deleteBranch(id);
      res
        .status(200)
        .json({ success: true, message: "Xóa chi nhánh thành công." });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy") ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }
}

module.exports = BranchController;
