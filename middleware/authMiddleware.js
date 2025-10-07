const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // Lấy token từ header Authorization
  const token = req.headers.authorization?.split(" ")[1];

  // Kiểm tra xem token có tồn tại không
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Yêu cầu xác thực. Vui lòng cung cấp token.",
    });
  }

  try {
    // Xác minh token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra vai trò admin
    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập. Chỉ admin được phép.",
      });
    }

    // Lưu thông tin người dùng vào req.user
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("❌ Middleware - Lỗi xác thực token:", error.message);
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn.",
    });
  }
};

module.exports = authMiddleware;
