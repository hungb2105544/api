const BrandTypeModel = require("../model/brand_type_model");

class BrandTypeController {
  // Lấy tất cả quan hệ thương hiệu-loại sản phẩm
  static async getAllBrandTypes(req, res) {
    try {
      const result = await BrandTypeModel.getAllBrandType();
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

  // Lấy danh sách loại sản phẩm theo brand_id
  static async getTypeByBrandId(req, res) {
    try {
      const { brandId } = req.params;
      const result = await BrandTypeModel.getTypeByBrandId(brandId);
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

  // Tạo mới quan hệ thương hiệu-loại sản phẩm
  static async createBrandType(req, res) {
    try {
      const result = await BrandTypeModel.createBrandType(req.body);
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

  // Xóa quan hệ thương hiệu-loại sản phẩm
  static async deleteBrandType(req, res) {
    try {
      const { id } = req.params;
      const result = await BrandTypeModel.deleteBrandType(id);
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

module.exports = BrandTypeController;
