const ProductDiscountModel = require("../model/product_discount_model");

class ProductDiscountController {
  static async createDiscount(req, res) {
    try {
      const newDiscount = await ProductDiscountModel.createDiscount(req.body);
      res.status(201).json({
        success: true,
        message: "Tạo giảm giá thành công.",
        data: newDiscount,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getAllDiscounts(req, res) {
    try {
      const { product_id, is_active } = req.query;
      const filters = {};
      if (product_id) filters.product_id = parseInt(product_id);
      if (is_active !== undefined) filters.is_active = is_active === "true";

      const discounts = await ProductDiscountModel.getAllDiscounts(filters);
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
      const discounts = await ProductDiscountModel.getAllDiscounts({
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
      const { product_id, created_at, products, ...updateData } = req.body;

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
}

module.exports = ProductDiscountController;
