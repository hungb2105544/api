const VoucherModel = require("../model/voucher_model");

class VoucherController {
  // Lấy danh sách voucher
  static async getAllVouchers(req, res) {
    try {
      const { limit = 10, offset = 0, type, code, is_valid } = req.query;
      const filters = { type, code, is_valid: is_valid === "true" };

      const vouchers = await VoucherModel.getAllVouchers(
        parseInt(limit),
        parseInt(offset),
        filters
      );
      return res.status(200).json({
        success: true,
        data: vouchers,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy danh sách voucher:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi lấy danh sách voucher",
      });
    }
  }

  // Lấy chi tiết voucher theo ID
  static async getVoucherById(req, res) {
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID voucher không hợp lệ",
        });
      }

      const voucher = await VoucherModel.getVoucherById(id);
      return res.status(200).json({
        success: true,
        data: voucher,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi lấy voucher:", error.message);
      return res
        .status(error.message === "Không tìm thấy voucher" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi server khi lấy voucher",
        });
    }
  }

  // Tạo voucher mới
  static async createVoucher(req, res) {
    try {
      const voucherData = req.body;
      if (
        !voucherData.code ||
        !voucherData.name ||
        !voucherData.type ||
        !voucherData.value ||
        !voucherData.valid_to
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Thiếu các trường bắt buộc: code, name, type, value, valid_to",
        });
      }

      const voucher = await VoucherModel.createVoucher(voucherData);
      return res.status(201).json({
        success: true,
        data: voucher,
        message: "Tạo voucher thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi tạo voucher:", error.message);
      return res
        .status(error.message === "Mã voucher đã tồn tại" ? 409 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi server khi tạo voucher",
        });
    }
  }

  // Cập nhật voucher
  static async updateVoucher(req, res) {
    try {
      const { id } = req.params;
      const voucherData = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID voucher không hợp lệ",
        });
      }

      const updatedVoucher = await VoucherModel.updateVoucher(id, voucherData);
      return res.status(200).json({
        success: true,
        data: updatedVoucher,
        message: "Cập nhật voucher thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi cập nhật voucher:", error.message);
      return res
        .status(
          error.message === "Không tìm thấy voucher" ||
            error.message === "Mã voucher đã tồn tại"
            ? 404
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi cập nhật voucher",
        });
    }
  }

  // Xóa voucher
  static async deleteVoucher(req, res) {
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID voucher không hợp lệ",
        });
      }

      const deletedVoucher = await VoucherModel.deleteVoucher(id);
      return res.status(200).json({
        success: true,
        data: deletedVoucher,
        message: "Xóa voucher thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi xóa voucher:", error.message);
      return res
        .status(error.message === "Không tìm thấy voucher" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi server khi xóa voucher",
        });
    }
  }
}

module.exports = VoucherController;
