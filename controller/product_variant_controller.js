const ProductVariantModel = require("../model/product_variant_model");

class ProductVariantController {
  static async getAllVariants(req, res) {
    try {
      const { limit = 10, offset = 0, productId } = req.query;
      const variants = await ProductVariantModel.getAllVariants(
        parseInt(limit),
        parseInt(offset),
        productId ? parseInt(productId) : null
      );
      return res.status(200).json({
        success: true,
        message: "Lấy danh sách biến thể thành công",
        data: variants,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy danh sách biến thể:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi lấy danh sách biến thể",
      });
    }
  }

  static async getVariantById(req, res) {
    try {
      const { id } = req.params;
      const variant = await ProductVariantModel.getVariantById(parseInt(id));
      return res.status(200).json({
        success: true,
        message: "Lấy biến thể thành công",
        data: variant,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi lấy biến thể:", error.message);
      return res
        .status(error.message === "Không tìm thấy biến thể" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi khi lấy biến thể",
        });
    }
  }

  static async createVariant(req, res) {
    try {
      const variantData = {
        product_id: parseInt(req.body.product_id),
        color: req.body.color,
        sku: req.body.sku,
        additional_price: req.body.additional_price
          ? parseFloat(req.body.additional_price)
          : undefined,
        size_id: parseInt(req.body.size_id),
      };
      const imageFiles = req.files || [];
      const userId = req.user?.id; // Giả sử middleware xác thực cung cấp userId
      const variant = await ProductVariantModel.createVariant(
        variantData,
        imageFiles,
        userId
      );
      return res.status(201).json({
        success: true,
        message: "Tạo biến thể thành công",
        data: variant,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi tạo biến thể:", error.message);
      return res.status(400).json({
        success: false,
        message: error.message || "Lỗi khi tạo biến thể",
      });
    }
  }

  static async updateVariant(req, res) {
    try {
      const { id } = req.params;
      const variantData = {
        product_id: req.body.product_id
          ? parseInt(req.body.product_id)
          : undefined,
        color: req.body.color,
        sku: req.body.sku,
        additional_price: req.body.additional_price
          ? parseFloat(req.body.additional_price)
          : undefined,
        size_id: req.body.size_id ? parseInt(req.body.size_id) : undefined,
        removeImageIds: req.body.removeImageIds
          ? JSON.parse(req.body.removeImageIds)
          : undefined,
      };
      const imageFiles = req.files || [];
      const userId = req.user?.id; // Giả sử middleware xác thực cung cấp userId
      const updatedVariant = await ProductVariantModel.updateVariant(
        parseInt(id),
        variantData,
        imageFiles,
        userId
      );
      return res.status(200).json({
        success: true,
        message: "Cập nhật biến thể thành công",
        data: updatedVariant,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi cập nhật biến thể:",
        error.message
      );
      return res
        .status(error.message === "Không tìm thấy biến thể" ? 404 : 400)
        .json({
          success: false,
          message: error.message || "Lỗi khi cập nhật biến thể",
        });
    }
  }

  static async deleteVariant(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id; // Giả sử middleware xác thực cung cấp userId
      const result = await ProductVariantModel.deleteVariant(
        parseInt(id),
        true,
        userId
      );
      return res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id },
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi xóa biến thể:", error.message);
      return res
        .status(error.message === "Không tìm thấy biến thể" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi khi xóa biến thể",
        });
    }
  }
}

module.exports = ProductVariantController;
