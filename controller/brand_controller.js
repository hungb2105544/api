const BrandModel = require("../model/brand_model");
const supabase = require("../supabaseClient");

class BrandController {
  // Lấy tất cả thương hiệu
  static async getAllBrands(req, res) {
    try {
      const { data, error } = await supabase
        .from("brands")
        .select(BrandModel.SELECT_FIELDS)
        .order("created_at", { ascending: false });
      if (error) {
        return res.status(400).json({
          success: false,
          message: `Lỗi khi lấy danh sách thương hiệu: ${error.message}`,
        });
      }

      return res.status(200).json({
        success: true,
        data,
        message: "Lấy danh sách thương hiệu thành công",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  // Tạo mới thương hiệu
  static async createBrand(req, res) {
    try {
      const result = await BrandModel.createBrand(req.body, req.file);
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
      console.error("❌ Controller - Lỗi khi tạo thương hiệu:", error.message);
      return res.status(500).json({
        success: false,
        message: `Lỗi server: ${error.message}`,
      });
    }
  }

  // Cập nhật thương hiệu
  static async updateBrand(req, res) {
    try {
      const { id } = req.params;
      const result = await BrandModel.updateBrand(id, req.body, req.file);
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

  // Xóa thương hiệu
  static async deleteBrand(req, res) {
    try {
      const { id } = req.params;
      const result = await BrandModel.deleteBrand(id);
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

module.exports = BrandController;
