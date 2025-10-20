const supabase = require("../supabaseClient");

class BranchModel {
  static SELECT_FIELDS =
    "id, name, phone, email, is_active, created_at, address_id, addresses(*)";

  static async getAllBranches(filters = {}) {
    try {
      let query = supabase
        .from("branches")
        .select(this.SELECT_FIELDS, { count: "exact" });

      if (typeof filters.is_active === "boolean") {
        query = query.eq("is_active", filters.is_active);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;
      if (error) throw new Error("Không thể lấy danh sách chi nhánh");
      return { data, count };
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy chi nhánh:", err.message);
      throw err;
    }
  }

  static async getAllInformationBranches() {
    try {
      let query = supabase
        .from("branches")
        .select("*, addresses(*, locations(*))", { count: "exact" })
        .eq("is_active", true);

      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;
      if (error) throw new Error("Không thể lấy danh sách chi nhánh");
      return { data, count };
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy chi nhánh:", err.message);
      throw err;
    }
  }

  static async getBranchById(id) {
    try {
      const { data, error } = await supabase
        .from("branches")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116")
          throw new Error("Không tìm thấy chi nhánh");
        throw new Error("Lỗi khi lấy chi tiết chi nhánh");
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy chi tiết chi nhánh:", err.message);
      throw err;
    }
  }

  static async createBranch(branchData) {
    const { name, phone, email, address } = branchData;
    if (!name || !phone || !address) {
      throw new Error("Tên, điện thoại và địa chỉ là bắt buộc");
    }

    try {
      // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
      const { data, error } = await supabase.rpc("create_branch_with_address", {
        p_name: name,
        p_phone: phone,
        p_email: email,
        p_street: address.street,
        p_ward: address.ward,
        p_district: address.district,
        p_province: address.province,
        p_receiver_name: address.receiver_name,
        p_receiver_phone: address.receiver_phone,
      });

      if (error) throw new Error("Không thể tạo chi nhánh: " + error.message);
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi tạo chi nhánh:", err.message);
      throw err;
    }
  }

  static async updateBranch(id, branchData) {
    const { name, phone, email, is_active, address, address_id } = branchData;
    try {
      // Cập nhật bảng addresses trước
      if (address && address_id) {
        const { error: addressError } = await supabase
          .from("addresses")
          .update(address)
          .eq("id", address_id);
        if (addressError)
          throw new Error(
            "Không thể cập nhật địa chỉ: " + addressError.message
          );
      }

      // Cập nhật bảng branches
      const { data, error: branchError } = await supabase
        .from("branches")
        .update({ name, phone, email, is_active })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (branchError)
        throw new Error("Không thể cập nhật chi nhánh: " + branchError.message);
      return data;
    } catch (err) {
      console.error(
        `❌ Model - Lỗi khi cập nhật chi nhánh ${id}:`,
        err.message
      );
      throw err;
    }
  }

  static async deleteBranch(id) {
    try {
      // Soft delete bằng cách đặt is_active = false
      const { data, error } = await supabase
        .from("branches")
        .update({ is_active: false })
        .eq("id", id)
        .select("id")
        .single();

      if (error) throw new Error("Không thể xóa chi nhánh");
      return data;
    } catch (err) {
      console.error(`❌ Model - Lỗi khi xóa chi nhánh ${id}:`, err.message);
      throw err;
    }
  }
}

module.exports = BranchModel;
