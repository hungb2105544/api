const supabase = require("../supabaseClient");
const messaging = require("../firebaseConfig");

class NotificationModel {
  static async createOrderUpdateNotification(orderId, userId, status) {
    try {
      if (!orderId || !userId || !status) {
        throw new Error("Order ID, User ID, và trạng thái là bắt buộc");
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, order_number")
        .eq("id", orderId)
        .eq("user_id", userId)
        .single();

      if (orderError || !order) {
        throw new Error(
          "Đơn hàng không tồn tại hoặc không thuộc về người dùng"
        );
      }

      const { data: notificationType, error: typeError } = await supabase
        .from("notification_types")
        .select("id")
        .eq("type_name", "order")
        .single();

      if (typeError || !notificationType) {
        throw new Error('Loại thông báo "order" không tồn tại');
      }

      const { data: notification, error: notificationError } = await supabase
        .from("notifications")
        .insert({
          type_id: notificationType.id,
          title: `Cập nhật đơn hàng #${order.order_number}`,
          content: `Đơn hàng của bạn đã được cập nhật sang trạng thái: ${status}`,
          action_url: `/orders/${orderId}`,
          metadata: { notification_type: "order", order_id: orderId },
          target_type: "user",
          target_value: userId,
          priority: 2,
          created_at: new Date().toISOString(),
          created_by: userId,
          is_active: true,
        })
        .select("id")
        .single();

      if (notificationError) {
        throw new Error(`Lỗi khi tạo thông báo: ${notificationError.message}`);
      }

      const { error: userNotificationError } = await supabase
        .from("user_notifications")
        .insert({
          notification_id: notification.id,
          user_id: userId,
          delivered_at: new Date().toISOString(),
        });

      if (userNotificationError) {
        throw new Error(
          `Lỗi khi lưu thông báo cho người dùng: ${userNotificationError.message}`
        );
      }

      const { data: devices, error: deviceError } = await supabase
        .from("user_devices")
        .select("fcm_token")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (deviceError) {
        throw new Error(`Lỗi khi lấy FCM token: ${deviceError.message}`);
      }

      if (devices && devices.length > 0) {
        const tokens = devices.map((device) => device.fcm_token);
        const message = {
          notification: {
            title: `Cập nhật đơn hàng #${order.order_number}`,
            body: `Đơn hàng của bạn đã được cập nhật sang trạng thái: ${status}`,
          },
          data: {
            notification_type: "order",
            order_id: orderId.toString(),
          },
          tokens,
        };

        await messaging.sendMulticast(message);
      }

      return {
        success: true,
        message: "Gửi thông báo cập nhật đơn hàng thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async createVoucherNotification(voucherId) {
    try {
      const { data: voucher, error: voucherError } = await supabase
        .from("vouchers")
        .select("id, name, code")
        .eq("id", voucherId)
        .single();

      if (voucherError || !voucher) {
        throw new Error("Voucher không tồn tại");
      }

      const { data: notificationType, error: typeError } = await supabase
        .from("notification_types")
        .select("id")
        .eq("type_name", "voucher")
        .single();

      if (typeError || !notificationType) {
        throw new Error('Loại thông báo "voucher" không tồn tại');
      }

      const { data: notification, error: notificationError } = await supabase
        .from("notifications")
        .insert({
          type_id: notificationType.id,
          title: `Voucher mới: ${voucher.name}`,
          content: `Sử dụng mã ${voucher.code} để nhận ưu đãi ngay hôm nay!`,
          action_url: `/vouchers/${voucherId}`,
          metadata: { notification_type: "voucher" },
          target_type: "all",
          priority: 1,
          created_at: new Date().toISOString(),
          is_active: true,
        })
        .select("id")
        .single();

      if (notificationError) {
        throw new Error(`Lỗi khi tạo thông báo: ${notificationError.message}`);
      }

      const { data: devices, error: deviceError } = await supabase
        .from("user_devices")
        .select("fcm_token, user_id")
        .eq("is_active", true);

      if (deviceError) {
        throw new Error(`Lỗi khi lấy FCM token: ${deviceError.message}`);
      }

      if (devices && devices.length > 0) {
        const userNotifications = devices.map((device) => ({
          notification_id: notification.id,
          user_id: device.user_id,
          delivered_at: new Date().toISOString(),
        }));

        const { error: userNotificationError } = await supabase
          .from("user_notifications")
          .insert(userNotifications);

        if (userNotificationError) {
          throw new Error(
            `Lỗi khi lưu thông báo cho người dùng: ${userNotificationError.message}`
          );
        }

        const tokens = devices.map((device) => device.fcm_token);
        const message = {
          notification: {
            title: `Voucher mới: ${voucher.name}`,
            body: `Sử dụng mã ${voucher.code} để nhận ưu đãi ngay hôm nay!`,
          },
          data: {
            notification_type: "voucher",
          },
          tokens,
        };

        await messaging.sendMulticast(message);
      }

      return {
        success: true,
        message: "Gửi thông báo voucher mới thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async createSystemNotification(title, content) {
    try {
      if (!title || !content) {
        throw new Error("Tiêu đề và nội dung thông báo là bắt buộc");
      }

      const { data: notificationType, error: typeError } = await supabase
        .from("notification_types")
        .select("id")
        .eq("type_name", "system")
        .single();

      if (typeError || !notificationType) {
        throw new Error('Loại thông báo "system" không tồn tại');
      }

      const { data: notification, error: notificationError } = await supabase
        .from("notifications")
        .insert({
          type_id: notificationType.id,
          title,
          content,
          target_type: "all",
          priority: 1,
          created_at: new Date().toISOString(),
          is_active: true,
        })
        .select("id")
        .single();

      if (notificationError) {
        throw new Error(`Lỗi khi tạo thông báo: ${notificationError.message}`);
      }

      const { data: devices, error: deviceError } = await supabase
        .from("user_devices")
        .select("fcm_token, user_id")
        .eq("is_active", true);

      if (deviceError) {
        throw new Error(`Lỗi khi lấy FCM token: ${deviceError.message}`);
      }

      if (devices && devices.length > 0) {
        const userNotifications = devices.map((device) => ({
          notification_id: notification.id,
          user_id: device.user_id,
          delivered_at: new Date().toISOString(),
        }));

        const { error: userNotificationError } = await supabase
          .from("user_notifications")
          .insert(userNotifications);

        if (userNotificationError) {
          throw new Error(
            `Lỗi khi lưu thông báo cho người dùng: ${userNotificationError.message}`
          );
        }

        const tokens = devices.map((device) => device.fcm_token);
        const message = {
          notification: {
            title,
            body: content,
          },
          tokens,
        };

        await messaging.sendMulticast(message);
      }

      return {
        success: true,
        message: "Gửi thông báo hệ thống thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = NotificationModel;
