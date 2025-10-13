const StatsModel = require("../model/stats_model");

class StatsController {
  static async getStats(req, res) {
    try {
      const {
        startDate = new Date(new Date().setDate(new Date().getDate() - 30))
          .toISOString()
          .split("T")[0],
        endDate = new Date().toISOString().split("T")[0],
        limit = 5,
      } = req.query;

      // Validate dates if needed

      const [overview, chartData, topProducts] = await Promise.all([
        StatsModel.getOverviewStats(startDate, endDate),
        StatsModel.getRevenueChartData(startDate, endDate),
        StatsModel.getTopSellingProducts(startDate, endDate, parseInt(limit)),
      ]);

      const responseData = {
        overview,
        chartData,
        topProducts,
      };

      return res.status(200).json({
        success: true,
        message: "Lấy dữ liệu thống kê thành công",
        data: responseData,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi lấy thống kê:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = StatsController;
