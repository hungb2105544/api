const UserInformationModel = require("../model/user_information_model");

class UserController {
  static async getUserById(req, res) {
    try {
      const { id } = req.params;

      const userInfo = await UserInformationModel.getInformationByUserId(id);

      res.status(200).json({
        success: true,
        data: userInfo,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy thông tin người dùng:",
        error.message
      );

      if (error.message.includes("Không tìm thấy người dùng")) {
        return res.status(404).json({ success: false, message: error.message });
      }

      if (error.message.includes("bắt buộc")) {
        return res.status(400).json({ success: false, message: error.message });
      }

      res.status(500).json({ success: false, message: "Lỗi máy chủ nội bộ." });
    }
  }
}

module.exports = UserController;
