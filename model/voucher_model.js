const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

class VoucherModel {
  static SELECT_FIELDS =
    "id, code, name, description, type, value, min_order_value, max_discount_amount, usage_limit, usage_limit_per_user, used_count, valid_from, valid_to, is_active, created_at";

  static async getAllVouchers(limit = 10, offset = 0, filters = {}) {
    try {
      let query = supabase
        .from("vouchers")
        .select(this.SELECT_FIELDS)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters.type) {
        query = query.eq("type", filters.type);
      }
      if (filters.code) {
        query = query.eq("code", filters.code);
      }
      if (filters.is_valid) {
        query = query
          .gte("valid_to", new Date().toISOString())
          .lte("valid_from", new Date().toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          "❌ Model - Lỗi Supabase khi lấy danh sách voucher:",
          error.message
        );
        throw new Error("Không thể lấy danh sách voucher");
      }

      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy voucher:", err.message);
      throw err;
    }
  }

  static async getVoucherById(id) {
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Không tìm thấy voucher");
        }
        console.error("❌ Model - Lỗi Supabase:", error.message);
        throw new Error("Lỗi khi lấy voucher");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi lấy voucher:", error.message);
      throw error;
    }
  }

  static async createVoucher(voucherData) {
    const validTypes = ["percentage", "fixed_amount", "free_shipping"];
    if (
      !voucherData.code ||
      !voucherData.name ||
      !voucherData.type ||
      !voucherData.value ||
      !voucherData.valid_to
    ) {
      throw new Error(
        "Mã, tên, loại, giá trị và ngày hết hạn của voucher là bắt buộc"
      );
    }
    if (!validTypes.includes(voucherData.type)) {
      throw new Error(
        "Loại voucher không hợp lệ. Phải là: percentage, fixed_amount, hoặc free_shipping"
      );
    }
    if (voucherData.value <= 0) {
      throw new Error("Giá trị voucher phải lớn hơn 0");
    }
    if (new Date(voucherData.valid_to) <= new Date()) {
      throw new Error("Ngày hết hạn phải là trong tương lai");
    }

    try {
      const { data: existingVoucher, error: checkError } = await supabase
        .from("vouchers")
        .select("id")
        .eq("code", voucherData.code)
        .single();
      if (existingVoucher) {
        throw new Error("Mã voucher đã tồn tại");
      }
      if (checkError && checkError.code !== "PGRST116") {
        console.error(
          "❌ Model - Lỗi khi kiểm tra mã voucher:",
          checkError.message
        );
        throw new Error("Lỗi khi kiểm tra mã voucher");
      }

      const { data, error } = await supabase
        .from("vouchers")
        .insert([
          {
            code: voucherData.code,
            name: voucherData.name,
            description: voucherData.description || null,
            type: voucherData.type,
            value: voucherData.value,
            min_order_value: voucherData.min_order_value || 0,
            max_discount_amount: voucherData.max_discount_amount || null,
            usage_limit: voucherData.usage_limit || null,
            usage_limit_per_user: voucherData.usage_limit_per_user || 1,
            used_count: 0,
            valid_from: voucherData.valid_from || new Date().toISOString(),
            valid_to: voucherData.valid_to,
            is_active: true,
          },
        ])
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        console.error("❌ Model - Lỗi khi tạo voucher:", error.message);
        throw new Error("Không thể tạo voucher mới");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi tạo voucher:", error.message);
      throw error;
    }
  }

  static async updateVoucher(id, voucherData) {
    const validTypes = ["percentage", "fixed_amount", "free_shipping"];
    if (voucherData.type && !validTypes.includes(voucherData.type)) {
      throw new Error(
        "Loại voucher không hợp lệ. Phải là: percentage, fixed_amount, hoặc free_shipping"
      );
    }
    if (voucherData.value && voucherData.value <= 0) {
      throw new Error("Giá trị voucher phải lớn hơn 0");
    }
    if (voucherData.valid_to && new Date(voucherData.valid_to) <= new Date()) {
      throw new Error("Ngày hết hạn phải là trong tương lai");
    }

    try {
      const { data: existingVoucher, error: fetchError } = await supabase
        .from("vouchers")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (fetchError || !existingVoucher) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy voucher");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra voucher:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra voucher");
      }

      if (voucherData.code && voucherData.code !== existingVoucher.code) {
        const { data: codeCheck, error: checkError } = await supabase
          .from("vouchers")
          .select("id")
          .eq("code", voucherData.code)
          .single();
        if (codeCheck) {
          throw new Error("Mã voucher đã tồn tại");
        }
        if (checkError && checkError.code !== "PGRST116") {
          console.error(
            "❌ Model - Lỗi khi kiểm tra mã voucher:",
            checkError.message
          );
          throw new Error("Lỗi khi kiểm tra mã voucher");
        }
      }

      const updateData = {
        code: voucherData.code || existingVoucher.code,
        name: voucherData.name || existingVoucher.name,
        description: voucherData.description ?? existingVoucher.description,
        type: voucherData.type || existingVoucher.type,
        value: voucherData.value || existingVoucher.value,
        min_order_value:
          voucherData.min_order_value ?? existingVoucher.min_order_value,
        max_discount_amount:
          voucherData.max_discount_amount ??
          existingVoucher.max_discount_amount,
        usage_limit: voucherData.usage_limit ?? existingVoucher.usage_limit,
        usage_limit_per_user:
          voucherData.usage_limit_per_user ||
          existingVoucher.usage_limit_per_user,
        valid_from: voucherData.valid_from || existingVoucher.valid_from,
        valid_to: voucherData.valid_to || existingVoucher.valid_to,
      };

      const { data, error } = await supabase
        .from("vouchers")
        .update(updateData)
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        console.error("❌ Model - Lỗi khi cập nhật voucher:", error.message);
        throw new Error("Không thể cập nhật voucher");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi cập nhật voucher:", error.message);
      throw error;
    }
  }

  static async deleteVoucher(id) {
    try {
      const { data: existingVoucher, error: fetchError } = await supabase
        .from("vouchers")
        .select("id, is_active")
        .eq("id", id)
        .single();

      if (fetchError || !existingVoucher) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy voucher");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra voucher:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra voucher");
      }

      const { count, error: usageError } = await supabase
        .from("user_vouchers")
        .select("id", { count: "exact", head: true })
        .eq("voucher_id", id)
        .eq("is_used", false);

      if (usageError) {
        console.error(
          "❌ Model - Lỗi khi kiểm tra user_vouchers:",
          usageError.message
        );
        throw new Error("Lỗi khi kiểm tra ràng buộc voucher");
      }
      if (count > 0) {
        throw new Error(
          "Không thể xóa voucher vì còn người dùng sở hữu voucher chưa sử dụng"
        );
      }

      const { data, error } = await supabase
        .from("vouchers")
        .update({ is_active: false })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        console.error("❌ Model - Lỗi khi xóa voucher:", error.message);
        throw new Error("Không thể xóa voucher");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi xóa voucher:", error.message);
      throw error;
    }
  }
}

module.exports = VoucherModel;
