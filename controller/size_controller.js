const SizeModel = require("../model/size_model");

class SizeController {
  static async getAllSizes(req, res) {
    try {
      const sizes = await SizeModel.getAllSizes();
      res.status(200).json({ success: true, data: sizes });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createSize(req, res) {
    try {
      const newSize = await SizeModel.createSize(req.body);
      res
        .status(201)
        .json({
          success: true,
          message: "Tạo kích thước thành công.",
          data: newSize,
        });
    } catch (error) {
      const statusCode = error.message.includes("đã tồn tại")
        ? 409
        : error.message.includes("bắt buộc")
        ? 400
        : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async updateSize(req, res) {
    try {
      const { id } = req.params;
      const updatedSize = await SizeModel.updateSize(id, req.body);
      res
        .status(200)
        .json({
          success: true,
          message: "Cập nhật kích thước thành công.",
          data: updatedSize,
        });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy")
        ? 404
        : error.message.includes("đã tồn tại")
        ? 409
        : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async deleteSize(req, res) {
    try {
      const { id } = req.params;
      await SizeModel.deleteSize(id);
      res
        .status(200)
        .json({ success: true, message: "Xóa kích thước thành công." });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy")
        ? 404
        : error.message.includes("đang được sử dụng")
        ? 400
        : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }
}

module.exports = SizeController;
