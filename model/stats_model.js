const supabase = require("../supabaseClient");

class StatsModel {
  /**
   * Lấy thống kê tổng quan (doanh thu, đơn hàng, sản phẩm đã bán).
   * @param {string} startDate - 'YYYY-MM-DD'
   * @param {string} endDate - 'YYYY-MM-DD'
   */
  static async getOverviewStats(startDate, endDate) {
    try {
      const { data, error } = await supabase.rpc("get_overview_stats", {
        start_date: startDate,
        end_date: endDate,
      });
      if (error) throw error;
      // RPC trả về mảng, ta lấy phần tử đầu tiên
      return data[0];
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy thống kê tổng quan:", err.message);
      throw new Error("Không thể lấy dữ liệu thống kê tổng quan.");
    }
  }

  /**
   * Lấy dữ liệu doanh thu và đơn hàng theo ngày để vẽ biểu đồ.
   * @param {string} startDate - 'YYYY-MM-DD'
   * @param {string} endDate - 'YYYY-MM-DD'
   */
  static async getRevenueChartData(startDate, endDate) {
    try {
      const { data, error } = await supabase.rpc(
        "get_daily_revenue_and_orders",
        {
          start_date: startDate,
          end_date: endDate,
        }
      );
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy dữ liệu biểu đồ:", err.message);
      throw new Error("Không thể lấy dữ liệu cho biểu đồ.");
    }
  }

  /**
   * Lấy danh sách sản phẩm bán chạy nhất.
   * @param {string} startDate - 'YYYY-MM-DD'
   * @param {string} endDate - 'YYYY-MM-DD'
   * @param {number} limit - Số lượng sản phẩm muốn lấy
   */
  static async getTopSellingProducts(startDate, endDate, limit = 5) {
    try {
      const { data, error } = await supabase.rpc("get_top_selling_products", {
        start_date: startDate,
        end_date: endDate,
        limit_count: limit,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy sản phẩm bán chạy:", err.message);
      throw new Error("Không thể lấy danh sách sản phẩm bán chạy.");
    }
  }
}

module.exports = StatsModel;
