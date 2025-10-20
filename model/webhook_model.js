const ProductDiscountModel = require("./product_discount_model");
class WebhookModel {
  static async getPromotion() {
    try {
      let query = ProductDiscountModel.getAllDiscounts(100, 0, {
        is_active: true,
      });
      return query;
    } catch (error) {
      console.error(
        "❌ Model - Lỗi khi lấy chương trình giảm giá:",
        error.message
      );
    }
  }
}

module.exports = WebhookModel;
