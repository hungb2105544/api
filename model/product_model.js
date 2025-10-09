const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

class ProductModel {
  static SELECT_FIELDS =
    "id, name, brand_id, brands(brand_name), type_id, product_types(type_name), description, color, material, image_urls, sku, weight, dimensions, origin_country, warranty_months, care_instructions, features, tags, average_rating, total_ratings, rating_distribution, view_count, is_featured, is_active, created_at, updated_at";

  static async savePriceHistory({
    product_id,
    price,
    variant_id = null,
    changed_by = null,
  }) {
    try {
      if (!product_id || typeof price !== "number" || price < 0) {
        throw new Error("Thiếu ID sản phẩm hoặc giá không hợp lệ.");
      }

      const { data, error } = await supabase
        .from("product_price_history")
        .insert({
          product_id,
          variant_id,
          price,
          effective_date: new Date().toISOString(),
          created_by: changed_by,
        })
        .select("id")
        .single();

      if (error) {
        console.error("❌ Model - Lỗi khi lưu lịch sử giá:", error.message);
        throw new Error("Không thể lưu lịch sử giá");
      }
      return data;
    } catch (err) {
      console.error(
        "❌ Model - Lỗi không mong muốn khi lưu lịch sử giá:",
        err.message
      );
      throw err;
    }
  }

