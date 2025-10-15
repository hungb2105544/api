const supabase = require("../supabaseClient");

class ProductDiscountModel {
  static SELECT_FIELDS =
    "id, name, product_id, brand_id, type_id, apply_to_all, products(name, sku), brands(brand_name), product_types(type_name), discount_percentage, discount_amount, start_date, end_date, is_active, created_at";

  /**
   * @description Tạo một chương trình giảm giá mới cho sản phẩm.
   * @param {object} discountData - Dữ liệu giảm giá.
   * @returns {Promise<object>} - Dữ liệu giảm giá đã được tạo.
   * @throws {Error} Nếu dữ liệu không hợp lệ hoặc có lỗi xảy ra.
   */
  static async createDiscount(discountData) {
    const {
      name,
      product_id,
      brand_id,
      type_id,
      apply_to_all,
      discount_percentage,
      discount_amount,
      start_date,
      end_date,
      is_active = true,
    } = discountData;

    // --- Validation ---
    if (!name || !start_date || !end_date) {
      throw new Error(
        "Tên chương trình, ngày bắt đầu và ngày kết thúc là bắt buộc."
      );
    }
    // Các validation này đã được xử lý bởi `CHECK` constraint trong CSDL,
    // nhưng việc kiểm tra ở đây sẽ trả về lỗi thân thiện hơn.
    const scopeCount = [product_id, brand_id, type_id, apply_to_all].filter(
      (v) => v !== null && v !== undefined && v !== false
    ).length;
    if (scopeCount !== 1) {
      throw new Error(
        "Phải chọn một và chỉ một phạm vi áp dụng (sản phẩm, thương hiệu, loại, hoặc tất cả)."
      );
    }

    if (new Date(start_date) >= new Date(end_date)) {
      throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
    }

    try {
      const { data, error } = await supabase
        .from("product_discounts")
        .insert({
          name,
          product_id,
          brand_id,
          type_id,
          apply_to_all,
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
        if (error.message.includes("chk_discount_scope")) {
          throw new Error("Lỗi phạm vi: Chỉ được chọn một phạm vi áp dụng.");
        }
        if (error.message.includes("chk_discount_value")) {
          throw new Error(
            "Lỗi giá trị: Chỉ được điền giảm giá theo % hoặc số tiền."
          );
        }
        throw new Error(
          "Không thể tạo chương trình giảm giá. Lỗi: " + error.message
        );
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
      if (filters.brand_id) {
        query = query.eq("brand_id", filters.brand_id);
      }
      if (filters.type_id) {
        query = query.eq("type_id", filters.type_id);
      }
      if (filters.apply_to_all !== undefined) {
        query = query.eq("apply_to_all", filters.apply_to_all);
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
    // Validation
    if (
      updateData.start_date &&
      updateData.end_date &&
      new Date(updateData.start_date) >= new Date(updateData.end_date)
    ) {
      throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
    }
    if (updateData.discount_percentage && updateData.discount_amount) {
      throw new Error(
        "Chỉ có thể chọn một trong hai: giảm giá theo % hoặc số tiền."
      );
    }
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

  /**
   * @description Lấy giảm giá áp dụng cho một sản phẩm cụ thể, theo thứ tự ưu tiên.
   * Ưu tiên: Giảm giá sản phẩm > Giảm giá loại > Giảm giá thương hiệu > Giảm giá toàn bộ.
   * @param {number} productId - ID của sản phẩm.
   * @returns {Promise<object|null>} - Giảm giá tốt nhất được áp dụng hoặc null.
   */
  static async getApplicableDiscountForProduct(productId) {
    try {
      // 1. Lấy thông tin brand_id và type_id của sản phẩm
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("brand_id, type_id")
        .eq("id", productId)
        .single();

      if (productError || !product) {
        throw new Error("Không tìm thấy sản phẩm.");
      }

      const { brand_id, type_id } = product;
      const now = new Date().toISOString();

      // 2. Xây dựng các điều kiện OR để tìm tất cả các giảm giá có thể áp dụng
      const orConditions = [
        `product_id.eq.${productId}`, // Giảm giá cho sản phẩm cụ thể
        `type_id.eq.${type_id}`, // Giảm giá cho loại sản phẩm
        `brand_id.eq.${brand_id}`, // Giảm giá cho thương hiệu
        "apply_to_all.eq.true", // Giảm giá cho tất cả
      ].join(",");

      // 3. Truy vấn tất cả các giảm giá hợp lệ
      const { data: discounts, error: discountError } = await supabase
        .from("product_discounts")
        .select(this.SELECT_FIELDS)
        .eq("is_active", true)
        .lte("start_date", now)
        .gte("end_date", now)
        .or(orConditions);

      if (discountError)
        throw new Error("Lỗi khi truy vấn giảm giá: " + discountError.message);
      if (!discounts || discounts.length === 0) return null;

      // 4. Sắp xếp theo thứ tự ưu tiên và trả về cái đầu tiên
      discounts.sort((a, b) => {
        const priority = (d) =>
          d.product_id ? 4 : d.type_id ? 3 : d.brand_id ? 2 : 1;
        return priority(b) - priority(a);
      });

      return discounts[0];
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy giảm giá áp dụng:", err.message);
      throw err;
    }
  }
}

module.exports = ProductDiscountModel;
