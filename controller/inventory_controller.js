const InventoryModel = require("../model/inventory_model");
const ExcelJS = require("exceljs");
class InventoryController {
  // Lấy danh sách tồn kho
  static async getAllInventory(req, res) {
    try {
      const {
        limit = 10,
        offset = 0,
        branch_id,
        product_id,
        variant_id,
        has_stock,
        product_name,
        low_stock,
      } = req.query;
      const filters = {
        branch_id: branch_id ? parseInt(branch_id) : null,
        product_id: product_id ? parseInt(product_id) : null,
        variant_id: variant_id ? parseInt(variant_id) : null,
        has_stock: has_stock === "true",
        product_name: product_name || null,
        low_stock: low_stock === "true",
      };

      const inventory = await InventoryModel.getAllInventory(
        parseInt(limit),
        parseInt(offset),
        filters
      );
      return res.status(200).json({
        success: true,
        data: inventory.data,
        total: inventory.total,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy danh sách tồn kho:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi lấy danh sách tồn kho",
      });
    }
  }

  // Lấy chi tiết tồn kho theo ID
  static async getInventoryById(req, res) {
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID tồn kho không hợp lệ",
        });
      }

      const inventory = await InventoryModel.getInventoryById(id);
      return res.status(200).json({
        success: true,
        data: inventory,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi lấy tồn kho:", error.message);
      return res
        .status(error.message === "Không tìm thấy bản ghi tồn kho" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi server khi lấy tồn kho",
        });
    }
  }

  // Thêm hoặc cập nhật tồn kho
  static async upsertInventory(req, res) {
    try {
      const inventoryData = req.body;
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (
        !inventoryData.branch_id ||
        !inventoryData.product_id ||
        typeof inventoryData.quantity !== "number" ||
        inventoryData.quantity < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Chi nhánh, sản phẩm và số lượng (≥ 0) là bắt buộc",
        });
      }

      const result = await InventoryModel.upsertInventory(
        inventoryData,
        userId
      );
      return res.status(201).json({
        success: true,
        data: result,
        message: "Thêm/cập nhật tồn kho thành công",
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi thêm/cập nhật tồn kho:",
        error.message
      );
      return res
        .status(error.message.includes("vượt quá mức tối đa") ? 400 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi server khi thêm/cập nhật tồn kho",
        });
    }
  }

  // Giảm tồn kho (khi đặt hàng)
  static async decreaseInventory(req, res) {
    try {
      const { branch_id, product_id, variant_id } = req.body;
      const quantity = parseInt(req.body.quantity);
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (!branch_id || !product_id || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc",
        });
      }

      const result = await InventoryModel.decreaseInventory(
        parseInt(branch_id),
        parseInt(product_id),
        variant_id ? parseInt(variant_id) : null,
        quantity,
        userId
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Giảm tồn kho thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi giảm tồn kho:", error.message);
      return res
        .status(
          error.message === "Số lượng tồn kho không đủ" ||
            error.message.includes("không tồn tại")
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi giảm tồn kho",
        });
    }
  }

  // Tăng tồn kho (khi nhập hàng)
  static async increaseInventory(req, res) {
    try {
      const { branch_id, product_id, variant_id } = req.body;
      const quantity = parseInt(req.body.quantity);
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (!branch_id || !product_id || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc",
        });
      }

      const result = await InventoryModel.increaseInventory(
        parseInt(branch_id),
        parseInt(product_id),
        variant_id ? parseInt(variant_id) : null,
        quantity,
        userId
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Tăng tồn kho thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi tăng tồn kho:", error.message);
      return res
        .status(
          error.message.includes("vượt quá mức tối đa") ||
            error.message.includes("không tồn tại")
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi tăng tồn kho",
        });
    }
  }

  // Hoàn tồn kho (khi hủy đơn hàng)
  static async cancelOrderInventory(req, res) {
    try {
      const { branch_id, product_id, variant_id } = req.body;
      const quantity = parseInt(req.body.quantity);
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (!branch_id || !product_id || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc",
        });
      }

      const result = await InventoryModel.cancelOrderInventory(
        parseInt(branch_id),
        parseInt(product_id),
        variant_id ? parseInt(variant_id) : null,
        quantity,
        userId
      );
      return res.status(200).json({
        success: true,
        data: result,
        message: "Hoàn tồn kho thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi hoàn tồn kho:", error.message);
      return res
        .status(
          error.message === "Số lượng giữ chỗ không đủ" ||
            error.message.includes("vượt quá mức tối đa") ||
            error.message.includes("không tồn tại")
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi hoàn tồn kho",
        });
    }
  }

  // Xóa tồn kho (đặt quantity = 0)
  static async deleteInventory(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null; // Giả định user ID từ middleware xác thực

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID tồn kho không hợp lệ",
        });
      }

      const result = await InventoryModel.deleteInventory(parseInt(id), userId);
      return res.status(200).json({
        success: true,
        data: result,
        message: "Xóa tồn kho thành công",
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi xóa tồn kho:", error.message);
      return res
        .status(
          error.message === "Không tìm thấy bản ghi tồn kho" ||
            error.message === "Không thể xóa vì vẫn còn số lượng giữ chỗ"
            ? 400
            : 500
        )
        .json({
          success: false,
          message: error.message || "Lỗi server khi xóa tồn kho",
        });
    }
  }

  // THÊM MỚI: Lấy thống kê tồn kho
  static async getInventoryStats(req, res) {
    try {
      const { branch_id } = req.query;
      const stats = await InventoryModel.getInventoryStats(
        branch_id ? parseInt(branch_id) : null
      );
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy thống kê tồn kho:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi lấy thống kê tồn kho",
      });
    }
  }

  // THÊM MỚI: Lấy thống kê tóm tắt tồn kho cho dashboard
  static async getInventorySummary(req, res) {
    try {
      const { branch_id } = req.query;
      const summary = await InventoryModel.getInventorySummary(
        branch_id ? parseInt(branch_id) : null
      );
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy tóm tắt tồn kho:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi lấy tóm tắt tồn kho",
      });
    }
  }
  static async exportInventory(req, res) {
    try {
      const { branch_id, product_name, branch_name } = req.query;

      // 1️⃣ Bộ lọc
      const filters = {
        branch_id: branch_id ? parseInt(branch_id, 10) : null,
        product_name: product_name?.trim() || null,
      };

      // 2️⃣ Kiểm tra dữ liệu tồn kho
      const { total } = await InventoryModel.getAllInventory(1, 0, filters);
      if (total === 0) {
        return res.status(404).json({
          success: false,
          message: "Không có dữ liệu tồn kho để xuất",
        });
      }

      // 3️⃣ Lấy toàn bộ dữ liệu
      const inventoryData = await InventoryModel.exportAllInventory(filters);

      // 4️⃣ Tạo workbook & worksheet
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Tồn Kho");

      // 5️⃣ Cấu hình column
      sheet.columns = [
        { header: "Sản phẩm", key: "product_name", width: 35 },
        { header: "Màu sắc", key: "color", width: 15 },
        { header: "Kích thước", key: "size", width: 12 },
        { header: "Chi nhánh", key: "branch", width: 25 },
        { header: "Tồn kho", key: "quantity", width: 12 },
        { header: "Đang giữ", key: "reserved", width: 12 },
        { header: "Cập nhật", key: "updated_at", width: 20 },
      ];

      // 6️⃣ Tiêu đề & thông tin báo cáo
      sheet.mergeCells("A1:G1");
      const title = sheet.getCell("A1");
      title.value = "BÁO CÁO TỒN KHO";
      title.font = { name: "Arial", size: 16, bold: true };
      title.alignment = { horizontal: "center", vertical: "middle" };

      sheet.mergeCells("A2:D2");
      sheet.mergeCells("E2:G2");
      const infoLeft = sheet.getCell("A2");
      const infoRight = sheet.getCell("E2");
      infoLeft.value = branch_id
        ? `Chi nhánh: ${branch_name || `ID ${branch_id}`}`
        : "Toàn hệ thống";
      infoRight.value = `Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`;
      infoLeft.font = infoRight.font = { italic: true };
      infoRight.alignment = { horizontal: "right" };

      sheet.addRow([]); // dòng trống

      // 7️⃣ Header
      const headerRow = sheet.addRow([
        "Sản phẩm",
        "Màu sắc",
        "Kích thước",
        "Chi nhánh",
        "Tồn kho",
        "Đang giữ",
        "Cập nhật",
      ]);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4472C4" },
        };
        cell.font = { color: { argb: "FFFFFF" }, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // 8️⃣ Dữ liệu
      let totalQuantity = 0;
      let totalReserved = 0;
      for (const item of inventoryData) {
        let variantSize = "N/A";
        if (item.product_variants?.sizes) {
          if (Array.isArray(item.product_variants.sizes)) {
            variantSize =
              item.product_variants.sizes.map((s) => s.size_name).join(", ") ||
              "N/A";
          } else if (item.product_variants.sizes.size_name) {
            variantSize = item.product_variants.sizes.size_name;
          }
        }

        const row = sheet.addRow({
          product_name: item.products?.name || "N/A",
          color: item.product_variants?.color || "N/A",
          size: variantSize,
          branch: item.branches?.name || "N/A",
          quantity: item.quantity ?? 0,
          reserved: item.reserved_quantity ?? 0,
          updated_at: item.updated_at
            ? new Date(item.updated_at).toLocaleString("vi-VN", {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "N/A",
        });

        // Căn chỉnh
        row.eachCell((cell, col) => {
          if ([5, 6].includes(col)) cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });

        // Tô màu khi tồn kho thấp
        if (item.quantity <= (item.min_stock_level ?? 5)) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF4CCCC" }, // đỏ nhạt
            };
          });
        }

        totalQuantity += item.quantity ?? 0;
        totalReserved += item.reserved_quantity ?? 0;
      }

      // 9️⃣ Tổng cộng
      const totalRow = sheet.addRow([
        "Tổng cộng",
        "",
        "",
        "",
        totalQuantity,
        totalReserved,
        "",
      ]);
      sheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`);
      totalRow.getCell(1).alignment = { horizontal: "center" };
      totalRow.font = { bold: true };

      // 🔟 Viền & căn chỉnh
      sheet.eachRow((row) => {
        row.height = 22;
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "CCCCCC" } },
            left: { style: "thin", color: { argb: "CCCCCC" } },
            bottom: { style: "thin", color: { argb: "CCCCCC" } },
            right: { style: "thin", color: { argb: "CCCCCC" } },
          };
        });
      });

      // 1️⃣2️⃣ Xuất file
      const rawFileName = `BaoCaoTonKho_${
        branch_name ? branch_name.replace(/[\s\/\\]/g, "_") : "ToanHeThong"
      }_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const encodedFileName = encodeURIComponent(rawFileName);
      const safeFileName = rawFileName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("❌ Lỗi khi xuất Excel:", error.message);
      res.status(500).json({
        success: false,
        message: `Không thể xuất file Excel: ${error.message}`,
      });
    }
  }
}

module.exports = InventoryController;