  static async createProduct(productData, imageFiles = [], variants = []) {
    if (!productData.name || !productData.brand_id || !productData.type_id) {
      throw new Error("Tên sản phẩm, thương hiệu và loại sản phẩm là bắt buộc");
    }

    try {
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("id", productData.brand_id)
        .single();
      if (brandError || !brand) throw new Error("Thương hiệu không tồn tại");

      const { data: type, error: typeError } = await supabase
        .from("product_types")
        .select("id")
        .eq("id", productData.type_id)
        .single();
      if (typeError || !type) throw new Error("Loại sản phẩm không tồn tại");

      const sku = productData.sku || `PROD-${uuidv4().slice(0, 8)}`;
      const { data: existingSku, error: skuError } = await supabase
        .from("products")
        .select("sku")
        .eq("sku", sku)
        .single();
      if (existingSku) throw new Error("Mã SKU đã tồn tại");
      if (skuError && skuError.code !== "PGRST116")
        throw new Error("Lỗi khi kiểm tra mã SKU");

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
        throw new Error(`Không thể thêm sản phẩm mới: ${insertError.message}`);
      }

      const product = createdProduct;
      let imageUrls = [];

      if (typeof productData.price === "number" && productData.price >= 0) {
        await this.savePriceHistory({
          product_id: product.id,
          price: productData.price,
          variant_id: null,
          changed_by: productData.changed_by || null,
        });
      }

      if (imageFiles && imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(async (file) => {
          if (!file.buffer || !file.originalname || !file.mimetype) {
            console.warn("❌ Model - File không hợp lệ, bỏ qua:", file);
            return null;
          }
          const fileName = `${uuidv4()}-${file.originalname}`;
          const filePath = `product_${product.id}/${fileName}`;

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
          }
        }
      }

      if (variants && Array.isArray(variants) && variants.length > 0) {
        for (const variant of variants) {
          if (typeof variant.price === "number" && variant.price >= 0) {
            const { data: createdVariant, error: variantError } = await supabase
              .from("product_variants")
              .insert({
                product_id: product.id,
                color: variant.color || null,
                size_id: variant.size_id || null,
                sku:
                  variant.sku ||
                  `${product.sku}-${(variant.color || "VAR").toUpperCase()}`,
                additional_price: variant.additional_price || 0,
                is_active: true,
              })
              .select("id")
              .single();

            if (variantError) {
              console.error(
                "❌ Model - Lỗi khi tạo biến thể:",
                variantError.message
              );
              throw new Error(
                `Không thể tạo biến thể sản phẩm: ${variantError.message}`
              );
            }

            await this.savePriceHistory({
              product_id: product.id,
              variant_id: createdVariant.id,
              price: variant.price,
              change_reason: "Tạo biến thể mới",
              changed_by: productData.changed_by || null,
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
      const { data: existingProduct, error: fetchError } = await supabase
        .from("products")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (fetchError || !existingProduct) {
        throw new Error("Không tìm thấy sản phẩm");
      }

      if (typeof productData.price === "number" && productData.price >= 0) {
        await this.savePriceHistory({
          product_id: id,
          price: productData.price,
          variant_id: null,
          changed_by: productData.changed_by || null,
        });
      }

      const updateData = {
        name: productData.name || existingProduct.name,
        brand_id: productData.brand_id || existingProduct.brand_id,
        type_id: productData.type_id || existingProduct.type_id,
        description: productData.description ?? existingProduct.description,
        sku: productData.sku || existingProduct.sku,
        material: productData.material ?? existingProduct.material,
        weight: productData.weight ?? existingProduct.weight,
        updated_at: new Date().toISOString(),
      };

      let imageUrls = existingProduct.image_urls || [];

      if (
        productData.removeImageUrls &&
        Array.isArray(productData.removeImageUrls)
      ) {
        const urlsToRemove = productData.removeImageUrls;
        imageUrls = imageUrls.filter((url) => !urlsToRemove.includes(url));

        const filePathsToRemove = urlsToRemove
          .map((url) => url.split("/products/")[1])
          .filter(Boolean);
        if (filePathsToRemove.length > 0) {
          await supabase.storage.from("products").remove(filePathsToRemove);
        }
      }

      if (imageFiles && imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(async (file) => {
          if (!file.buffer) return null;
          const fileName = `${uuidv4()}-${file.originalname}`;
          const filePath = `product_${id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("products")
            .upload(filePath, file.buffer, { contentType: file.mimetype });

          if (uploadError) {
            console.error("❌ Lỗi upload ảnh mới:", uploadError.message);
            return null;
          }
          return supabase.storage.from("products").getPublicUrl(filePath).data
            ?.publicUrl;
        });

        const newImageUrls = (await Promise.all(uploadPromises)).filter(
          Boolean
        );
        imageUrls = [...imageUrls, ...newImageUrls];
      }

      const { data: updatedProduct, error: updateError } = await supabase
        .from("products")
        .update({ ...updateData, image_urls: imageUrls })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (updateError) {
        throw new Error(`Không thể cập nhật sản phẩm: ${updateError.message}`);
      }

      if (variants && Array.isArray(variants) && variants.length > 0) {
        for (const variant of variants) {
          if (typeof variant.price !== "number" || variant.price < 0) continue;

          if (variant.id) {
            const { data: existingVariant } = await supabase
              .from("product_variants")
              .select("id, price")
              .eq("id", variant.id)
              .single();
            if (existingVariant) {
              await supabase
                .from("product_variants")
                .update({
                  price: variant.price,
                  color: variant.color,
                  size_id: variant.size_id,
                  sku: variant.sku,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", variant.id);

              if (existingVariant.price !== variant.price) {
                await this.savePriceHistory({
                  product_id: id,
                  variant_id: variant.id,
                  price: variant.price,
                  changed_by: productData.changed_by || null,
                });
              }
            }
          } else {
            const { data: createdVariant, error: createError } = await supabase
              .from("product_variants")
              .insert({
                product_id: id,
                price: variant.price,
                color: variant.color || null,
                size_id: variant.size_id || null,
                sku: variant.sku,
                is_active: true,
              })
              .select("id, price")
              .single();

            if (createError) {
              console.error(
                "❌ Lỗi khi tạo biến thể mới trong lúc cập nhật:",
                createError.message
              );
              continue;
            }

            await this.savePriceHistory({
              product_id: id,
              variant_id: createdVariant.id,
              price: createdVariant.price,
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
  static async getAllProduct(limit = 10, offset = 0, filters = {}) {
    try {
      let query = supabase.from("products").select(this.SELECT_FIELDS);

      query = query.eq("is_active", true);

      if (filters.name) {
        query = query.ilike("name", `%${filters.name}%`);
      }
      if (filters.brand_id) {
        query = query.eq("brand_id", filters.brand_id);
      }
      if (filters.type_id) {
        query = query.eq("type_id", filters.type_id);
      }

      query = query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Lỗi khi lấy danh sách sản phẩm: ${error.message}`);
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
        .select(
          `
          *,
          brands(*),
          product_types(*),
          product_variants(*, sizes(*))
        `
        )
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116")
          throw new Error("Không tìm thấy sản phẩm");
        throw new Error("Lỗi khi lấy sản phẩm");
      }

      const { data: prices, error: priceError } = await supabase
        .from("product_price_history")
        .select("price")
        .eq("product_id", id)
        .is("end_date", null);

      if (priceError) throw new Error("Lỗi khi lấy lịch sử giá.");

      const basePriceRecord = prices.find((p) => p.variant_id === null);
      if (basePriceRecord) {
        data.price = basePriceRecord.price;
      }

      if (data.product_variants && data.product_variants.length > 0) {
        data.product_variants.forEach((variant) => {
          const variantPriceRecord = prices.find(
            (p) => p.variant_id === variant.id
          );
          if (variantPriceRecord) {
            variant.price = variantPriceRecord.price;
          }
        });
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi lấy sản phẩm:", error.message);
      throw error;
    }
  }
  static async deleteProduct(id) {
    try {
      const { data, error } = await supabase
        .from("products")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();
      if (error) throw new Error("Không thể xóa sản phẩm");
      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi xóa sản phẩm:", error.message);
      throw error;
    }
  }

  static isValidJson(data) {
    try {
      if (typeof data === "string") JSON.parse(data);
      else JSON.stringify(data);
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = ProductModel;
