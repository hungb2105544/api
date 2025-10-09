const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

const NotificationModel = require("./notification_model");

class OrderModel {
  static SELECT_FIELDS =
    "id, order_number, user_id, user_address_id, subtotal, discount_amount, shipping_fee, tax_amount, total, voucher_id, points_earned, points_used, status, payment_status, payment_method, payment_reference, notes, estimated_delivery_date, delivered_at, created_at, updated_at";
  static async getAllOrders(limit = 10, offset = 0, filters = {}) {
    try {
      let query = supabase
        .from("orders")
        .select(
          `
          *,
          user_profiles (*),
          user_addresses (
            addresses (*)
          ),
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
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      const { data, error } = await query;

      if (error) {
        throw new Error("Không thể lấy danh sách đơn hàng");
      }

      return data;
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
          user_profiles (*),
          user_addresses (
            addresses (*)
          ),
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
}

module.exports = OrderModel;
