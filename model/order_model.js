const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

const NotificationModel = require("./notification_model");
const InventoryModel = require("./inventory_model"); // THÊM MỚI

class OrderModel {
  // Cập nhật SELECT_FIELDS để bao gồm các quan hệ cần thiết
  static SELECT_FIELDS = `
    id, order_number, user_id, user_address_id, subtotal, discount_amount, shipping_fee, tax_amount, total, voucher_id, points_earned, points_used, status, payment_status, payment_method, payment_reference, notes, estimated_delivery_date, delivered_at, created_at, updated_at,
    user_profiles(*),
    user_addresses(addresses(*)),
    order_items (
      id, quantity, product_id, variant_id,
      products (id, name, image_urls, sku),
      product_variants (
        *,
        product_variant_images (image_url)
      )
    )
  `;
  static async getAllOrders(limit = 10, offset = 0, filters = {}) {
    try {
      const LIST_VIEW_FIELDS = `
        id,
        order_number,
        total,
        status,
        created_at,
        user_profiles ( full_name ),
        order_items (
          quantity,
          products ( name, sku, image_urls ),
          product_variants ( color, sku, product_variant_images (image_url) )
        )
      `;

      let query = supabase
        .from("orders")
        .select(LIST_VIEW_FIELDS, { count: "exact" });

      // Lọc theo trạng thái
      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      // Lọc theo mã đơn hàng
      if (filters.order_number) {
        const orderNumber = filters.order_number.replace("#", "");
        query = query.ilike("order_number", `%${orderNumber}%`);
      }
      // Lọc theo tên khách hàng (từ bảng quan hệ)
      if (filters.customer_name) {
        query = query.ilike(
          "user_profiles.full_name",
          `%${filters.customer_name}%`
        );
      }

      query = query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error("Không thể lấy danh sách đơn hàng");
      }
      return { data, count };
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy đơn hàng:", err.message);
      throw err;
    }
  }

  static async getOrderById(id) {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          user_profiles(*),
          user_addresses(addresses(*)),
          branch_orders(branch_id, branches(name)),
          order_items (
            *,
            products (name, image_urls),
            product_variants (
              *,
              product_variant_images (image_url)
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Không tìm thấy đơn hàng");
        }
        console.error("❌ Model - Lỗi Supabase:", error.message);
        throw new Error("Lỗi khi lấy đơn hàng");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi lấy đơn hàng:", error.message);
      throw error;
    }
  }

  static async updateOrderStatus(
    id,
    newStatus,
    comment = "",
    changedBy = null
  ) {
    const validStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipping",
      "delivered",
      "cancelled",
      "refunded",
    ];
    if (!validStatuses.includes(newStatus)) {
      throw new Error("Trạng thái đơn hàng không hợp lệ");
    }

    try {
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (fetchError || !order) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy đơn hàng");
        }
        throw new Error("Lỗi khi kiểm tra đơn hàng");
      }

      // THÊM MỚI: Logic xử lý kho khi xác nhận đơn hàng
      if (newStatus === "confirmed" && order.status !== "confirmed") {
        const assignedBranchId = await this.assignOrderToBranch(order);
        console.log(
          `✅ Đơn hàng #${order.order_number} đã được gán cho chi nhánh ID: ${assignedBranchId}`
        );
      }
      // KẾT THÚC THÊM MỚI

      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          delivered_at:
            newStatus === "delivered"
              ? new Date().toISOString()
              : order.delivered_at,
        })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (updateError) {
        throw new Error("Không thể cập nhật trạng thái đơn hàng");
      }

      const { error: statusError } = await supabase
        .from("order_status_history")
        .insert({
          order_id: id,
          old_status: order.status,
          new_status: newStatus,
          comment: comment || `Cập nhật trạng thái thành ${newStatus}`,
          changed_at: new Date().toISOString(),
          changed_by: changedBy || null,
        });

      if (statusError) {
        console.error(
          "❌ Model - Lỗi khi ghi lịch sử trạng thái:",
          statusError.message
        );
      }

      try {
        console.log(
          `🚀 Đang gửi thông báo cho đơn hàng #${order.order_number} với trạng thái mới: ${newStatus}`
        );
        await NotificationModel.createOrderUpdateNotification(
          order.id,
          order.user_id,
          newStatus
        );
      } catch (notificationError) {
        console.error(
          `❌ Lỗi khi gửi thông báo cho đơn hàng ${order.id}:`,
          notificationError.message
        );
      }

      return updatedOrder;
    } catch (error) {
      console.error(
        "❌ Model - Lỗi khi cập nhật trạng thái đơn hàng:",
        error.message
      );
      throw error;
    }
  }

  // THÊM MỚI: Logic tìm và gán đơn hàng cho chi nhánh phù hợp
  static async assignOrderToBranch(order) {
    // 1. Lấy tọa độ của khách hàng
    const customerAddress = order.user_addresses?.addresses;
    if (!customerAddress) {
      throw new Error("Đơn hàng thiếu địa chỉ khách hàng.");
    }
    const { data: customerLocation, error: locError } = await supabase
      .from("locations")
      .select("latitude, longitude")
      .eq("id", customerAddress.location_id)
      .single();

    if (locError || !customerLocation) {
      // Giả định: Nếu không có location, không thể tìm chi nhánh gần nhất
      throw new Error(
        "Không tìm thấy tọa độ cho địa chỉ khách hàng. Vui lòng cập nhật."
      );
    }

    // 2. [TỐI ƯU] Lấy danh sách chi nhánh đã sắp xếp theo khoảng cách qua RPC
    const { data: sortedBranches, error: rpcError } = await supabase.rpc(
      "get_sorted_branches_by_distance",
      {
        customer_lat: customerLocation.latitude,
        customer_lon: customerLocation.longitude,
      }
    );

    if (rpcError || !sortedBranches || sortedBranches.length === 0) {
      throw new Error(
        rpcError?.message ||
          "Không thể tìm thấy chi nhánh phù hợp hoặc có lỗi khi tính khoảng cách."
      );
    }

    console.log(
      `✅ Tìm thấy ${sortedBranches.length} chi nhánh qua RPC, đang kiểm tra kho...`
    );

    // 3. Duyệt qua các chi nhánh đã sắp xếp để tìm chi nhánh đủ hàng
    for (const { branch_id: branchId } of sortedBranches) {
      // Sửa đổi: Dùng branch_id từ kết quả RPC
      const hasStock = await InventoryModel.checkStockForOrder(
        branchId,
        order.order_items
      );
      if (hasStock) {
        // 5. Nếu chi nhánh này đủ hàng -> Trừ kho và gán đơn
        console.log(`✅ Chi nhánh ${branchId} có đủ hàng. Bắt đầu xử lý...`);

        // Trừ (giữ chỗ) tồn kho cho từng sản phẩm
        for (const item of order.order_items) {
          await InventoryModel.decreaseInventory(
            branchId,
            item.product_id, // SỬA LỖI: Dùng product_id từ order_items
            item.variant_id,
            item.quantity
          );
        }

        // Ghi vào bảng branch_orders
        const { error: insertError } = await supabase
          .from("branch_orders")
          .insert({ order_id: order.id, branch_id: branchId });

        if (insertError) {
          // Quan trọng: Nếu không ghi được, cần hoàn lại kho đã trừ
          console.error(
            `❌ Lỗi khi gán đơn hàng cho chi nhánh ${branchId}. Đang hoàn lại kho...`
          );
          for (const item of order.order_items) {
            await InventoryModel.cancelOrderInventory(
              branchId,
              item.product_id, // SỬA LỖI: Dùng product_id nhất quán
              item.variant_id,
              item.quantity
            );
          }
          throw new Error(
            `Không thể gán đơn hàng cho chi nhánh: ${insertError.message}`
          );
        }

        return branchId; // Gán thành công, trả về ID chi nhánh
      } else {
        console.log(
          `- Chi nhánh ${branchId} không đủ hàng. Tìm chi nhánh tiếp theo...`
        );
      }
    }

    // 6. Nếu không có chi nhánh nào đủ hàng
    throw new Error(
      "Tất cả các chi nhánh đã hết hàng cho một hoặc nhiều sản phẩm trong đơn hàng này."
    );
  }

  static async deleteOrder(id, comment = "", changedBy = null) {
    try {
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (fetchError || !order) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy đơn hàng");
        }
        throw new Error("Lỗi khi kiểm tra đơn hàng");
      }

      if (order.status === "cancelled") {
        throw new Error("Đơn hàng đã bị hủy trước đó");
      }

      const cancelledOrder = await this.updateOrderStatus(
        id,
        "cancelled",
        comment || "Đơn hàng đã bị hủy",
        changedBy
      );

      return cancelledOrder;
    } catch (error) {
      console.error("❌ Model - Lỗi khi hủy đơn hàng:", error.message);
      throw error;
    }
  }

  static async getOrderStats() {
    try {
      // 1. Lấy tổng số đơn hàng
      const { count: totalOrders, error: totalError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });

      if (totalError) {
        console.error(
          "❌ Model - Lỗi khi lấy tổng số đơn hàng:",
          totalError.message
        );
        throw new Error("Không thể lấy tổng số đơn hàng");
      }

      // 2. Lấy số lượng đơn hàng theo từng trạng thái
      // [SỬA LỖI] Chuyển sang sử dụng RPC để thống kê, ổn định hơn
      const { data: statusCounts, error: statusError } = await supabase.rpc(
        "get_order_stats"
      );

      if (statusError) {
        console.error(
          "❌ Model - Lỗi khi thống kê theo trạng thái:",
          statusError.message
        );
        throw new Error("Không thể thống kê đơn hàng theo trạng thái");
      }

      // Chuyển đổi mảng thành object để dễ sử dụng hơn ở frontend
      const formattedStatusCounts = statusCounts.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {});

      return { totalOrders, statusCounts: formattedStatusCounts };
    } catch (error) {
      console.error("❌ Model - Lỗi khi lấy thống kê đơn hàng:", error.message);
      throw error;
    }
  }
}

module.exports = OrderModel;
