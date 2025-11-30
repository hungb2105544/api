const BrandTypeModel = require("../model/brand_type_model");

class BrandTypeController {
  static async getAllBrandTypes(req, res) {
    try {
      const { brand_id, type_id } = req.query;
      const filters = {};

      if (brand_id) filters.brand_id = parseInt(brand_id);
      if (type_id) filters.type_id = parseInt(type_id);

      const result = await BrandTypeModel.getAllBrandType(filters);

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
        "❌ Controller - Lỗi khi lấy danh sách brand-type:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async getBrandTypeById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID không hợp lệ",
        });
      }

      const result = await BrandTypeModel.getBrandTypeById(id);

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
      console.error("❌ Controller - Lỗi khi lấy brand-type:", error.message);
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async getTypesByBrandId(req, res) {
    try {
      const { brandId } = req.params;

      if (!brandId || isNaN(brandId)) {
        return res.status(400).json({
          success: false,
          message: "ID thương hiệu không hợp lệ",
        });
      }

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
      console.error(
        "❌ Controller - Lỗi khi lấy types theo brand:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async getBrandsByTypeId(req, res) {
    try {
      const { typeId } = req.params;

      if (!typeId || isNaN(typeId)) {
        return res.status(400).json({
          success: false,
          message: "ID loại sản phẩm không hợp lệ",
        });
      }

      const result = await BrandTypeModel.getBrandByTypeId(typeId);

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
        "❌ Controller - Lỗi khi lấy brands theo type:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async createBrandType(req, res) {
    try {
      const { brand_id, type_id } = req.body;

      if (!brand_id || !type_id) {
        return res.status(400).json({
          success: false,
          message: "Brand ID và Type ID là bắt buộc",
        });
      }

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
      console.error("❌ Controller - Lỗi khi tạo brand-type:", error.message);
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async updateBrandType(req, res) {
    try {
      const { id } = req.params;
      const { brand_id, type_id } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID không hợp lệ",
        });
      }

      if (!brand_id && !type_id) {
        return res.status(400).json({
          success: false,
          message: "Cần ít nhất một trong brand_id hoặc type_id để cập nhật",
        });
      }

      const result = await BrandTypeModel.updateBrandType(id, req.body);

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
        "❌ Controller - Lỗi khi cập nhật brand-type:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  static async deleteBrandType(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID không hợp lệ",
        });
      }

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
      console.error("❌ Controller - Lỗi khi xóa brand-type:", error.message);
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  // Tạo nhiều quan hệ cùng lúc (bulk create)
  static async bulkCreateBrandTypes(req, res) {
    try {
      const { relations } = req.body; // Array of { brand_id, type_id }

      if (!relations || !Array.isArray(relations) || relations.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Danh sách quan hệ không hợp lệ",
        });
      }

      const result = await BrandTypeModel.bulkCreateBrandTypes(relations);

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
        "❌ Controller - Lỗi khi tạo bulk brand-types:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }
}

module.exports = BrandTypeController;
