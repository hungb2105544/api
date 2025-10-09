const supabase = require("../supabaseClient");

class UserInformationModel {
  static SELECT_FIELDS =
    "full_name, phone_number, gender, date_of_birth, avatar_url";

  static async getInformationByUserId(id) {
    try {
      if (!id) {
        throw new Error("ID người dùng là bắt buộc.");
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Không tìm thấy người dùng với ID đã cung cấp.");
        }
        throw new Error(
          `Lỗi khi truy vấn thông tin người dùng: ${error.message}`
        );
      }

      return data;
    } catch (err) {
      console.error(
        "❌ Model - Lỗi trong getInformationByUserId:",
        err.message
      );

      throw err;
    }
  }
}

module.exports = UserInformationModel;
