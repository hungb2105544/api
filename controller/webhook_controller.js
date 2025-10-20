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
        if (productDiscount.length > 0) {
          const promoList = productDiscount
            .map(
              (p) =>
                `🎉 ${p.title} - Giảm ${p.discount_percent}% (${p.description})`
            )
            .join("\n");
          responseText = `Hiện tại bên mình đang có các chương trình khuyến mãi sau:\n${promoList}`;
        } else {
          responseText = "Hiện tại chưa có chương trình khuyến mãi nào.";
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
