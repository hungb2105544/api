// controller/dashboard_controller.js
const supabase = require("../supabaseClient");

class DashboardController {
  static async getStats(req, res) {
    try {
      const { count: orderCount, error: orderError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });

      const { count: productCount, error: productError } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });

      const { count: voucherCount, error: voucherError } = await supabase
        .from("vouchers")
        .select("*", { count: "exact", head: true });

      if (orderError || productError || voucherError) {
        throw new Error("Lỗi khi truy vấn số liệu thống kê.");
      }

      res.status(200).json({
        success: true,
        data: {
          orders: orderCount,
          products: productCount,
          vouchers: voucherCount,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = DashboardController;
