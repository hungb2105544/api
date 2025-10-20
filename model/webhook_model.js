const ProductDiscountModel = require("./product_discount_model");
const BranchModel = require("./branch_model"); // Sửa lỗi chính tả BrachModel -> BranchModel
const VoucherModel = require("./voucher_model");
const ProductModel = require("./product_model"); // Giả sử có model sản phẩm
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

  static async getProductsByBrandAndType(brand, type) {
    try {
      // Tối ưu: Chỉ xây dựng bộ lọc nếu có giá trị
      const filters = {};
      if (brand && brand.trim() !== "") {
        filters.brand_name = brand;
      }
      if (type && type.trim() !== "") {
        filters.type_name = type;
      }

      // Nếu không có bộ lọc nào, không cần truy vấn
      if (Object.keys(filters).length === 0) {
        console.log(
          "⚠️ Model - Không có tên thương hiệu hoặc loại sản phẩm để tìm kiếm."
        );
        return [];
      }

      const data = await ProductModel.getProductsWithTypesAndBrands(filters);
      console.log(
        "✅ Model - Lấy sản phẩm theo thương hiệu và loại thành công."
      );
      return data || []; // Đảm bảo luôn trả về một mảng
    } catch (error) {
      console.error(
        "❌ Model - Lỗi khi lấy sản phẩm theo thương hiệu và loại:",
        error.message
      );
      return []; // Trả về mảng rỗng khi có lỗi
    }
  }
}

module.exports = WebhookModel;
