const supabase = require("../supabaseClient");

class ProductDiscountModel {
  static SELECT_FIELDS =
    "id, product_id, products(name, sku), discount_percentage, discount_amount, start_date, end_date, is_active, created_at";

  /**
   * @description Tạo một chương trình giảm giá mới cho sản phẩm.
   * @param {object} discountData - Dữ liệu giảm giá.
   * @returns {Promise<object>} - Dữ liệu giảm giá đã được tạo.
   * @throws {Error} Nếu dữ liệu không hợp lệ hoặc có lỗi xảy ra.
   */
  static async createDiscount(discountData) {
    const {
      product_id,
      discount_percentage,
      discount_amount,
      start_date,
      end_date,
      is_active = true,
    } = discountData;

    // --- Validation ---
    if (!product_id || !start_date || !end_date) {
      throw new Error(
        "ID sản phẩm, ngày bắt đầu và ngày kết thúc là bắt buộc."
      );
    }
    if (!discount_percentage && !discount_amount) {
      throw new Error("Phải cung cấp giảm giá theo % hoặc số tiền.");
    }
    if (discount_percentage && discount_amount) {
      throw new Error(
        "Chỉ có thể chọn một trong hai: giảm giá theo % hoặc số tiền."
      );
    }
    if (new Date(start_date) >= new Date(end_date)) {
      throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
    }

    try {
      const { data, error } = await supabase
        .from("product_discounts")
        .insert({
          product_id,
          discount_percentage,
          discount_amount,
          start_date,
          end_date,
          is_active,
        })
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        console.error("❌ Model - Lỗi khi tạo giảm giá:", error.message);
        throw new Error("Không thể tạo chương trình giảm giá.");
      }

      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi không mong muốn:", err.message);
      throw err;
    }
  }

  /**
   * @description Lấy tất cả các chương trình giảm giá, có thể lọc.
   * @param {object} filters - Bộ lọc (VD: { product_id, is_active }).
   * @returns {Promise<Array<object>>} - Danh sách các chương trình giảm giá.
   */
  static async getAllDiscounts(filters = {}) {
    try {
      let query = supabase
        .from("product_discounts")
        .select(this.SELECT_FIELDS)
        .order("created_at", { ascending: false });

      if (filters.product_id) {
        query = query.eq("product_id", filters.product_id);
      }
      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error("Không thể lấy danh sách giảm giá.");
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy danh sách giảm giá:", err.message);
      throw err;
    }
  }

  /**
   * @description Lấy chi tiết một chương trình giảm giá theo ID.
   * @param {number} id - ID của chương trình giảm giá.
   * @returns {Promise<object>} - Chi tiết chương trình giảm giá.
   */
  static async getDiscountById(id) {
    try {
      const { data, error } = await supabase
        .from("product_discounts")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116")
          throw new Error("Không tìm thấy chương trình giảm giá.");
        throw new Error("Lỗi khi lấy chi tiết giảm giá.");
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy giảm giá theo ID:", err.message);
      throw err;
    }
  }

  /**
   * @description Cập nhật một chương trình giảm giá.
   * @param {number} id - ID của chương trình giảm giá.
   * @param {object} updateData - Dữ liệu cần cập nhật.
   * @returns {Promise<object>} - Dữ liệu sau khi cập nhật.
   */
  static async updateDiscount(id, updateData) {
    try {
      const { data, error } = await supabase
        .from("product_discounts")
        .update(updateData)
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        if (error.code === "PGRST116")
          throw new Error("Không tìm thấy chương trình giảm giá để cập nhật.");
        throw new Error("Không thể cập nhật chương trình giảm giá.");
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi cập nhật giảm giá:", err.message);
      throw err;
    }
  }

  /**
   * @description Xóa một chương trình giảm giá (xóa cứng).
   * @param {number} id - ID của chương trình giảm giá.
   * @returns {Promise<boolean>} - true nếu thành công.
   */
  static async deleteDiscount(id) {
    try {
      const { error } = await supabase
        .from("product_discounts")
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error("Không thể xóa chương trình giảm giá.");
      }
      return true;
    } catch (err) {
      console.error("❌ Model - Lỗi khi xóa giảm giá:", err.message);
      throw err;
    }
  }
}

module.exports = ProductDiscountModel;
