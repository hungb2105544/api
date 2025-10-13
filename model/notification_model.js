const supabase = require("../supabaseClient");
const messaging = require("../firebaseConfig");

class NotificationModel {
  static async createOrderUpdateNotification(orderId, userId, status) {
    try {
      console.log(
        `📤 [START] Gửi notification - Order: ${orderId}, User: ${userId}, Status: ${status}`
      );

      if (!orderId || !userId || !status) {
        throw new Error("Order ID, User ID, và trạng thái là bắt buộc");
      }

      // 1. Lấy thông tin đơn hàng
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, order_number")
        .eq("id", orderId)
        .eq("user_id", userId)
        .single();

      if (orderError || !order) {
        console.error("❌ Không tìm thấy đơn hàng:", orderError);
        throw new Error(
          "Đơn hàng không tồn tại hoặc không thuộc về người dùng"
        );
      }

      console.log(`✅ Tìm thấy đơn hàng: #${order.order_number}`);

      // 2. Lấy notification type
      const { data: notificationType, error: typeError } = await supabase
        .from("notification_types")
        .select("id")
        .eq("type_name", "order")
        .single();

      if (typeError || !notificationType) {
        console.error(
          "❌ Không tìm thấy notification type 'order':",
          typeError
        );
        throw new Error('Loại thông báo "order" không tồn tại');
      }

      // 3. Tạo notification
      const notificationTitle = this.getNotificationTitle(
        status,
        order.order_number
      );
      const notificationContent = this.getNotificationContent(
        status,
        order.order_number
      );

      const { data: notification, error: notificationError } = await supabase
        .from("notifications")
        .insert({
          type_id: notificationType.id,
          title: notificationTitle,
          content: notificationContent,
          action_url: `/orders/${orderId}`,
          metadata: {
            notification_type: "order",
            order_id: orderId,
            order_number: order.order_number,
            status: status,
          },
          target_type: "user",
          target_value: userId,
          priority: 2,
          created_at: new Date().toISOString(),
          is_active: true,
        })
        .select("id")
        .single();

      if (notificationError) {
        console.error("❌ Lỗi tạo notification:", notificationError);
        throw new Error(`Lỗi khi tạo thông báo: ${notificationError.message}`);
      }

      console.log(`✅ Đã tạo notification ID: ${notification.id}`);

      // 4. Lưu vào user_notifications
      const { error: userNotificationError } = await supabase
        .from("user_notifications")
        .insert({
          notification_id: notification.id,
          user_id: userId,
          delivered_at: new Date().toISOString(),
        });

      if (userNotificationError) {
        console.error("❌ Lỗi lưu user_notification:", userNotificationError);
        throw new Error(
          `Lỗi khi lưu thông báo cho người dùng: ${userNotificationError.message}`
        );
      }

      // 5. Lấy FCM tokens
      const { data: devices, error: deviceError } = await supabase
        .from("user_devices")
        .select("fcm_token, device_name, platform")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (deviceError) {
        console.error("❌ Lỗi lấy devices:", deviceError);
        throw new Error(`Lỗi khi lấy FCM token: ${deviceError.message}`);
      }

      if (!devices || devices.length === 0) {
        console.log("⚠️ User không có device nào active");
        return {
          success: true,
          message: "Notification đã tạo nhưng không có device để gửi",
          notificationId: notification.id,
        };
      }

      console.log(`📱 Tìm thấy ${devices.length} device(s)`);

      // 6. Gửi FCM
      const tokens = devices.map((device) => device.fcm_token);
      const message = {
        notification: {
          title: notificationTitle,
          body: notificationContent,
        },
        data: {
          notification_type: "order",
          order_id: orderId.toString(),
          order_number: order.order_number,
          status: status,
        },
        tokens,
        android: {
          priority: "high",
          notification: {
            channelId: "default_channel",
            sound: "default",
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      console.log(`🚀 Đang gửi FCM tới ${tokens.length} device(s)...`);
      const response = await messaging.sendEachForMulticast(message);

      console.log(
        `✅ FCM Response - Success: ${response.successCount}, Failed: ${response.failureCount}`
      );

      // 7. Xử lý các token lỗi
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(
              `❌ Device ${devices[idx].device_name} failed:`,
              resp.error?.message
            );

            // Đánh dấu device là inactive nếu token không hợp lệ
            if (
              resp.error?.code === "messaging/invalid-registration-token" ||
              resp.error?.code === "messaging/registration-token-not-registered"
            ) {
              supabase
                .from("user_devices")
                .update({ is_active: false })
                .eq("fcm_token", tokens[idx])
                .then(() =>
                  console.log(
                    `🔄 Đã disable device: ${devices[idx].device_name}`
                  )
                );
            }
          }
        });
      }

      return {
        success: true,
        message: "Gửi thông báo cập nhật đơn hàng thành công",
        notificationId: notification.id,
        fcmResult: {
          successCount: response.successCount,
          failureCount: response.failureCount,
        },
      };
    } catch (error) {
      console.error("❌ [ERROR] createOrderUpdateNotification:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static getNotificationTitle(status, orderNumber) {
    const titles = {
      pending: "Đơn hàng đang chờ xử lý",
      confirmed: "✅ Đơn hàng đã xác nhận",
      processing: "📦 Đang chuẩn bị hàng",
      shipping: "🚚 Đang giao hàng",
      delivered: "✨ Đã giao hàng",
      cancelled: "❌ Đơn hàng đã hủy",
      refunded: "💰 Đã hoàn tiền",
    };
    return titles[status] || `Cập nhật đơn hàng #${orderNumber}`;
  }

  static getNotificationContent(status, orderNumber) {
    const contents = {
      pending: `Đơn hàng #${orderNumber} đang chờ xác nhận`,
      confirmed: `Đơn hàng #${orderNumber} đã được xác nhận và đang được chuẩn bị`,
      processing: `Đơn hàng #${orderNumber} đang được đóng gói`,
      shipping: `Đơn hàng #${orderNumber} đang trên đường giao đến bạn`,
      delivered: `Đơn hàng #${orderNumber} đã được giao thành công. Cảm ơn bạn!`,
      cancelled: `Đơn hàng #${orderNumber} đã bị hủy`,
      refunded: `Đơn hàng #${orderNumber} đã được hoàn tiền`,
    };
    return (
      contents[status] ||
      `Trạng thái đơn hàng #${orderNumber} đã thay đổi: ${status}`
    );
  }

  static async createVoucherNotification(voucherId) {
    try {
      console.log(`📤 [START] Gửi voucher notification - ID: ${voucherId}`);

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
          title: `🎁 Voucher mới: ${voucher.name}`,
          content: `Sử dụng mã ${voucher.code} để nhận ưu đãi ngay hôm nay!`,
          action_url: `/vouchers/${voucherId}`,
          metadata: { notification_type: "voucher", voucher_id: voucherId },
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
            title: `🎁 Voucher mới: ${voucher.name}`,
            body: `Sử dụng mã ${voucher.code} để nhận ưu đãi ngay hôm nay!`,
          },
          data: {
            notification_type: "promotion",
            voucher_id: voucherId.toString(),
          },
          tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(
          `✅ Voucher FCM sent - Success: ${response.successCount}/${tokens.length}`
        );
      }

      return {
        success: true,
        message: "Gửi thông báo voucher mới thành công",
      };
    } catch (error) {
      console.error("❌ [ERROR] createVoucherNotification:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async createSystemNotification(title, content) {
    try {
      console.log(`📤 [START] Gửi system notification`);

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
          data: {
            notification_type: "system",
          },
          tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(
          `✅ System FCM sent - Success: ${response.successCount}/${tokens.length}`
        );
      }

      return {
        success: true,
        message: "Gửi thông báo hệ thống thành công",
      };
    } catch (error) {
      console.error("❌ [ERROR] createSystemNotification:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Test notification cho debug
  static async sendTestNotification(userId) {
    try {
      console.log(`🧪 [TEST] Gửi test notification cho user: ${userId}`);

      const { data: devices, error } = await supabase
        .from("user_devices")
        .select("fcm_token, device_name, platform")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (error || !devices || devices.length === 0) {
        return {
          success: false,
          message: "Không tìm thấy device active cho user này",
        };
      }

      console.log(`📱 Tìm thấy ${devices.length} device(s)`);
      devices.forEach((d, i) => {
        console.log(
          `  ${i + 1}. ${d.platform || "unknown"} - ${
            d.device_name || "unnamed"
          }`
        );
        console.log(`     Token: ${d.fcm_token.substring(0, 20)}...`);
      });

      const tokens = devices.map((d) => d.fcm_token);
      const message = {
        notification: {
          title: "🧪 Test Notification",
          body: "Đây là thông báo test từ server. Nếu bạn nhận được tin nhắn này, FCM đang hoạt động tốt!",
        },
        data: {
          notification_type: "system",
          test: "true",
          timestamp: new Date().toISOString(),
        },
        tokens,
        android: {
          priority: "high",
          notification: {
            channelId: "default_channel",
            sound: "default",
          },
        },
      };

      const response = await messaging.sendEachForMulticast(message);

      console.log(`✅ Test FCM Response:`);
      console.log(`   Success: ${response.successCount}/${tokens.length}`);
      console.log(`   Failed: ${response.failureCount}/${tokens.length}`);

      return {
        success: true,
        message: "Test notification đã gửi",
        result: {
          totalDevices: devices.length,
          successCount: response.successCount,
          failureCount: response.failureCount,
          devices: devices.map((d) => ({
            name: d.device_name,
            platform: d.platform,
          })),
        },
      };
    } catch (error) {
      console.error("❌ [ERROR] sendTestNotification:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = NotificationModel;
