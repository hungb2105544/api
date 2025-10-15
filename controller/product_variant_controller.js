const ProductVariantModel = require("../model/product_variant_model");

class ProductVariantController {
  static async getAllVariants(req, res) {
    try {
      const { limit = 10, offset = 0, productId } = req.query;
      const variants = await ProductVariantModel.getAllVariants(
        parseInt(limit),
        parseInt(offset),
        productId ? parseInt(productId) : null
      );
      return res.status(200).json({
        success: true,
        message: "Lấy danh sách biến thể thành công",
        data: variants,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi lấy danh sách biến thể:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Lỗi khi lấy danh sách biến thể",
      });
    }
  }

  static async getVariantById(req, res) {
    try {
      const { id } = req.params;
      const variant = await ProductVariantModel.getVariantById(parseInt(id));
      return res.status(200).json({
        success: true,
        message: "Lấy biến thể thành công",
        data: variant,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi lấy biến thể:", error.message);
      return res
        .status(error.message === "Không tìm thấy biến thể" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi khi lấy biến thể",
        });
    }
  }

  static async createVariant(req, res) {
    try {
      const variantData = {
        product_id: parseInt(req.body.product_id),
        color: req.body.color,
        sku: req.body.sku,
        additional_price: req.body.additional_price
          ? parseFloat(req.body.additional_price)
          : undefined,
        size_id: parseInt(req.body.size_id),
      };
      const imageFiles = req.files || [];
      const userId = req.user?.id; // Giả sử middleware xác thực cung cấp userId
      const variant = await ProductVariantModel.createVariant(
        variantData,
        imageFiles,
        userId
      );
      return res.status(201).json({
        success: true,
        message: "Tạo biến thể thành công",
        data: variant,
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi tạo biến thể:", error.message);
      return res.status(400).json({
        success: false,
        message: error.message || "Lỗi khi tạo biến thể",
      });
    }
  }

  static async updateVariant(req, res) {
    try {
      const { id } = req.params;
      const variantData = {
        product_id: req.body.product_id
          ? parseInt(req.body.product_id)
          : undefined,
        color: req.body.color,
        sku: req.body.sku,
        additional_price: req.body.additional_price
          ? parseFloat(req.body.additional_price)
          : undefined,
        size_id: req.body.size_id ? parseInt(req.body.size_id) : undefined,
        removeImageIds: req.body.removeImageIds
          ? JSON.parse(req.body.removeImageIds)
          : undefined,
      };
      const imageFiles = req.files || [];
      const userId = req.user?.id; // Giả sử middleware xác thực cung cấp userId
      const updatedVariant = await ProductVariantModel.updateVariant(
        parseInt(id),
        variantData,
        imageFiles,
        userId
      );
      return res.status(200).json({
        success: true,
        message: "Cập nhật biến thể thành công",
        data: updatedVariant,
      });
    } catch (error) {
      console.error(
        "❌ Controller - Lỗi khi cập nhật biến thể:",
        error.message
      );
      return res
        .status(error.message === "Không tìm thấy biến thể" ? 404 : 400)
        .json({
          success: false,
          message: error.message || "Lỗi khi cập nhật biến thể",
        });
    }
  }

  static async deleteVariant(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id; // Giả sử middleware xác thực cung cấp userId
      const result = await ProductVariantModel.deleteVariant(
        parseInt(id),
        true,
        userId
      );
      return res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id },
      });
    } catch (error) {
      console.error("❌ Controller - Lỗi khi xóa biến thể:", error.message);
      return res
        .status(error.message === "Không tìm thấy biến thể" ? 404 : 500)
        .json({
          success: false,
          message: error.message || "Lỗi khi xóa biến thể",
        });
    }
  }

  static async createVariantsWithSharedImages(
    variantsData,
    imageFiles = [],
    userId = null
  ) {
    try {
      if (!variantsData.length) {
        throw new Error("Danh sách biến thể không được rỗng");
      }

      const { product_id, color } = variantsData[0];

      // Validate product exists
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", product_id)
        .eq("is_active", true)
        .single();

      if (productError || !product) {
        throw new Error("Sản phẩm không tồn tại");
      }

      const createdVariants = [];
      let uploadedImages = [];

      // Upload images once for the color group
      if (imageFiles && imageFiles.length > 0) {
        // Tạo tên folder an toàn (loại bỏ ký tự đặc biệt)
        const safeColorName = color.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const folderPath = `variant/color_${safeColorName}_${product_id}`;

        console.log(`📁 Uploading images to folder: ${folderPath}`);

        const uploadPromises = imageFiles.map(async (file, index) => {
          try {
            if (!file.buffer || !file.originalname || !file.mimetype) {
              console.warn("❌ Model - File không hợp lệ, bỏ qua:", file);
              return null;
            }

            // Tạo tên file an toàn
            const fileExtension = file.originalname.split(".").pop() || "png";
            const safeFileName = `image_${index + 1}.${fileExtension}`;
            const fileName = `${uuidv4()}-${safeFileName}`;
            const filePath = `${folderPath}/${fileName}`;

            console.log(`📤 Uploading file: ${filePath}`);

            const { error: uploadError } = await supabase.storage
              .from("products")
              .upload(filePath, file.buffer, {
                contentType: file.mimetype,
              });

            if (uploadError) {
              console.error(
                "❌ Model - Lỗi khi upload ảnh:",
                uploadError.message
              );
              return null;
            }

            const { data: urlData } = supabase.storage
              .from("products")
              .getPublicUrl(filePath);

            console.log(`✅ Upload thành công: ${urlData?.publicUrl}`);

            return {
              image_url: urlData?.publicUrl,
              sort_order: index,
            };
          } catch (uploadErr) {
            console.error("❌ Lỗi upload:", uploadErr);
            return null;
          }
        });

        uploadedImages = (await Promise.all(uploadPromises)).filter(
          (record) => record !== null
        );

        console.log(`✅ Đã upload ${uploadedImages.length} ảnh thành công`);
      }

      // Create each variant with the same images
      for (const variantData of variantsData) {
        // Check if size exists
        const { data: size, error: sizeError } = await supabase
          .from("sizes")
          .select("id")
          .eq("id", variantData.size_id)
          .single();

        if (sizeError || !size) {
          throw new Error(`Kích thước ${variantData.size_id} không tồn tại`);
        }

        // Generate SKU if not provided
        const sku = variantData.sku || `VAR-${uuidv4().slice(0, 8)}`;

        // Check SKU uniqueness
        if (variantData.sku) {
          const { data: existingSku, error: skuError } = await supabase
            .from("product_variants")
            .select("sku")
            .eq("sku", variantData.sku)
            .single();

          if (existingSku) {
            throw new Error("Mã SKU đã tồn tại");
          }
          if (skuError && skuError.code !== "PGRST116") {
            console.error("❌ Model - Lỗi khi kiểm tra SKU:", skuError.message);
            throw new Error("Lỗi khi kiểm tra mã SKU");
          }
        }

        // Create variant
        const { data: createdVariant, error: insertError } = await supabase
          .from("product_variants")
          .insert([
            {
              product_id: variantData.product_id,
              color: variantData.color,
              sku: sku,
              additional_price: variantData.additional_price || 0,
              size_id: variantData.size_id,
            },
          ])
          .select(this.SELECT_FIELDS)
          .single();

        if (insertError) {
          console.error(
            "❌ Model - Lỗi khi thêm biến thể:",
            insertError.message
          );
          throw new Error("Không thể thêm biến thể mới");
        }

        console.log(`✅ Đã tạo biến thể: ${createdVariant.id}`);

        // Add shared images to this variant
        if (uploadedImages.length > 0) {
          const variantImages = uploadedImages.map((img) => ({
            variant_id: createdVariant.id,
            image_url: img.image_url,
            sort_order: img.sort_order,
          }));

          console.log(
            `🖼️ Thêm ${variantImages.length} ảnh vào biến thể ${createdVariant.id}`
          );

          const { error: insertImageError } = await supabase
            .from("product_variant_images")
            .insert(variantImages);

          if (insertImageError) {
            console.error(
              "❌ Model - Lỗi khi lưu ảnh:",
              insertImageError.message
            );
            // Không throw error ở đây, vì biến thể đã được tạo thành công
            console.warn("⚠️ Không thể lưu ảnh, nhưng biến thể đã được tạo");
          } else {
            console.log(`✅ Đã thêm ảnh vào biến thể ${createdVariant.id}`);
          }
        }

        // Create inventory records
        const { data: branches, error: branchesError } = await supabase
          .from("branches")
          .select("id")
          .eq("is_active", true);

        if (branchesError) {
          console.error(
            "❌ Model - Lỗi khi lấy danh sách chi nhánh:",
            branchesError.message
          );
          // Không throw error, vì inventory có thể được tạo sau
          console.warn("⚠️ Không thể lấy danh sách chi nhánh");
        } else if (branches && branches.length > 0) {
          const inventoryRecords = branches.map((branch) => ({
            product_id: createdVariant.product_id,
            variant_id: createdVariant.id,
            branch_id: branch.id,
            quantity: 0,
            reserved_quantity: 0,
            updated_at: new Date().toISOString(),
          }));

          const { error: inventoryError } = await supabase
            .from("inventory")
            .insert(inventoryRecords);

          if (inventoryError) {
            console.error(
              "❌ Model - Lỗi khi tạo inventory:",
              inventoryError.message
            );
            console.warn("⚠️ Không thể tạo bản ghi inventory");
          } else {
            console.log(
              `📦 Đã tạo inventory cho ${inventoryRecords.length} chi nhánh`
            );
          }
        }

        await this.logAudit(
          "product_variants",
          createdVariant.id,
          "INSERT",
          null,
          createdVariant,
          userId
        );

        createdVariants.push(createdVariant);
      }

      return createdVariants;
    } catch (error) {
      console.error(
        "❌ Model - Lỗi khi tạo biến thể với ảnh chung:",
        error.message
      );
      throw error;
    }
  }
}

module.exports = ProductVariantController;
