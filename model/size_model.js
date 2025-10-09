const supabase = require("../supabaseClient");

class SizeModel {
  static SELECT_FIELDS = "id, size_name, sort_order";

  static async getAllSizes() {
    try {
      const { data, error } = await supabase
        .from("sizes")
        .select(this.SELECT_FIELDS)
        .order("sort_order", { ascending: true });

      if (error) {
        throw new Error(`Lỗi khi lấy danh sách kích thước: ${error.message}`);
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi trong getAllSizes:", err.message);
      throw err;
    }
  }

  static async createSize(sizeData) {
    try {
      const { size_name, sort_order } = sizeData;
      if (!size_name) {
        throw new Error("Tên kích thước (size_name) là bắt buộc.");
      }

      const { data, error } = await supabase
        .from("sizes")
        .insert({ size_name, sort_order: sort_order || 0 })
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Tên kích thước đã tồn tại.");
        }
        throw new Error(`Không thể tạo kích thước mới: ${error.message}`);
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi trong createSize:", err.message);
      throw err;
    }
  }

  static async updateSize(id, updateData) {
    try {
      const { size_name, sort_order } = updateData;
      if (!id) throw new Error("ID kích thước là bắt buộc.");

      const { data, error } = await supabase
        .from("sizes")
        .update({ size_name, sort_order })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        if (error.code === "PGRST116")
          throw new Error("Không tìm thấy kích thước để cập nhật.");
        if (error.code === "23505")
          throw new Error("Tên kích thước đã tồn tại.");
        throw new Error(`Lỗi khi cập nhật kích thước: ${error.message}`);
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi trong updateSize:", err.message);
      throw err;
    }
  }

  static async deleteSize(id) {
    try {
      if (!id) throw new Error("ID kích thước là bắt buộc.");

      const { data: variants, error: checkError } = await supabase
        .from("product_variants")
        .select("id", { count: "exact" })
        .eq("size_id", id);

      if (checkError) {
        throw new Error(`Lỗi khi kiểm tra ràng buộc: ${checkError.message}`);
      }
      if (variants && variants.length > 0) {
        throw new Error(
          "Không thể xóa vì kích thước này đang được sử dụng bởi các biến thể sản phẩm."
        );
      }

      const { error } = await supabase.from("sizes").delete().eq("id", id);

      if (error) {
        throw new Error(`Lỗi khi xóa kích thước: ${error.message}`);
      }
      return { id };
    } catch (err) {
      console.error("❌ Model - Lỗi trong deleteSize:", err.message);
      throw err;
    }
  }
}

module.exports = SizeModel;
