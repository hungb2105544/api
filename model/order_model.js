const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

class OrderModel {
  static SELECT_FIELDS =
    "id, order_number, user_id, user_address_id, subtotal, discount_amount, shipping_fee, tax_amount, total, voucher_id, points_earned, points_used, status, payment_status, payment_method, payment_reference, notes, estimated_delivery_date, delivered_at, created_at, updated_at";

  // Lấy danh sách đơn hàng với phân trang và bộ lọc trạng thái
  static async getAllOrders(limit = 10, offset = 0, filters = {}) {
    try {
      let query = supabase
        .from("orders")
        .select(this.SELECT_FIELDS)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Áp dụng bộ lọc
      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.user_id) {
        query = query.eq("user_id", filters.user_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          "❌ Model - Lỗi Supabase khi lấy danh sách đơn hàng:",
          error.message
        );
        throw new Error("Không thể lấy danh sách đơn hàng");
      }

      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy đơn hàng:", err.message);
      throw err;
    }
  }

  // Lấy chi tiết đơn hàng theo ID
  static async getOrderById(id) {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `${this.SELECT_FIELDS}, order_items(id, product_id, variant_id, quantity, unit_price, discount_amount, line_total)`
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

  // Cập nhật trạng thái đơn hàng
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
      // Kiểm tra đơn hàng tồn tại
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (fetchError || !order) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy đơn hàng");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra đơn hàng:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra đơn hàng");
      }

      // Cập nhật trạng thái
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
        console.error(
          "❌ Model - Lỗi khi cập nhật trạng thái:",
          updateError.message
        );
        throw new Error("Không thể cập nhật trạng thái đơn hàng");
      }

      // Ghi lịch sử trạng thái
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
        throw new Error("Không thể ghi lịch sử trạng thái");
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

  // Xóa đơn hàng (soft delete)
  static async deleteOrder(id, comment = "", changedBy = null) {
    try {
      // Kiểm tra đơn hàng tồn tại
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (fetchError || !order) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy đơn hàng");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra đơn hàng:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra đơn hàng");
      }

      // Kiểm tra trạng thái hiện tại
      if (order.status === "cancelled") {
        throw new Error("Đơn hàng đã bị hủy trước đó");
      }

      // Cập nhật trạng thái thành cancelled
      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (updateError) {
        console.error("❌ Model - Lỗi khi hủy đơn hàng:", updateError.message);
        throw new Error("Không thể hủy đơn hàng");
      }

      // Ghi lịch sử trạng thái
      const { error: statusError } = await supabase
        .from("order_status_history")
        .insert({
          order_id: id,
          old_status: order.status,
          new_status: "cancelled",
          comment: comment || "Đơn hàng đã bị hủy",
          changed_at: new Date().toISOString(),
          changed_by: changedBy || null,
        });

      if (statusError) {
        console.error(
          "❌ Model - Lỗi khi ghi lịch sử trạng thái:",
          statusError.message
        );
        throw new Error("Không thể ghi lịch sử trạng thái");
      }

      return updatedOrder;
    } catch (error) {
      console.error("❌ Model - Lỗi khi hủy đơn hàng:", error.message);
      throw error;
    }
  }
}

module.exports = OrderModel;
