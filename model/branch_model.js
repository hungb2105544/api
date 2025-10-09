const supabase = require("../supabaseClient");

class BranchModel {
  static SELECT_FIELDS = `
    id,
    name,
    phone,
    email,
    is_active,
    created_at,
    address:addresses (
      *,
      location:locations(*)
    )
  `;

  static async getAllBranches() {
    try {
      const { data, error } = await supabase
        .from("branches")
        .select(this.SELECT_FIELDS)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Lỗi khi lấy danh sách chi nhánh: ${error.message}`);
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi trong getAllBranches:", err.message);
      throw err;
    }
  }

  static async getBranchById(id) {
    try {
      if (!id) throw new Error("ID chi nhánh là bắt buộc.");

      const { data, error } = await supabase
        .from("branches")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116")
          throw new Error("Không tìm thấy chi nhánh.");
        throw new Error(`Lỗi khi lấy thông tin chi nhánh: ${error.message}`);
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi trong getBranchById:", err.message);
      throw err;
    }
  }

  static async createBranch(branchData) {
    try {
      const { name, phone, email, address, location } = branchData;
      if (!name || !phone || !address || !location) {
        throw new Error(
          "Tên, SĐT, địa chỉ và tọa độ của chi nhánh là bắt buộc."
        );
      }
      if (
        !address.street ||
        !address.ward ||
        !address.district ||
        !address.province
      ) {
        throw new Error("Thông tin địa chỉ không đầy đủ.");
      }
      if (
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number"
      ) {
        throw new Error("Thông tin tọa độ (latitude, longitude) không hợp lệ.");
      }

      const { data, error } = await supabase.rpc(
        "create_branch_with_address_and_location",
        {
          p_latitude: location.latitude,
          p_longitude: location.longitude,
          p_street: address.street,
          p_ward: address.ward,
          p_district: address.district,
          p_province: address.province,
          p_receiver_name: address.receiver_name || name,
          p_receiver_phone: address.receiver_phone || phone,
          p_branch_name: name,
          p_branch_phone: phone,
          p_branch_email: email,
        }
      );

      if (error) {
        throw new Error(`Không thể tạo chi nhánh trong CSDL: ${error.message}`);
      }

      const newBranchId = data[0].new_branch_id;
      return this.getBranchById(newBranchId);
    } catch (err) {
      console.error("❌ Model - Lỗi trong createBranch:", err.message);
      throw err;
    }
  }

  static async updateBranch(id, updateData) {
    try {
      if (!id) throw new Error("ID chi nhánh là bắt buộc.");

      const { name, phone, email, is_active } = updateData;
      const { data, error } = await supabase
        .from("branches")
        .update({ name, phone, email, is_active })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        if (error.code === "PGRST116")
          throw new Error("Không tìm thấy chi nhánh để cập nhật.");
        throw new Error(`Lỗi khi cập nhật chi nhánh: ${error.message}`);
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi trong updateBranch:", err.message);
      throw err;
    }
  }

  static async deleteBranch(id) {
    try {
      if (!id) throw new Error("ID chi nhánh là bắt buộc.");

      const { data, error } = await supabase
        .from("branches")
        .update({ is_active: false })
        .eq("id", id)
        .select("id")
        .single();

      if (error) {
        if (error.code === "PGRST116")
          throw new Error("Không tìm thấy chi nhánh để xóa.");
        throw new Error(`Lỗi khi xóa chi nhánh: ${error.message}`);
      }
      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi trong deleteBranch:", err.message);
      throw err;
    }
  }
}

module.exports = BranchModel;
