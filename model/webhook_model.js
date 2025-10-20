const ProductDiscountModel = require("./product_discount_model");
const BranchModel = require("./branch_model"); // Sửa lỗi chính tả BrachModel -> BranchModel
const VoucherModel = require("./voucher_model");
class WebhookModel {
  static async getPromotion() {
    try {
      const { data } = await ProductDiscountModel.getAllDiscounts(100, 0, {
        is_active: true,
      });
      console.log("✅ Model - Lấy chương trình giảm giá thành công.");
      return data;
    } catch (error) {
      console.error(
        "❌ Model - Lỗi khi lấy chương trình giảm giá:",
        error.message
      );
    }
  }

  static async getStoreAddress() {
    try {
      // Sửa lại: Gọi trực tiếp từ BranchModel và lấy thuộc tính data
      const { data } = await BranchModel.getAllInformationBranches();
      console.log("✅ Model - Lấy địa chỉ cửa hàng thành công.");
      return data;
    } catch (error) {
      console.error(
        "❌ Model - Lỗi khi lấy địa chỉ cửa hàng:", // Sửa lại nội dung log cho đúng
        error.message
      );
    }
  }

  static async getAllVoucher() {
    try {
      const { data } = await VoucherModel.getAllVouchers(100, 0, {
        is_active: true,
      });
      console.log("✅ Model - Lấy danh sách voucher thành công.");
      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi lấy danh sách voucher:", error.message);
    }
  }
}

module.exports = WebhookModel;
