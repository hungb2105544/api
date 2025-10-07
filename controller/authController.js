const supabase = require("../supabaseClient");
const jwt = require("jsonwebtoken");

class AuthController {
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Xác thực người dùng với Supabase Auth
      const {
        data: { user },
        error,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !user) {
        return res.status(401).json({
          success: false,
          message: "Email hoặc mật khẩu không đúng",
        });
      }

      // Lấy thông tin profile từ bảng user_profiles
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy thông tin người dùng",
        });
      }

      // Tạo token JWT
      const payload = {
        id: profile.id,
        role: profile.role || "user", // Giả sử role được lưu trong user_profiles
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      return res.status(200).json({
        success: true,
        message: "Đăng nhập thành công",
        data: {
          token,
          user: {
            id: profile.id,
            role: profile.role,
          },
        },
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi đăng nhập:", error.message);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi đăng nhập",
      });
    }
  }
}

module.exports = AuthController;
