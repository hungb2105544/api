const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

class ProductModel {
  static SELECT_FIELDS =
    "id, name, brand_id, brands(brand_name), type_id, product_types(type_name), description, color, material, image_urls, sku, weight, dimensions, origin_country, warranty_months, care_instructions, features, tags, average_rating, total_ratings, rating_distribution, view_count, is_featured, is_active, created_at, updated_at";

  // Phương thức phụ để lưu lịch sử giá
  static async savePriceHistory({
    product_id,
    variant_id,
    old_price,
    new_price,
    change_reason,
    changed_by,
  }) {
    try {
      if (
        !product_id ||
        !new_price ||
        typeof new_price !== "number" ||
        new_price < 0
      ) {
        throw new Error("Thiếu thông tin bắt buộc hoặc giá mới không hợp lệ");
      }

      const { data, error } = await supabase
        .from("product_price_history")
        .insert([
          {
            product_id,
            variant_id: variant_id || null,
            old_price: old_price || 0, // Nếu không có giá cũ (ví dụ: khi tạo mới), đặt là 0
            new_price,
            change_reason: change_reason || "Cập nhật giá",
            changed_by,
            changed_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("❌ Model - Lỗi khi lưu lịch sử giá:", error.message);
        throw new Error("Không thể lưu lịch sử giá");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi lưu lịch sử giá:", error.message);
      throw error;
    }
  }

  static async createProduct(productData, imageFiles = [], variants = []) {
    if (!productData.name || !productData.brand_id || !productData.type_id) {
      throw new Error("Tên sản phẩm, thương hiệu và loại sản phẩm là bắt buộc");
    }

    try {
      // Kiểm tra brand
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("id", productData.brand_id)
        .single();
      if (brandError || !brand) {
        console.error("❌ Model - Chi tiết lỗi kiểm tra brand:", {
          brand_id: productData.brand_id,
          error: brandError?.message,
        });
        throw new Error("Thương hiệu không tồn tại");
      }

      // Kiểm tra product_type
      const { data: type, error: typeError } = await supabase
        .from("product_types")
        .select("id")
        .eq("id", productData.type_id)
        .single();
      if (typeError || !type) {
        console.error("❌ Model - Chi tiết lỗi kiểm tra product_type:", {
          type_id: productData.type_id,
          error: typeError?.message,
        });
        throw new Error("Loại sản phẩm không tồn tại");
      }

      // Kiểm tra SKU
      const sku = productData.sku || `PROD-${uuidv4().slice(0, 8)}`;
      const { data: existingSku, error: skuError } = await supabase
        .from("products")
        .select("sku")
        .eq("sku", sku)
        .single();
      if (existingSku) {
        throw new Error("Mã SKU đã tồn tại");
      }
      if (skuError && skuError.code !== "PGRST116") {
        console.error("❌ Model - Lỗi khi kiểm tra SKU:", skuError.message);
        throw new Error("Lỗi khi kiểm tra mã SKU");
      }

      // Kiểm tra dữ liệu đầu vào
      if (
        productData.weight &&
        (typeof productData.weight !== "number" || productData.weight < 0)
      ) {
        throw new Error("Trọng lượng phải là số không âm");
      }
      if (productData.dimensions && !this.isValidJson(productData.dimensions)) {
        throw new Error("Kích thước phải là JSON hợp lệ");
      }
      if (productData.tags && !Array.isArray(productData.tags)) {
        throw new Error("Tags phải là một mảng");
      }
      if (
        productData.warranty_months &&
        (typeof productData.warranty_months !== "number" ||
          productData.warranty_months < 0)
      ) {
        throw new Error("Tháng bảo hành phải là số không âm");
      }
      if (productData.features && !this.isValidJson(productData.features)) {
        throw new Error("Tính năng phải là JSON hợp lệ");
      }

      // Thêm sản phẩm
      const { data: createdProduct, error: insertError } = await supabase
        .from("products")
        .insert([
          {
            name: productData.name,
            brand_id: productData.brand_id,
            type_id: productData.type_id,
            description: productData.description || null,
            color: productData.color || null,
            material: productData.material || null,
            sku,
            weight: productData.weight || null,
            dimensions: productData.dimensions || null,
            origin_country: productData.origin_country || null,
            warranty_months: productData.warranty_months || 0,
            care_instructions: productData.care_instructions || null,
            features: productData.features || null,
            tags: productData.tags || [],
            is_featured: productData.is_featured || false,
            image_urls: [],
            is_active: true,
          },
        ])
        .select(this.SELECT_FIELDS)
        .single();

      if (insertError) {
        console.error("❌ Model - Lỗi khi thêm sản phẩm:", insertError.message);
        throw new Error("Không thể thêm sản phẩm mới");
      }

      const product = createdProduct;
      let imageUrls = [];

      // Upload ảnh sản phẩm
      if (imageFiles && imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(async (file) => {
          if (!file.path || !file.originalname || !file.mimetype) {
            console.warn("❌ Model - File không hợp lệ, bỏ qua:", file);
            return null;
          }

          const fileName = `${uuidv4()}-${file.originalname}`;
          const filePath = `product_${product.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("products")
            .upload(filePath, fs.createReadStream(file.path), {
              contentType: file.mimetype,
              duplex: "half",
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

          if (fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
              console.log(`✅ Đã xóa file tạm: ${file.path}`);
            } catch (err) {
              console.error(
                `❌ Lỗi khi xóa file tạm ${file.path}:`,
                err.message
              );
            }
          }

          return urlData?.publicUrl || null;
        });

        imageUrls = (await Promise.all(uploadPromises)).filter(
          (url) => url !== null
        );

        if (imageUrls.length > 0) {
          const { error: updateError } = await supabase
            .from("products")
            .update({
              image_urls: imageUrls,
              updated_at: new Date().toISOString(),
            })
            .eq("id", product.id);

          if (updateError) {
            console.error(
              "❌ Model - Lỗi khi cập nhật ảnh:",
              updateError.message
            );
            throw new Error("Không thể cập nhật ảnh sản phẩm");
          }
        }
      }

      // Lưu lịch sử giá cho các biến thể (nếu có)
      if (variants && Array.isArray(variants) && variants.length > 0) {
        for (const variant of variants) {
          if (
            variant.price &&
            typeof variant.price === "number" &&
            variant.price >= 0
          ) {
            const { data: createdVariant, error: variantError } = await supabase
              .from("product_variants")
              .insert([
                {
                  product_id: product.id,
                  price: variant.price,
                  color: variant.color || null,
                  size_id: variant.size_id || null,
                  is_active: true,
                },
              ])
              .select("id, price")
              .single();

            if (variantError) {
              console.error(
                "❌ Model - Lỗi khi tạo biến thể:",
                variantError.message
              );
              throw new Error("Không thể tạo biến thể sản phẩm");
            }

            // Lưu lịch sử giá cho biến thể
            await this.savePriceHistory({
              product_id: product.id,
              variant_id: createdVariant.id,
              old_price: 0, // Giá cũ là 0 vì đây là tạo mới
              new_price: createdVariant.price,
              change_reason: "Tạo sản phẩm mới",
              changed_by: productData.changed_by || null, // Giả sử changed_by được gửi từ client
            });
          }
        }
      }

      return {
        ...product,
        image_urls: imageUrls,
      };
    } catch (error) {
      console.error("❌ Model - Lỗi khi thêm sản phẩm:", error.message);
      throw error;
    }
  }

  static async updateProduct(id, productData, imageFiles = [], variants = []) {
    try {
      // Kiểm tra sản phẩm tồn tại
      const { data: existingProduct, error: fetchError } = await supabase
        .from("products")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (fetchError || !existingProduct) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy sản phẩm");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra sản phẩm:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra sản phẩm");
      }

      // Kiểm tra brand
      if (productData.brand_id) {
        const { data: brand, error: brandError } = await supabase
          .from("brands")
          .select("id")
          .eq("id", productData.brand_id)
          .single();
        if (brandError || !brand) {
          console.error("❌ Model - Chi tiết lỗi kiểm tra brand:", {
            brand_id: productData.brand_id,
            error: brandError?.message,
          });
          throw new Error("Thương hiệu không tồn tại");
        }
      }

      // Kiểm tra product_type
      if (productData.type_id) {
        const { data: type, error: typeError } = await supabase
          .from("product_types")
          .select("id")
          .eq("id", productData.type_id)
          .single();
        if (typeError || !type) {
          console.error("❌ Model - Chi tiết lỗi kiểm tra product_type:", {
            type_id: productData.type_id,
            error: typeError?.message,
          });
          throw new Error("Loại sản phẩm không tồn tại");
        }
      }

      // Kiểm tra SKU
      if (productData.sku && productData.sku !== existingProduct.sku) {
        const { data: existingSku, error: skuError } = await supabase
          .from("products")
          .select("sku")
          .eq("sku", productData.sku)
          .single();
        if (existingSku) {
          throw new Error("Mã SKU đã tồn tại");
        }
        if (skuError && skuError.code !== "PGRST116") {
          console.error("❌ Model - Lỗi khi kiểm tra SKU:", skuError.message);
          throw new Error("Lỗi khi kiểm tra mã SKU");
        }
      }

      // Kiểm tra dữ liệu đầu vào
      if (
        productData.weight &&
        (typeof productData.weight !== "number" || productData.weight < 0)
      ) {
        throw new Error("Trọng lượng phải là số không âm");
      }
      if (productData.dimensions && !this.isValidJson(productData.dimensions)) {
        throw new Error("Kích thước phải là JSON hợp lệ");
      }
      if (productData.tags && !Array.isArray(productData.tags)) {
        throw new Error("Tags phải là một mảng");
      }
      if (
        productData.warranty_months &&
        (typeof productData.warranty_months !== "number" ||
          productData.warranty_months < 0)
      ) {
        throw new Error("Tháng bảo hành phải là số không âm");
      }
      if (productData.features && !this.isValidJson(productData.features)) {
        throw new Error("Tính năng phải là JSON hợp lệ");
      }

      // Chuẩn bị dữ liệu cập nhật
      const updateData = {
        name: productData.name || existingProduct.name,
        brand_id: productData.brand_id || existingProduct.brand_id,
        type_id: productData.type_id || existingProduct.type_id,
        description: productData.description ?? existingProduct.description,
        color: productData.color ?? existingProduct.color,
        material: productData.material ?? existingProduct.material,
        sku: productData.sku || existingProduct.sku,
        weight: productData.weight ?? existingProduct.weight,
        dimensions: productData.dimensions ?? existingProduct.dimensions,
        origin_country:
          productData.origin_country ?? existingProduct.origin_country,
        warranty_months:
          productData.warranty_months ?? existingProduct.warranty_months,
        care_instructions:
          productData.care_instructions ?? existingProduct.care_instructions,
        features: productData.features ?? existingProduct.features,
        tags: productData.tags ?? existingProduct.tags,
        is_featured: productData.is_featured ?? existingProduct.is_featured,
        updated_at: new Date().toISOString(),
      };

      let imageUrls = existingProduct.image_urls || [];

      // Xóa ảnh nếu có yêu cầu
      if (
        productData.removeImageUrls &&
        Array.isArray(productData.removeImageUrls)
      ) {
        imageUrls = imageUrls.filter(
          (url) => !productData.removeImageUrls.includes(url)
        );
        for (const url of productData.removeImageUrls) {
          const filePath = url.split("/products/")[1];
          const { error: removeError } = await supabase.storage
            .from("products")
            .remove([filePath]);
          if (removeError) {
            console.error("❌ Model - Lỗi khi xóa ảnh:", removeError.message);
          }
        }
      }

      // Upload ảnh mới
      if (imageFiles && imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(async (file) => {
          if (!file.path || !file.originalname || !file.mimetype) {
            console.warn("❌ Model - File không hợp lệ, bỏ qua:", file);
            return null;
          }

          const fileName = `${uuidv4()}-${file.originalname}`;
          const filePath = `product_${id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("products")
            .upload(filePath, fs.createReadStream(file.path), {
              contentType: file.mimetype,
              duplex: "half",
            });

          if (uploadError) {
            console.error(
              "❌ Model - Lỗi khi upload ảnh mới:",
              uploadError.message
            );
            return null;
          }

          const { data: urlData } = supabase.storage
            .from("products")
            .getPublicUrl(filePath);

          if (fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
              console.log(`✅ Đã xóa file tạm: ${file.path}`);
            } catch (err) {
              console.error(
                `❌ Lỗi khi xóa file tạm ${file.path}:`,
                err.message
              );
            }
          }

          return urlData?.publicUrl || null;
        });

        const newImageUrls = (await Promise.all(uploadPromises)).filter(
          (url) => url !== null
        );
        imageUrls = [...imageUrls, ...newImageUrls];
      }

      // Cập nhật sản phẩm
      const { data: updatedProduct, error: updateError } = await supabase
        .from("products")
        .update({ ...updateData, image_urls: imageUrls })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (updateError) {
        console.error(
          "❌ Model - Lỗi khi cập nhật sản phẩm:",
          updateError.message
        );
        throw new Error("Không thể cập nhật sản phẩm");
      }

      // Cập nhật biến thể và lưu lịch sử giá
      if (variants && Array.isArray(variants) && variants.length > 0) {
        for (const variant of variants) {
          if (
            variant.id &&
            variant.price &&
            typeof variant.price === "number" &&
            variant.price >= 0
          ) {
            // Lấy giá hiện tại của biến thể
            const { data: existingVariant, error: variantError } =
              await supabase
                .from("product_variants")
                .select("id, price")
                .eq("id", variant.id)
                .eq("product_id", id)
                .single();

            if (variantError || !existingVariant) {
              console.error(
                "❌ Model - Lỗi khi kiểm tra biến thể:",
                variantError?.message
              );
              continue;
            }

            // Cập nhật biến thể
            const { error: updateVariantError } = await supabase
              .from("product_variants")
              .update({
                price: variant.price,
                color: variant.color ?? existingVariant.color,
                size_id: variant.size_id ?? existingVariant.size_id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", variant.id);

            if (updateVariantError) {
              console.error(
                "❌ Model - Lỗi khi cập nhật biến thể:",
                updateVariantError.message
              );
              continue;
            }

            // Lưu lịch sử giá nếu giá thay đổi
            if (existingVariant.price !== variant.price) {
              await this.savePriceHistory({
                product_id: id,
                variant_id: variant.id,
                old_price: existingVariant.price,
                new_price: variant.price,
                change_reason: variant.change_reason || "Cập nhật giá sản phẩm",
                changed_by: productData.changed_by || null,
              });
            }
          } else if (
            !variant.id &&
            variant.price &&
            typeof variant.price === "number" &&
            variant.price >= 0
          ) {
            // Tạo biến thể mới
            const { data: createdVariant, error: createVariantError } =
              await supabase
                .from("product_variants")
                .insert([
                  {
                    product_id: id,
                    price: variant.price,
                    color: variant.color || null,
                    size_id: variant.size_id || null,
                    is_active: true,
                  },
                ])
                .select("id, price")
                .single();

            if (createVariantError) {
              console.error(
                "❌ Model - Lỗi khi tạo biến thể mới:",
                createVariantError.message
              );
              continue;
            }

            // Lưu lịch sử giá cho biến thể mới
            await this.savePriceHistory({
              product_id: id,
              variant_id: createdVariant.id,
              old_price: 0,
              new_price: createdVariant.price,
              change_reason: "Tạo biến thể mới",
              changed_by: productData.changed_by || null,
            });
          }
        }
      }

      return updatedProduct;
    } catch (error) {
      console.error("❌ Model - Lỗi khi cập nhật sản phẩm:", error.message);
      throw error;
    }
  }

  static async getAllProduct(limit = 10, offset = 0) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(this.SELECT_FIELDS)
        .eq("is_active", true)
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "❌ Model - Lỗi Supabase khi lấy danh sách sản phẩm:",
          error.message
        );
        throw new Error("Không thể lấy danh sách sản phẩm");
      }

      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy sản phẩm:", err.message);
      throw err;
    }
  }
  static async getProductById(id) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Không tìm thấy sản phẩm");
        }
        console.error("❌ Model - Lỗi Supabase:", error.message);
        throw new Error("Lỗi khi lấy sản phẩm");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi lấy sản phẩm:", error.message);
      throw error;
    }
  }
  static async deleteProduct(id, deleteImages = true) {
    try {
      // Kiểm tra sản phẩm tồn tại và đang hoạt động
      const { data: existingProduct, error: fetchError } = await supabase
        .from("products")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (fetchError || !existingProduct) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy sản phẩm");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra sản phẩm:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra sản phẩm");
      }

      // Thực hiện xóa mềm (soft delete)
      const { data: deletedProduct, error: deleteError } = await supabase
        .from("products")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (deleteError) {
        console.error("❌ Model - Lỗi khi xóa sản phẩm:", deleteError.message);
        throw new Error("Không thể xóa sản phẩm");
      }

      return deletedProduct;
    } catch (error) {
      console.error("❌ Model - Lỗi khi xóa sản phẩm:", error.message);
      throw error;
    }
  }

  static isValidJson(data) {
    try {
      if (typeof data === "string") {
        JSON.parse(data);
      } else {
        JSON.stringify(data);
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = ProductModel;
