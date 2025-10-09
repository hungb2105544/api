const ProductModel = require("../model/product_model");
const upload = require("../config/multerConfig"); // Import cấu hình Multer

class ProductController {
  // Lấy danh sách sản phẩm
  static async getAllProducts(req, res) {
    try {
      const { limit = 10, offset = 0, name, brand_id, type_id } = req.query;

      const filters = { name, brand_id, type_id };
      const products = await ProductModel.getAllProduct(
        parseInt(limit),
        parseInt(offset),
        filters
      );
      return res.status(200).json({
        success: true,
        message: "Lấy danh sách sản phẩm thành công",
        data: products,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy danh sách sản phẩm:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi lấy danh sách sản phẩm",
      });
    }
  }

  // Lấy chi tiết sản phẩm theo ID
  static async getProductById(req, res) {
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID sản phẩm không hợp lệ",
        });
      }

      const product = await ProductModel.getProductById(parseInt(id));
      return res.status(200).json({
        success: true,
        message: "Lấy chi tiết sản phẩm thành công",
        data: product,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi lấy sản phẩm:", error.message);
      return res
        .status(error.message === "Không tìm thấy sản phẩm" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi khi lấy sản phẩm",
        });
    }
  }

  // Tạo sản phẩm mới
  static async createProduct(req, res) {
    try {
      const productData = req.body;
      const imageFiles = req.files;

      // Xác thực dữ liệu đầu vào
      if (!productData.name || !productData.brand_id || !productData.type_id) {
        return res.status(400).json({
          success: false,
          message: "Tên sản phẩm, thương hiệu và loại sản phẩm là bắt buộc",
        });
      }

      const product = await ProductModel.createProduct(productData, imageFiles);
      return res.status(201).json({
        success: true,
        message: "Tạo sản phẩm thành công",
        data: product,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi tạo sản phẩm:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi tạo sản phẩm",
      });
    }
  }

  // Cập nhật sản phẩm
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const { removeImageUrls, ...productData } = req.body; // Lấy removeImageUrls từ body
      const imageFiles = req.files;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID sản phẩm không hợp lệ",
        });
      }

      const product = await ProductModel.updateProduct(
        parseInt(id),
        { ...productData, removeImageUrls },
        imageFiles
      );
      return res.status(200).json({
        success: true,
        message: "Cập nhật sản phẩm thành công",
        data: product,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi cập nhật sản phẩm:",
        error.message
      );
      return res
        .status(error.message === "Không tìm thấy sản phẩm" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi khi cập nhật sản phẩm",
        });
    }
  }
  // Xóa sản phẩm (soft delete)
  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID sản phẩm không hợp lệ",
        });
      }

      const product = await ProductModel.deleteProduct(parseInt(id));
      return res.status(200).json({
        success: true,
        message: "Xóa sản phẩm thành công",
        data: product,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi xóa sản phẩm:", error.message);
      return res
        .status(error.message === "Không tìm thấy sản phẩm" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi khi xóa sản phẩm",
        });
    }
  }
}

// Export middleware và controller
module.exports = {
  upload: upload.array("images", 5),
  ProductController,
};
