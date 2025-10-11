const OrderModel = require("../model/order_model");

class OrderController {
  // Lấy danh sách đơn hàng
  static async getAllOrders(req, res) {
    try {
      const { limit = 10, offset = 0, ...filters } = req.query;
      const { data, count } = await OrderModel.getAllOrders(
        parseInt(limit, 10),
        parseInt(offset, 10),
        filters
      );
      return res.status(200).json({
        success: true,
        message: "Lấy danh sách đơn hàng thành công",
        data: data,
        total: count,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy danh sách đơn hàng:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi lấy danh sách đơn hàng",
      });
    }
  }

  // Lấy chi tiết đơn hàng theo ID
  static async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const orderId = parseInt(id, 10);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID đơn hàng không hợp lệ",
        });
      }

      const order = await OrderModel.getOrderById(orderId);
      return res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi lấy đơn hàng:", error.message);
      return res
        .status(error.message === "Không tìm thấy đơn hàng" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi server khi lấy đơn hàng",
        });
    }
  }

  // Cập nhật trạng thái đơn hàng
  static async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, comment } = req.body;
      const changedBy = req.user?.id || null; // Giả định user ID từ middleware xác thực
      const orderId = parseInt(id, 10);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID đơn hàng không hợp lệ",
        });
      }
      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Trạng thái đơn hàng là bắt buộc",
        });
      }

      const updatedOrder = await OrderModel.updateOrderStatus(
        orderId,
        status,
        comment,
        changedBy
      );
      return res.status(200).json({
        success: true,
        data: updatedOrder,
        message: "Cập nhật trạng thái đơn hàng thành công",
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi cập nhật trạng thái đơn hàng:",
        error.message
      );
      return res
        .status(
          error.message === "Không tìm thấy đơn hàng" ||
            error.message === "Trạng thái đơn hàng không hợp lệ"
            ? 400
            : 500
        )
        .json({
          success: false,
          message:
            error.message || "Lỗi server khi cập nhật trạng thái đơn hàng",
        });
    }
  }

  // Hủy đơn hàng
  static async deleteOrder(req, res) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const changedBy = req.user?.id || null; // Giả định user ID từ middleware xác thực
      const orderId = parseInt(id, 10);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID đơn hàng không hợp lệ",
        });
      }

      const cancelledOrder = await OrderModel.deleteOrder(
        orderId,
        comment,
        changedBy
      );
      return res.status(200).json({
        success: true,
        data: cancelledOrder,
        message: "Hủy đơn hàng thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi hủy đơn hàng:", error.message);
      return res
        .status(
          error.message === "Không tìm thấy đơn hàng" ||
            error.message === "Đơn hàng đã bị hủy trước đó"
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi hủy đơn hàng",
        });
    }
  }

  // Thống kê đơn hàng
  static async getOrderStats(req, res) {
    try {
      const stats = await OrderModel.getOrderStats();
      return res.status(200).json({
        success: true,
        data: stats,
        message: "Lấy thống kê đơn hàng thành công",
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy thống kê đơn hàng:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi lấy thống kê đơn hàng",
      });
    }
  }
}

module.exports = OrderController;
