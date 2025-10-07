const InventoryModel = require("../model/inventory_model");

class InventoryController {
  // Lấy danh sách tồn kho
  static async getAllInventory(req, res) {
    try {
      const {
        limit = 10,
        offset = 0,
        branch_id,
        product_id,
        variant_id,
        has_stock,
        low_stock,
      } = req.query;
      const filters = {
        branch_id: branch_id ? parseInt(branch_id) : null,
        product_id: product_id ? parseInt(product_id) : null,
        variant_id: variant_id ? parseInt(variant_id) : null,
        has_stock: has_stock === "true",
        low_stock: low_stock === "true",
      };

      const inventory = await InventoryModel.getAllInventory(
        parseInt(limit),
        parseInt(offset),
        filters
      );
      return res.status(200).json({
        success: true,
        data: inventory,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy danh sách tồn kho:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi lấy danh sách tồn kho",
      });
    }
  }

  // Lấy chi tiết tồn kho theo ID
  static async getInventoryById(req, res) {
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID tồn kho không hợp lệ",
        });
      }

      const inventory = await InventoryModel.getInventoryById(id);
      return res.status(200).json({
        success: true,
        data: inventory,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi lấy tồn kho:", error.message);
      return res
        .status(error.message === "Không tìm thấy bản ghi tồn kho" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi server khi lấy tồn kho",
        });
    }
  }

  // Thêm hoặc cập nhật tồn kho
  static async upsertInventory(req, res) {
    try {
      const inventoryData = req.body;
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (
        !inventoryData.branch_id ||
        !inventoryData.product_id ||
        typeof inventoryData.quantity !== "number" ||
        inventoryData.quantity < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Chi nhánh, sản phẩm và số lượng (≥ 0) là bắt buộc",
        });
      }

      const result = await InventoryModel.upsertInventory(
        inventoryData,
        userId
      );
      return res.status(201).json({
        success: true,
        data: result,
        message: "Thêm/cập nhật tồn kho thành công",
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi thêm/cập nhật tồn kho:",
        error.message
      );
      return res
        .status(error.message.includes("vượt quá mức tối đa") ? 400 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi server khi thêm/cập nhật tồn kho",
        });
    }
  }

  // Giảm tồn kho (khi đặt hàng)
  static async decreaseInventory(req, res) {
    try {
      const { branch_id, product_id, variant_id } = req.body;
      const quantity = parseInt(req.body.quantity);
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (!branch_id || !product_id || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc",
        });
      }

      const result = await InventoryModel.decreaseInventory(
        parseInt(branch_id),
        parseInt(product_id),
        variant_id ? parseInt(variant_id) : null,
        quantity,
        userId
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Giảm tồn kho thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi giảm tồn kho:", error.message);
      return res
        .status(
          error.message === "Số lượng tồn kho không đủ" ||
            error.message.includes("không tồn tại")
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi giảm tồn kho",
        });
    }
  }

  // Tăng tồn kho (khi nhập hàng)
  static async increaseInventory(req, res) {
    try {
      const { branch_id, product_id, variant_id } = req.body;
      const quantity = parseInt(req.body.quantity);
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (!branch_id || !product_id || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc",
        });
      }

      const result = await InventoryModel.increaseInventory(
        parseInt(branch_id),
        parseInt(product_id),
        variant_id ? parseInt(variant_id) : null,
        quantity,
        userId
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Tăng tồn kho thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi tăng tồn kho:", error.message);
      return res
        .status(
          error.message.includes("vượt quá mức tối đa") ||
            error.message.includes("không tồn tại")
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi tăng tồn kho",
        });
    }
  }

  // Hoàn tồn kho (khi hủy đơn hàng)
  static async cancelOrderInventory(req, res) {
    try {
      const { branch_id, product_id, variant_id } = req.body;
      const quantity = parseInt(req.body.quantity);
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (!branch_id || !product_id || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc",
        });
      }

      const result = await InventoryModel.cancelOrderInventory(
        parseInt(branch_id),
        parseInt(product_id),
        variant_id ? parseInt(variant_id) : null,
        quantity,
        userId
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Hoàn tồn kho thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi hoàn tồn kho:", error.message);
      return res
        .status(
          error.message === "Số lượng giữ chỗ không đủ" ||
            error.message.includes("vượt quá mức tối đa") ||
            error.message.includes("không tồn tại")
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi hoàn tồn kho",
        });
    }
  }

  // Xóa tồn kho (đặt quantity = 0)
  static async deleteInventory(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID tồn kho không hợp lệ",
        });
      }

      const result = await InventoryModel.deleteInventory(parseInt(id), userId);
      return res.status(200).json({
        success: true,
        data: result,
        message: "Xóa tồn kho thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi xóa tồn kho:", error.message);
      return res
        .status(
          error.message === "Không tìm thấy bản ghi tồn kho" ||
            error.message === "Không thể xóa vì vẫn còn số lượng giữ chỗ"
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi xóa tồn kho",
        });
    }
  }
}

module.exports = InventoryController;
