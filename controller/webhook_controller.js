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

      // case "ITuVanSanPham - thuong hieu": {
      //   // 'nhan-hieu1' là thương hiệu, 'san-pham' là loại sản phẩm
      //   const brand = params["nhan-hieu1"];
      //   const type = params["san-pham"];

      //   const products = await WebhookModel.getProductsByBrandAndType(
      //     brand,
      //     type
      //   );
      //   console.log("🔍 Sản phẩm tìm được:", products);

      //   if (products && products.length > 0) {
      //     // 👉 Chuẩn hoá dữ liệu sản phẩm để trả về Flutter
      //     const formattedProducts = products.map((p) => ({
      //       id: p.id, // 👈 thêm id
      //       name: p.name,
      //       image:
      //         Array.isArray(p.image_urls) && p.image_urls.length > 0
      //           ? p.image_urls[0]
      //           : p.image_urls || null,
      //       price: p.price || 0,
      //       final_price: p.final_price || 0,
      //       discount: p.discount
      //         ? {
      //             name: p.discount.name,
      //             percentage: p.discount.discount_percentage || null,
      //             amount: p.discount.discount_amount || null,
      //           }
      //         : null,
      //       total_stock: p.total_stock || 0,
      //       brand: p.brands?.brand_name || null,
      //       type: p.product_types?.type_name || null,
      //     }));

      //     const brandName = Array.isArray(brand) ? brand[0] : brand;

      //     return res.json({
      //       fulfillmentMessages: [
      //         {
      //           text: {
      //             text: [
      //               `Tuyệt vời! Dưới đây là danh sách sản phẩm ${type} của thương hiệu ${brandName}:`,
      //             ],
      //           },
      //         },
      //         {
      //           payload: {
      //             object: {
      //               success: true,
      //               brand: brandName || null,
      //               type: type || null,
      //               count: formattedProducts.length,
      //               products: formattedProducts, // 👈 gửi danh sách sản phẩm có id
      //             },
      //           },
      //         },
      //       ],
      //     });
      //   } else {
      //     // Không có sản phẩm
      //     const brandName = Array.isArray(brand) ? brand[0] : brand;
      //     return res.json({
      //       fulfillmentMessages: [
      //         {
      //           text: {
      //             text: [
      //               `Rất tiếc, mình không tìm thấy sản phẩm ${
      //                 type || ""
      //               } nào của ${brandName || ""}.`,
      //             ],
      //           },
      //         },
      //         {
      //           payload: {
      //             object: {
      //               success: false,
      //               brand: brandName || null,
      //               type: type || null,
      //               products: [],
      //             },
      //           },
      //         },
      //       ],
      //     });
      //   }
      // }
      case "ITuVanSanPham - thuong hieu": {
        const brand = params["nhan-hieu1"];
        const type = params["san-pham"];
        const products = await WebhookModel.getProductsByBrandAndType(
          brand,
          type
        );
        console.log("🔍 Sản phẩm tìm được:", products.length);

        const brandName = Array.isArray(brand) ? brand[0] : brand;

        if (products && products.length > 0) {
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
                    products: products,
                  },
                },
              },
            ],
          });
        } else {
          // Không có sản phẩm
          return res.json({
            fulfillmentMessages: [
              {
                text: {
                  text: [
                    `Rất tiếc, mình không tìm thấy sản phẩm ${
                      type || ""
                    } nào của ${brandName || ""}.`,
                  ],
                },
              },
              {
                payload: {
                  object: {
                    success: false,
                    brand: brandName || null,
                    type: type || null,
                    products: [],
                  },
                },
              },
            ],
          });
        }
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
