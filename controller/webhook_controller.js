const WebhookModel = require("../model/webhook_model");

class WebhookController {
  static async handleWebhook(req, res) {
    const intent = req.body.queryResult.intent.displayName;
    const params = req.body.queryResult.parameters || {};

    console.log(`➡️ Intent nhận được: ${intent}`);
    console.log("📦 Parameters:", params);
    let responseText = "Xin lỗi, mình chưa hiểu câu hỏi này.";

    switch (intent) {
      case "iKhuyenMai": {
        const productDiscount = await WebhookModel.getPromotion();
        if (productDiscount && productDiscount.length > 0) {
          const promoList = productDiscount
            .map((p) => `🎉 ${p.name} - Giảm ${p.discount_percentage}%`)
            .join("\n");
          responseText = `Hiện tại bên mình đang có các chương trình khuyến mãi sau:\n${promoList}`;
        } else {
          responseText = "Hiện tại chưa có chương trình khuyến mãi nào.";
        }
        break;
      }

      case "iDiaChi": {
        const vouchers = await WebhookModel.getStoreAddress();
        if (vouchers && vouchers.length > 0) {
          const voucherList = vouchers
            .map((branch) => {
              // Kiểm tra xem có thông tin địa chỉ không
              if (!branch.addresses)
                return `🏬 ${branch.name} - (Chưa có thông tin địa chỉ)`;

              const { street, ward, district, province } = branch.addresses;
              const fullAddress = [street, ward, district, province]
                .filter(Boolean)
                .join(", ");

              return `\n📍 *${branch.name}*\n   🏠 Địa chỉ: ${fullAddress}\n   📞 Điện thoại: ${branch.phone}`;
            })
            .join("\n\n");
          console.log(voucherList);
          responseText = `Dưới đây là địa chỉ các cửa hàng của chúng tôi:\n${voucherList}`;
        } else {
          responseText = "Hiện tại chưa có địa chỉ cửa hàng nào.";
        }
        break;
      }

      case "iVoucher": {
        const vouchers = await WebhookModel.getAllVoucher();
        if (vouchers && vouchers.length > 0) {
          const voucherList = vouchers
            .map((voucher) => {
              const expiryDate = new Date(voucher.valid_to).toLocaleDateString(
                "vi-VN"
              );
              let discountInfo = "";
              if (voucher.type === "percentage") {
                discountInfo = `giảm ${voucher.value}%`;
              } else if (voucher.type === "fixed_amount") {
                discountInfo = `giảm ${new Intl.NumberFormat("vi-VN").format(
                  voucher.value
                )}đ`;
              } else {
                discountInfo = "miễn phí vận chuyển";
              }

              const description = voucher.description
                ? ` (${voucher.description})`
                : "";
              return `🎁 *${voucher.name}*${description}:\n   🏷️ Mã: *${voucher.code}* - ${discountInfo}\n   ⏳ Hạn sử dụng: ${expiryDate}`;
            })
            .join("\n\n");
          responseText = `Tuyệt vời! Hiện tại shop đang có các voucher sau, bạn có thể dùng ngay nhé:\n\n${voucherList}`;
        } else {
          responseText =
            "Tiếc quá, hiện tại shop chưa có voucher nào, bạn quay lại sau nhé.";
        }
        break;
      }
      default:
        responseText = "Xin lỗi, mình chưa được huấn luyện cho yêu cầu này.";
    }

    return res.json({
      fulfillmentText: responseText,
    });
  }
}

module.exports = WebhookController;
