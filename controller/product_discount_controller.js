const ProductDiscountModel = require("../model/product_discount_model");

class ProductDiscountController {
  static async createDiscount(req, res) {
    try {
      // Nhận scope_type và scope_value từ client để xác định phạm vi
      const { scope_type, scope_value, ...rest } = req.body;
      const discountData = { ...rest };

      // Dựa vào scope_type để gán giá trị cho đúng cột trong CSDL
      switch (scope_type) {
        case "product":
          discountData.product_id = scope_value;
          break;
        case "brand":
          discountData.brand_id = scope_value;
          break;
        case "type":
          discountData.type_id = scope_value;
          break;
        case "all":
          discountData.apply_to_all = true;
          break;
        default:
          throw new Error("Loại phạm vi áp dụng không hợp lệ.");
      }

      const newDiscount = await ProductDiscountModel.createDiscount(
        discountData
      );
      res.status(201).json({
        success: true,
        message: "Tạo giảm giá thành công.",
        data: newDiscount,
      });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: error.message.replace('"', "'") });
    }
  }

  static async getAllDiscounts(req, res) {
    try {
      const {
        limit = 10,
        offset = 0,
        product_id,
        brand_id,
        type_id,
        apply_to_all,
        is_active,
        name,
      } = req.query;
      const filters = {};
      if (product_id) filters.product_id = parseInt(product_id);
      if (brand_id) filters.brand_id = parseInt(brand_id);
      if (type_id) filters.type_id = parseInt(type_id);
      if (is_active !== undefined) filters.is_active = is_active === "true";
      if (apply_to_all !== undefined)
        filters.apply_to_all = apply_to_all === "true";
      if (name) filters.name = name;
      const discounts = await ProductDiscountModel.getAllDiscounts(
        parseInt(limit),
        parseInt(offset),
        filters
      );
      console.log(discounts);
      res.status(200).json({ success: true, data: discounts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getDiscountsByProductId(req, res) {
    try {
      const { productId } = req.params;
      if (!productId) {
        return res
          .status(400)
          .json({ success: false, message: "Thiếu ID sản phẩm." });
      }
      // Giả sử không cần phân trang ở đây, hoặc có thể thêm nếu cần
      const discounts = await ProductDiscountModel.getAllDiscounts(1000, 0, {
        product_id: parseInt(productId),
      });
      res.status(200).json({ success: true, data: discounts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getDiscountById(req, res) {
    try {
      const { id } = req.params;
      const discount = await ProductDiscountModel.getDiscountById(id);
      res.status(200).json({ success: true, data: discount });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy") ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async updateDiscount(req, res) {
    try {
      const { id } = req.params;
      // Loại bỏ các trường không nên cập nhật trực tiếp
      const {
        product_id,
        brand_id,
        type_id,
        apply_to_all,
        created_at,
        products,
        brands,
        product_types,
        ...updateData
      } = req.body;

      if (Object.keys(updateData).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Không có dữ liệu để cập nhật." });
      }

      const updatedDiscount = await ProductDiscountModel.updateDiscount(
        id,
        updateData
      );
      res.status(200).json({
        success: true,
        message: "Cập nhật giảm giá thành công.",
        data: updatedDiscount,
      });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy") ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async deleteDiscount(req, res) {
    try {
      const { id } = req.params;
      await ProductDiscountModel.deleteDiscount(id);
      res
        .status(200)
        .json({ success: true, message: "Xóa giảm giá thành công." });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy") ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  // API mới để lấy giảm giá áp dụng cho một sản phẩm
  static async getApplicableDiscount(req, res) {
    try {
      const { productId } = req.params;
      if (!productId) {
        return res
          .status(400)
          .json({ success: false, message: "Thiếu ID sản phẩm." });
      }

      const discount =
        await ProductDiscountModel.getApplicableDiscountForProduct(
          parseInt(productId)
        );

      res.status(200).json({ success: true, data: discount });
    } catch (error) {
      const statusCode = error.message.includes("Không tìm thấy") ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }
}

module.exports = ProductDiscountController;
