require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const supabase = require("./supabaseClient");
const productRoutes = require("./route/product_route");
const voucherRoutes = require("./route/voucher_route");
const orderRoutes = require("./route/order_route");
const inventoryRoutes = require("./route/inventory_route");
const authRoutes = require("./route/auth_route");
const variantRoute = require("./route/product_variant_route");
const productTypeRoutes = require("./route/product_type_route");
const brandRoutes = require("./route/brand_route");
const brandTypeRoutes = require("./route/brand_type_route");
const notificationRoutes = require("./route/notification_route");
const dashboardRoutes = require("./route/dashboard_route");
const userRoutes = require("./route/user_route");
const branchRoutes = require("./route/branch_route");
const sizeRoutes = require("./route/size_route");
const statsRoutes = require("./routes/stats_routes");
const discountRoutes = require("./route/product_discount_route");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Kiểm tra biến môi trường
const requiredEnvVars = ["JWT_SECRET", "SUPABASE_URL", "SUPABASE_KEY"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

// Đảm bảo thư mục uploads
const uploadDir = path.join(__dirname, "uploads");
const ensureUploadDir = async () => {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    console.log("✅ Upload directory ensured:", uploadDir);
  } catch (error) {
    console.error("❌ Failed to create upload directory:", error.message);
    process.exit(1);
  }
};

// Middleware toàn cục
app.use(cors()); // Cho phép yêu cầu từ các nguồn khác
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 500,
    message: {
      success: false,
      message: "Quá nhiều yêu cầu, vui lòng thử lại sau.",
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Đăng ký các tuyến đường
app.use("/api/products", productRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/login", authRoutes);
app.use("/api/variants", variantRoute);
app.use("/api/product-types", productTypeRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/brand-types", brandTypeRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/sizes", sizeRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/discounts", discountRoutes);
//webhook route
app.use("/api/webhook", require("./route/webhook_route"));
// Route kiểm tra server
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Kiểm tra kết nối Supabase
async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .limit(1);
    if (error) {
      console.error("❌ Supabase connection failed:", error.message);
      return false;
    }
    console.log("✅ Supabase connection successful!");
    return true;
  } catch (error) {
    console.error("❌ Unexpected error during Supabase check:", error.message);
    return false;
  }
}

// Middleware xử lý lỗi toàn cục
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    timestamp: new Date().toISOString(),
  });
});

// Khởi động server
const startServer = async () => {
  try {
    await ensureUploadDir(); // Đảm bảo thư mục uploads
    const supabaseConnected = await checkSupabaseConnection();
    if (!supabaseConnected) {
      console.error(
        "❌ Server startup aborted due to Supabase connection failure"
      );
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
