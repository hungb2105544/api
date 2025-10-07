const NotificationModel = require("../model/notification_model");

class NotificationController {
  // Tạo thông báo cập nhật trạng thái đơn hàng
  static async createOrderUpdateNotification(req, res) {
    try {
      const { orderId, userId, status } = req.body;
      const result = await NotificationModel.createOrderUpdateNotification(
        orderId,
        userId,
        status
      );
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }
      return res.status(201).json({
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

  // Tạo thông báo voucher mới
  static async createVoucherNotification(req, res) {
    try {
      const { voucherId } = req.body;
      const result = await NotificationModel.createVoucherNotification(
        voucherId
      );
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }
      return res.status(201).json({
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

  // Tạo thông báo hệ thống
  static async createSystemNotification(req, res) {
    try {
      const { title, content } = req.body;
      const result = await NotificationModel.createSystemNotification(
        title,
        content
      );
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }
      return res.status(201).json({
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

module.exports = NotificationController;
