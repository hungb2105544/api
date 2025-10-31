const WebhookModel = require("../model/webhook_model");
const ProductModel = require("../model/product_model");

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

      case "IHoiVeSanPhamTheoLoai": {
        const type = params["loai-san-pham"] || params["product_type"];
        console.log(`🔍 Nhận yêu cầu: type="${type}"`);
        const result = await ProductModel.getProductsWithTypes({
          type_name: type,
        });

        if (
          !result.success ||
          !result.products ||
          result.products.length === 0
        ) {
          return res.json({
            fulfillmentMessages: [
              {
                text: {
                  text: [
                    result.message ||
                      `Rất tiếc, mình không tìm thấy sản phẩm nào thuộc loại "${type}". 😢`,
                  ],
                },
              },
            ],
          });
        }

        return res.json({
          fulfillmentMessages: [
            {
              text: {
                text: [
                  `Tuyệt vời! Dưới đây là danh sách các sản phẩm ${type} mà mình tìm thấy:`,
                ],
              },
            },
            {
              payload: {
                object: result, // Trả về toàn bộ object result từ model
              },
            },
          ],
        });
      }

      case "IHoiVeSanPhamTheoThuongHieu": {
        const brand = params["thuong-hieu"] || params["brand"];
        console.log(`🔍 Nhận yêu cầu: brand="${brand}"`);
        const result = await ProductModel.getProductsWithBrands({
          brand_name: brand,
        });

        if (
          !result.success ||
          !result.products ||
          result.products.length === 0
        ) {
          return res.json({
            fulfillmentMessages: [
              {
                text: {
                  text: [
                    result.message ||
                      `Rất tiếc, mình không tìm thấy sản phẩm nào thuộc thương hiệu "${brand}". 😢`,
                  ],
                },
              },
            ],
          });
        }

        return res.json({
          fulfillmentMessages: [
            {
              text: {
                text: [
                  `Tuyệt vời! Dưới đây là danh sách các sản phẩm của thương hiệu ${brand} mà mình tìm thấy:`,
                ],
              },
            },
            {
              payload: {
                object: result,
              },
            },
          ],
        });
      }

      case "ITuVanSanPham - thuong hieu": {
        const brand = params["nhan-hieu1"] || params["brand"];
        const type = params["san-pham"] || params["product_type"];

        console.log(`🔍 Nhận yêu cầu: brand="${brand}", type="${type}"`);

        const products = await ProductModel.getProductsWithTypesAndBrands({
          brand_name: brand,
          type_name: type,
        });

        if (!products || products.length === 0) {
          return res.json({
            fulfillmentMessages: [
              {
                text: {
                  text: [
                    `Hiện tại mình không tìm thấy sản phẩm nào của thương hiệu "${brand}" thuộc loại "${type}". 😢`,
                  ],
                },
              },
            ],
          });
        }
        const brandName = Array.isArray(brand) ? brand[0] : brand;

        return res.json({
          fulfillmentMessages: [
            {
              text: {
                text: [
                  `Tuyệt vời! Dưới đây là danh sách sản phẩm ${type} của thương hiệu ${brandName}:`,
                ],
              },
            },
            {
              payload: {
                object: {
                  success: true,
                  brand: brandName || null,
                  type: type || null,
                  count: products.length,
                  products,
                },
              },
            },
          ],
        });
      }

      case "iDiaChi": {
        const vouchers = await WebhookModel.getStoreAddress();
        if (vouchers && vouchers.length > 0) {
          const voucherList = vouchers
            .map((branch) => {
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
