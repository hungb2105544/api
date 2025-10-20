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
        const storeAddresses = await WebhookModel.getStoreAddress();
        if (storeAddresses && storeAddresses.length > 0) {
          const addressList = storeAddresses
            .map((branch) => {
              // Kiểm tra xem có thông tin địa chỉ không
              if (!branch.addresses)
                return `🏬 ${branch.name} - (Chưa có thông tin địa chỉ)`;

              const { street, ward, district, province } = branch.addresses;
              const fullAddress = [street, ward, district, province]
                .filter(Boolean)
                .join(", ");

              return `📍 *${branch.name}*\n   🏠 Địa chỉ: ${fullAddress}\n   📞 Điện thoại: ${branch.phone}`;
            })
            .join("\n\n"); // Sử dụng 2 lần xuống dòng để tách các chi nhánh
          responseText = `Dưới đây là địa chỉ các cửa hàng của chúng tôi:\n${addressList}`;
        } else {
          responseText = "Hiện tại chưa có địa chỉ cửa hàng nào.";
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
