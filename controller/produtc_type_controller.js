const ProductTypeModel = require("../model/product_type_model");

class ProductTypeController {
  // Lấy tất cả loại sản phẩm
  static async getAllProductTypes(req, res) {
    try {
      const result = await ProductTypeModel.getAllProductType();
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
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  // Xóa loại sản phẩm
  static async deleteProductType(req, res) {
    try {
      const { id } = req.params;
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
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }
}

module.exports = ProductTypeController;
