const ProductTypeModel = require("../model/product_type_model");

class ProductTypeController {
  static async getAllProductTypes(req, res) {
    try {
      const { is_active, parent_id, search } = req.query;
      const filters = {};

      if (is_active !== undefined) filters.is_active = is_active === "true";
      if (parent_id) filters.parent_id = parseInt(parent_id);
      if (search) filters.search = search;

      const result = await ProductTypeModel.getAllProductType(filters);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy danh sách loại sản phẩm:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async getProductTypeById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID loại sản phẩm không hợp lệ",
        });
      }

      const result = await ProductTypeModel.getProductTypeById(id);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy loại sản phẩm:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  // Tạo mới loại sản phẩm
  static async createProductType(req, res) {
    try {
      const result = await ProductTypeModel.createProductType(
        req.body,
        req.file
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      return res.status(201).json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi tạo loại sản phẩm:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  // Cập nhật loại sản phẩm
  static async updateProductType(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID loại sản phẩm không hợp lệ",
        });
      }

      const result = await ProductTypeModel.updateProductType(
        id,
        req.body,
        req.file
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi cập nhật loại sản phẩm:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async deleteProductType(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID loại sản phẩm không hợp lệ",
        });
      }

      const result = await ProductTypeModel.deleteProductType(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi xóa loại sản phẩm:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async getChildTypes(req, res) {
    try {
      const { parentId } = req.params;

      if (!parentId || isNaN(parentId)) {
        return res.status(400).json({
          success: false,
          message: "ID loại sản phẩm cha không hợp lệ",
        });
      }

      const result = await ProductTypeModel.getChildTypes(parentId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy loại sản phẩm con:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }
}

module.exports = ProductTypeController;
