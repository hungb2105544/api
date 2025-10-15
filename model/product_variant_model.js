// product_variant_model.js
// product_variant_model.js
const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

class ProductVariantModel {
  static SELECT_FIELDS =
    "id, product_id, color, sku, additional_price, is_active, created_at, size_id, product_variant_images(id, image_url, sort_order)";
  /**
   * @description Chuẩn hóa tên file để an toàn cho URL và hệ thống file.
   * @param {string} filename - Tên file gốc.
   * @returns {string} - Tên file đã được chuẩn hóa.
   */
  static _sanitizeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  }
  // Thêm method này vào ProductVariantModel
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
        const uploadPromises = imageFiles.map(async (file, index) => {
          if (!file.buffer || !file.originalname || !file.mimetype) {
            console.warn("❌ Model - File không hợp lệ, bỏ qua:", file);
            return null;
          }

          const safeOriginalName = this._sanitizeFileName(file.originalname);
          const fileName = `${uuidv4()}-${safeOriginalName}`;
          // Tạo tên folder an toàn
          const safeColorName = color
            .replace(/[^a-zA-Z0-9]/g, "_")
            .toLowerCase();
          const filePath = `variant/color_${safeColorName}_${product_id}/${fileName}`;

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

          return {
            image_url: urlData?.publicUrl,
            sort_order: index,
          };
        });

        uploadedImages = (await Promise.all(uploadPromises)).filter(
          (record) => record !== null
        );
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

        if (variantData.sku) {
          const { data: existingSku } = await supabase
            .from("product_variants")
            .select("sku")
            .eq("sku", variantData.sku)
            .single();

          if (existingSku) {
            throw new Error("Mã SKU đã tồn tại");
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

        // Add shared images to this variant
        if (uploadedImages.length > 0) {
          const variantImages = uploadedImages.map((img) => ({
            variant_id: createdVariant.id,
            image_url: img.image_url,
            sort_order: img.sort_order,
          }));

          const { error: insertImageError } = await supabase
            .from("product_variant_images")
            .insert(variantImages);

          if (insertImageError) {
            console.error(
              "❌ Model - Lỗi khi lưu ảnh:",
              insertImageError.message
            );
            throw new Error("Không thể lưu ảnh biến thể");
          }
        }

        // Create inventory records
        const { data: branches } = await supabase
          .from("branches")
          .select("id")
          .eq("is_active", true);

        if (branches && branches.length > 0) {
          const inventoryRecords = branches.map((branch) => ({
            product_id: createdVariant.product_id,
            variant_id: createdVariant.id,
            branch_id: branch.id,
            quantity: 0,
            reserved_quantity: 0,
            updated_at: new Date().toISOString(),
          }));

          await supabase.from("inventory").insert(inventoryRecords);
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
  static async logAudit(
    tableName,
    recordId,
    action,
    oldValues,
    newValues,
    userId
  ) {
    try {
      const { error } = await supabase.from("audit_logs").insert({
        table_name: tableName,
        record_id: recordId,
        action,
        old_values: oldValues ? JSON.stringify(oldValues) : null,
        new_values: newValues ? JSON.stringify(newValues) : null,
        user_id: userId || null,
        created_at: new Date().toISOString(),
      });
      if (error) {
        console.error("❌ Model - Lỗi khi ghi audit log:", error.message);
      }
    } catch (err) {
      console.error("❌ Model - Lỗi khi ghi audit log:", err.message);
    }
  }

  // Lấy danh sách biến thể
  static async getAllVariants(limit = 10, offset = 0, productId = null) {
    try {
      let query = supabase
        .from("product_variants")
        .select(this.SELECT_FIELDS)
        .eq("is_active", true)
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          "❌ Model - Lỗi Supabase khi lấy danh sách biến thể:",
          error.message
        );
        throw new Error("Không thể lấy danh sách biến thể");
      }

      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy biến thể:", err.message);
      throw err;
    }
  }

  // Lấy biến thể theo ID
  static async getVariantById(id) {
    try {
      const { data, error } = await supabase
        .from("product_variants")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Không tìm thấy biến thể");
        }
        console.error("❌ Model - Lỗi Supabase:", error.message);
        throw new Error("Lỗi khi lấy biến thể");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi lấy biến thể:", error.message);
      throw error;
    }
  }

  // Tạo biến thể mới
  static async createVariant(variantData, imageFiles = [], userId = null) {
    if (!variantData.product_id || !variantData.color || !variantData.size_id) {
      throw new Error("Product ID, màu sắc và kích thước là bắt buộc");
    }

    try {
      // Xác thực khóa ngoại product_id
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", variantData.product_id)
        .eq("is_active", true)
        .single();
      if (productError || !product) {
        console.error("❌ Model - Chi tiết lỗi kiểm tra product:", {
          product_id: variantData.product_id,
          error: productError?.message,
        });
        throw new Error("Sản phẩm không tồn tại");
      }

      // Xác thực khóa ngoại size_id
      const { data: size, error: sizeError } = await supabase
        .from("sizes")
        .select("id")
        .eq("id", variantData.size_id)
        .single();
      if (sizeError || !size) {
        console.error("❌ Model - Chi tiết lỗi kiểm tra size:", {
          size_id: variantData.size_id,
          error: sizeError?.message,
        });
        throw new Error("Kích thước không tồn tại");
      }

      // Kiểm tra tính duy nhất của SKU
      const sku = variantData.sku || `VAR-${uuidv4().slice(0, 8)}`;
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

      // Thêm biến thể mới
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
        console.error("❌ Model - Lỗi khi thêm biến thể:", insertError.message);
        throw new Error("Không thể thêm biến thể mới");
      }

      console.log(`✅ Đã tạo biến thể: ${createdVariant.id}`);

      await this.logAudit(
        "product_variants",
        createdVariant.id,
        "INSERT",
        null,
        createdVariant,
        userId
      );

      // Tạo bản ghi inventory cho tất cả chi nhánh
      const { data: branches, error: branchesError } = await supabase
        .from("branches")
        .select("id")
        .eq("is_active", true);
      if (branchesError) {
        console.error(
          "❌ Model - Lỗi khi lấy danh sách chi nhánh:",
          branchesError.message
        );
        console.warn("⚠️ Không thể lấy danh sách chi nhánh");
      } else {
        const inventoryRecords = branches.map((branch) => ({
          product_id: createdVariant.product_id,
          variant_id: createdVariant.id,
          branch_id: branch.id,
          quantity: 0,
          reserved_quantity: 0,
          updated_at: new Date().toISOString(),
        }));

        if (inventoryRecords.length > 0) {
          const { error: inventoryError } = await supabase
            .from("inventory")
            .insert(inventoryRecords);
          if (inventoryError) {
            console.error(
              "❌ Model - Lỗi khi thêm vào inventory:",
              inventoryError.message
            );
            console.warn("⚠️ Không thể thêm bản ghi inventory");
          } else {
            console.log(
              `📦 Đã tạo inventory cho ${inventoryRecords.length} chi nhánh`
            );
          }
        }
      }

      // Xử lý upload ảnh
      let imageRecords = [];
      if (imageFiles && imageFiles.length > 0) {
        // Tạo folder path an toàn
        const safeColorName = variantData.color
          .replace(/[^a-zA-Z0-9]/g, "_")
          .toLowerCase();
        const folderPath = `variant/variant_${createdVariant.id}`;

        console.log(`📁 Uploading images to folder: ${folderPath}`);

        const uploadPromises = imageFiles.map(async (file, index) => {
          try {
            if (!file.buffer || !file.originalname || !file.mimetype) {
              console.warn("❌ Model - File không hợp lệ, bỏ qua:", file);
              return null;
            }

            // Tạo tên file an toàn
            const fileExtension = file.originalname.split(".").pop() || "png";
            const safeOriginalName = this._sanitizeFileName(file.originalname);
            const fileName = `${uuidv4()}-${safeOriginalName}`;
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
              variant_id: createdVariant.id,
              image_url: urlData?.publicUrl,
              sort_order: index,
            };
          } catch (uploadErr) {
            console.error("❌ Lỗi upload:", uploadErr);
            return null;
          }
        });

        imageRecords = (await Promise.all(uploadPromises)).filter(
          (record) => record !== null
        );

        if (imageRecords.length > 0) {
          const { error: insertImageError } = await supabase
            .from("product_variant_images")
            .insert(imageRecords);

          if (insertImageError) {
            console.error(
              "❌ Model - Lỗi khi lưu ảnh vào product_variant_images:",
              insertImageError.message
            );
            console.warn("⚠️ Không thể lưu ảnh biến thể");
          } else {
            console.log(`✅ Đã lưu ${imageRecords.length} ảnh vào database`);
          }
        }
      }

      // Lấy lại biến thể với ảnh đã upload
      const { data: updatedVariant, error: fetchUpdatedError } = await supabase
        .from("product_variants")
        .select(this.SELECT_FIELDS)
        .eq("id", createdVariant.id)
        .single();

      if (fetchUpdatedError) {
        console.error(
          "❌ Model - Lỗi khi lấy biến thể sau khi thêm ảnh:",
          fetchUpdatedError.message
        );
        // Vẫn trả về createdVariant nếu không lấy được updated
        return createdVariant;
      }

      return updatedVariant;
    } catch (error) {
      console.error("❌ Model - Lỗi khi thêm biến thể:", error.message);
      throw error;
    }
  } // Cập nhật biến thể
  static async updateVariant(id, variantData, imageFiles = [], userId = null) {
    try {
      const { data: oldVariant, error: fetchError } = await supabase
        .from("product_variants")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (fetchError || !oldVariant) {
        throw new Error("Không tìm thấy biến thể");
      }

      // Kiểm tra SKU không trùng
      if (variantData.sku && variantData.sku !== oldVariant.sku) {
        const { data: existingSku } = await supabase
          .from("product_variants")
          .select("id")
          .eq("sku", variantData.sku)
          .single();
        if (existingSku) {
          throw new Error("Mã SKU đã tồn tại");
        }
      }

      // Chuẩn bị dữ liệu cập nhật
      const updateData = {
        color: variantData.color ?? oldVariant.color,
        additional_price:
          variantData.additional_price ?? oldVariant.additional_price,
        sku: variantData.sku ?? oldVariant.sku,
        size_id: variantData.size_id ?? oldVariant.size_id,
      };

      // Xử lý xóa ảnh cũ
      if (variantData.removeImageIds?.length > 0) {
        const { data: images } = await supabase
          .from("product_variant_images")
          .select("id, image_url")
          .in("id", variantData.removeImageIds);

        const filePaths = images
          ?.map((img) => {
            const match = img.image_url.match(
              /\/storage\/v1\/object\/public\/products\/(.+)$/
            );
            return match ? match[1] : null;
          })
          .filter(Boolean);

        if (filePaths.length > 0) {
          await supabase.storage.from("products").remove(filePaths);
          console.log(`🗑️ Đã xóa ${filePaths.length} ảnh từ storage`);
        }

        await supabase
          .from("product_variant_images")
          .delete()
          .in("id", variantData.removeImageIds);

        console.log(
          `🗑️ Đã xóa ${variantData.removeImageIds.length} bản ghi ảnh`
        );
      }

      // Upload ảnh mới
      if (imageFiles?.length > 0) {
        // Tạo folder path an toàn
        const safeColorName = (variantData.color || oldVariant.color)
          .replace(/[^a-zA-Z0-9]/g, "_")
          .toLowerCase();
        const folderPath = `variant/variant_${id}`;

        console.log(`📁 Uploading new images to folder: ${folderPath}`);

        const uploadPromises = imageFiles.map(async (file, idx) => {
          try {
            // Tạo tên file an toàn
            const safeOriginalName = this._sanitizeFileName(file.originalname);
            const fileName = `${uuidv4()}-${safeOriginalName}`;
            const filePath = `${folderPath}/${fileName}`;

            console.log(`📤 Uploading new file: ${filePath}`);

            await supabase.storage
              .from("products")
              .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
              });

            const { data: urlData } = supabase.storage
              .from("products")
              .getPublicUrl(filePath);

            console.log(`✅ Upload thành công: ${urlData.publicUrl}`);

            return {
              variant_id: id,
              image_url: urlData.publicUrl,
              sort_order: idx,
            };
          } catch (uploadErr) {
            console.error("❌ Lỗi upload ảnh mới:", uploadErr);
            return null;
          }
        });

        const newImages = (await Promise.all(uploadPromises)).filter(Boolean);
        if (newImages.length > 0) {
          await supabase.from("product_variant_images").insert(newImages);
          console.log(`✅ Đã thêm ${newImages.length} ảnh mới`);
        }
      }

      // Cập nhật biến thể
      const { data: updatedVariant, error: updateError } = await supabase
        .from("product_variants")
        .update(updateData)
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (updateError) throw new Error(updateError.message);

      // Ghi log
      await this.logAudit(
        "product_variants",
        id,
        "UPDATE",
        oldVariant,
        updatedVariant,
        userId
      );

      console.log(`✅ Đã cập nhật biến thể: ${id}`);
      return updatedVariant;
    } catch (error) {
      console.error("❌ updateVariant error:", error.message);
      throw error;
    }
  }

  // Xóa biến thể
  static async deleteVariant(id, deleteImages = true, userId = null) {
    try {
      const { data: existingVariant, error: fetchError } = await supabase
        .from("product_variants")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (fetchError || !existingVariant) {
        throw new Error("Không tìm thấy biến thể");
      }

      // Xóa các bản ghi liên quan
      const tablesToDelete = ["order_items", "cart_items", "inventory"];
      for (const table of tablesToDelete) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("variant_id", id);
        if (error) {
          console.error(`❌ Model - Lỗi khi xóa ${table}:`, error.message);
          throw new Error(`Không thể xóa bản ghi ${table} liên quan`);
        }
      }

      // Xóa ảnh nếu cần
      if (deleteImages && existingVariant.product_variant_images?.length > 0) {
        const filePaths = existingVariant.product_variant_images.map(
          (image) => image.image_url.split("/products/")[1]
        );

        const { error: removeError } = await supabase.storage
          .from("products")
          .remove(filePaths);

        if (removeError) {
          console.error("❌ Model - Lỗi khi xóa ảnh:", removeError.message);
        }

        await supabase
          .from("product_variant_images")
          .delete()
          .eq("variant_id", id);
      }

      // Xóa biến thể
      const { error: deleteError } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("❌ Model - Lỗi khi xóa biến thể:", deleteError.message);
        throw new Error("Không thể xóa biến thể");
      }

      await this.logAudit(
        "product_variants",
        id,
        "DELETE",
        existingVariant,
        null,
        userId
      );

      return { id, message: "Biến thể đã được xóa vĩnh viễn" };
    } catch (error) {
      console.error("❌ Model - Lỗi khi xóa biến thể:", error.message);
      throw error;
    }
  }
}

module.exports = ProductVariantModel;
