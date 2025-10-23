const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

class ProductModel {
  static SELECT_FIELDS =
    "id, name, brand_id, brands(brand_name), type_id, product_types(type_name), description, color, material, image_urls, sku, weight, dimensions, origin_country, warranty_months, care_instructions, features, tags, average_rating, total_ratings, rating_distribution, view_count, is_featured, is_active, created_at, updated_at";

  /**
   * @description Chuẩn hóa tên file để an toàn cho URL và hệ thống file.
   * @param {string} filename - Tên file gốc.
   * @returns {string} - Tên file đã được chuẩn hóa.
   */
  static _sanitizeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  }

  static async savePriceHistory({ product_id, price, changed_by = null }) {
    try {
      if (!product_id || typeof price !== "number" || price < 0) {
        throw new Error("Thiếu ID sản phẩm hoặc giá không hợp lệ.");
      }

      const { data, error } = await supabase
        .from("product_price_history")
        .insert({
          product_id,
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
  static isValidJson(data) {
    try {
      if (typeof data === "string") JSON.parse(data);
      else JSON.stringify(data);
      return true;
    } catch (e) {
      return false;
    }
  }

  static async createProduct(productData, imageFiles = [], variants = []) {
    if (!productData.name || !productData.brand_id || !productData.type_id) {
      throw new Error("Tên sản phẩm, thương hiệu và loại sản phẩm là bắt buộc");
    }

    try {
      // Chuyển đổi các trường JSON và số từ chuỗi nếu cần
      if (productData.dimensions && !this.isValidJson(productData.dimensions)) {
        productData.dimensions = JSON.parse(productData.dimensions);
      }
      if (productData.features && !this.isValidJson(productData.features)) {
        productData.features = JSON.parse(productData.features);
      }
      if (
        productData.price !== undefined &&
        typeof productData.price === "string"
      ) {
        productData.price = parseFloat(productData.price);
      }

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

      // THÊM MỚI: Xử lý lưu các size của sản phẩm
      if (
        productData.sizes &&
        Array.isArray(productData.sizes) &&
        productData.sizes.length > 0
      ) {
        const productSizeRecords = productData.sizes.map((sizeId) => ({
          product_id: createdProduct.id,
          size_id: parseInt(sizeId),
        }));

        const { error: sizeError } = await supabase
          .from("product_sizes")
          .insert(productSizeRecords);

        if (sizeError) {
          // Nếu có lỗi, nên có cơ chế rollback hoặc ít nhất là log lại
          console.error(
            "❌ Model - Lỗi khi lưu các size của sản phẩm:",
            sizeError.message
          );
          // Có thể throw lỗi ở đây để transaction thất bại nếu có
          throw new Error("Không thể lưu các kích thước cho sản phẩm.");
        }
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
          const fileName = `${uuidv4()}-${this._sanitizeFileName(
            file.originalname
          )}`;
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

  static async updateProduct(id, productData, userId = null) {
    try {
      const { data: oldProduct } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (!oldProduct) throw new Error("Không tìm thấy sản phẩm");

      // ✅ Kiểm tra SKU trùng
      if (productData.sku && productData.sku !== oldProduct.sku) {
        const { data: variantSku } = await supabase
          .from("product_variants")
          .select("sku")
          .eq("sku", productData.sku)
          .single();
        if (variantSku) throw new Error("SKU đã tồn tại ở biến thể khác");
      }

      // ✅ Xử lý ảnh sản phẩm
      let imageUrls = oldProduct.image_urls || [];

      if (productData.removeImageUrls?.length > 0) {
        const filePaths = productData.removeImageUrls
          .map((url) => {
            const match = url.match(
              /\/storage\/v1\/object\/public\/products\/(.+)$/
            );
            return match ? match[1] : null;
          })
          .filter(Boolean);
        if (filePaths.length > 0)
          await supabase.storage.from("products").remove(filePaths);
        imageUrls = imageUrls.filter(
          (u) => !productData.removeImageUrls.includes(u)
        );
      }

      if (productData.newImages?.length > 0) {
        const uploads = productData.newImages.map(async (file) => {
          const fileName = `${uuidv4()}-${this._sanitizeFileName(
            file.originalname
          )}`;
          const filePath = `product_${id}/${fileName}`;
          await supabase.storage
            .from("products")
            .upload(filePath, file.buffer, {
              contentType: file.mimetype,
              upsert: true,
            });
          const { data: urlData } = supabase.storage
            .from("products")
            .getPublicUrl(filePath);
          return urlData.publicUrl;
        });
        const newUrls = (await Promise.all(uploads)).filter(Boolean);
        imageUrls = [...imageUrls, ...newUrls];
      }

      // ✅ Cập nhật sản phẩm
      const updateData = {
        name: productData.name ?? oldProduct.name,
        brand_id: productData.brand_id ?? oldProduct.brand_id,
        type_id: productData.type_id ?? oldProduct.type_id,
        description: productData.description ?? oldProduct.description,
        sku: productData.sku ?? oldProduct.sku,
        image_urls: imageUrls,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedProduct, error: updateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();
      if (updateError) throw new Error(updateError.message);

      // ✅ Cập nhật các biến thể
      if (productData.variants?.length > 0) {
        for (const variant of productData.variants) {
          if (variant.id) {
            await ProductVariantModel.updateVariant(
              variant.id,
              variant,
              variant.imageFiles || [],
              userId
            );
          } else if (variant.isNew) {
            await ProductVariantModel.createVariant(
              { ...variant, product_id: id },
              variant.imageFiles || [],
              userId
            );
          }
        }
      }

      // ✅ Xóa biến thể
      if (productData.removedVariantIds?.length > 0) {
        for (const vId of productData.removedVariantIds) {
          await ProductVariantModel.deleteVariant(vId);
        }
      }

      // ✅ Trả về dữ liệu đầy đủ
      const { data: full } = await supabase
        .from("products")
        .select(`*, product_variants(*, product_variant_images(*))`)
        .eq("id", id)
        .single();

      return full;
    } catch (err) {
      console.error("❌ updateProduct error:", err.message);
      throw err;
    }
  }

  static async getAllProduct(limit = 10, offset = 0, filters = {}) {
    try {
      // Thêm { count: 'exact' } để lấy tổng số lượng
      let query = supabase
        .from("products")
        .select(this.SELECT_FIELDS, { count: "exact" })
        .eq("is_active", true);

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

      // Áp dụng phân trang và sắp xếp
      query = query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Lấy dữ liệu, lỗi và tổng số lượng
      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Lỗi khi lấy danh sách sản phẩm: ${error.message}`);
      }
      // Trả về đối tượng chứa cả data và count
      return { data, total: count };
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
        product_variants(*, sizes(*), product_variant_images(*)),
        product_sizes(*, sizes(*))
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

      // FIX: Lấy giá hiện tại cho sản phẩm chính
      const { data: productPrices, error: priceError } = await supabase
        .from("product_price_history")
        .select("price, effective_date")
        .eq("product_id", id)
        .is("end_date", null)
        .order("effective_date", { ascending: false })
        .limit(1);

      if (priceError) {
        console.error(
          "❌ Lỗi khi lấy lịch sử giá sản phẩm:",
          priceError.message
        );
      }

      // Gán giá cho sản phẩm chính
      if (productPrices && productPrices.length > 0) {
        data.price = productPrices[0].price;
      } else {
        // Nếu không có giá trong lịch sử, có thể sản phẩm chưa có giá
        data.price = 0;
      }

      // FIX: Tính giá cho các biến thể (giá sản phẩm + additional_price)
      if (data.product_variants && data.product_variants.length > 0) {
        data.product_variants.forEach((variant) => {
          // Giá biến thể = Giá sản phẩm chính + Giá chênh lệch của biến thể
          variant.price = data.price + (variant.additional_price || 0);
        });
      }

      console.log("✅ Dữ liệu sản phẩm sau khi xử lý giá:", {
        productPrice: data.price,
        variants: data.product_variants?.map((v) => ({
          color: v.color,
          size: v.sizes?.size_name,
          additional_price: v.additional_price,
          final_price: v.price,
        })),
      });

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

  /**
   * @description Lấy sản phẩm dựa trên TÊN thương hiệu và TÊN loại sản phẩm.
   * @param {object} filters - Đối tượng chứa bộ lọc.
   * @param {string} [filters.brand_name] - Tên thương hiệu để tìm kiếm (không phân biệt hoa thường).
   * @param {string} [filters.type_name] - Tên loại sản phẩm để tìm kiếm (không phân biệt hoa thường).
   * @returns {Promise<Array<object>>} - Danh sách sản phẩm phù hợp.
   */
  static async getProductsWithTypesAndBrands(filters = {}) {
    try {
      const { brand_name, type_name } = filters;
      let brandId = null;
      let typeId = null;

      // === 1️⃣ Tìm brand_id từ brand_name ===
      if (brand_name) {
        const { data: brandData, error: brandError } = await supabase
          .from("brands")
          .select("id")
          .ilike("brand_name", brand_name)
          .limit(1);

        if (brandError) throw brandError;
        if (brandData?.length) brandId = brandData[0].id;
        else return [];
      }

      // === 2️⃣ Tìm type_id từ type_name ===
      if (type_name) {
        const { data: typeData, error: typeError } = await supabase
          .from("product_types")
          .select("id")
          .ilike("type_name", type_name)
          .limit(1);

        if (typeError) throw typeError;
        if (typeData?.length) typeId = typeData[0].id;
        else return [];
      }

      // === 3️⃣ Lấy danh sách sản phẩm ===
      let query = supabase
        .from("products")
        .select(
          `
  *,
  brands (id, brand_name, image_url, description),
  product_types (id, type_name, description),
  product_variants (
    id, color, sku, additional_price, is_active,
    product_variant_images (id, image_url, sort_order)
  ),
  product_ratings (
    id, rating, title, comment, images, pros, cons, user_id, created_at
  ),
  product_sizes (
    id,
    sizes (id, size_name)
  ),
  inventory (
    id, branch_id, quantity, reserved_quantity,
    branches (id, name, phone)
  ),
  product_price_history (
    id, product_id, price, effective_date, end_date, is_active, created_by, created_at
  )
`
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (brandId) query = query.eq("brand_id", brandId);
      if (typeId) query = query.eq("type_id", typeId);

      const { data: products, error: productError } = await query;
      if (productError) throw productError;
      if (!products?.length) return [];

      // === 4️⃣ Lấy giá hiện tại ===
      const ids = products.map((p) => p.id);
      const { data: prices } = await supabase
        .from("product_price_history")
        .select("product_id, price")
        .in("product_id", ids)
        .is("end_date", null);

      const priceMap = new Map();
      if (prices?.length) {
        prices.forEach((p) => priceMap.set(p.product_id, Number(p.price)));
      }

      // === 5️⃣ Lấy tồn kho tổng ===
      const { data: inventory } = await supabase
        .from("inventory")
        .select("product_id, quantity")
        .in("product_id", ids);

      const invMap = new Map();
      if (inventory?.length) {
        inventory.forEach((i) => {
          invMap.set(
            i.product_id,
            (invMap.get(i.product_id) || 0) + Number(i.quantity)
          );
        });
      }

      // === 6️⃣ Lấy giảm giá ===
      const now = new Date().toISOString();
      const { data: discounts } = await supabase
        .from("product_discounts")
        .select(
          `
        id, name, product_id, brand_id, type_id,
        discount_percentage, discount_amount,
        start_date, end_date, apply_to_all
      `
        )
        .lte("start_date", now)
        .or(`end_date.gte.${now},end_date.is.null`)
        .eq("is_active", true);

      const discountList = discounts || [];

      // === 7️⃣ Chuẩn hóa dữ liệu (✅ SAFE VERSION) ===
      const finalProducts = products.map((p) => {
        const basePrice = priceMap.get(p.id) || 0;
        const discount = discountList.find(
          (d) =>
            d.apply_to_all ||
            d.product_id === p.id ||
            d.brand_id === p.brand_id ||
            d.type_id === p.type_id
        );

        let finalPrice = basePrice;
        if (discount) {
          if (discount.discount_percentage)
            finalPrice = basePrice * (1 - discount.discount_percentage / 100);
          else if (discount.discount_amount)
            finalPrice = basePrice - discount.discount_amount;
        }

        // ✅ Lấy product_sizes từ product level
        const productSizesData = Array.isArray(p.product_sizes)
          ? p.product_sizes
          : [];

        // ✅ Chuẩn hóa product_variants với SAFE CHECKS
        let normalizedVariants = null;
        if (p.product_variants && Array.isArray(p.product_variants)) {
          normalizedVariants = p.product_variants.map((variant) => {
            // ✅ KIỂM TRA variant images
            let variantImages = [];
            if (
              variant.product_variant_images &&
              Array.isArray(variant.product_variant_images)
            ) {
              variantImages = variant.product_variant_images.map((img) => ({
                id: img?.id || 0,
                image_url: img?.image_url || "",
                sort_order: img?.sort_order || 0,
              }));
            }

            return {
              id: variant.id || 0,
              color: variant.color || "",
              sku: variant.sku || "",
              additional_price: Number(variant.additional_price) || 0,
              is_active: variant.is_active ?? true,
              // ✅ Dùng product_sizes từ product level (giống Dart query)
              product_sizes: productSizesData,
              product_variant_images: variantImages,
            };
          });
        }

        return {
          ...p,
          price: basePrice,
          final_price: Math.max(finalPrice, 0),
          product_discounts: discount ? [discount] : [],
          total_stock: invMap.get(p.id) || 0,
          // ✅ Ghi đè product_variants đã chuẩn hóa
          product_variants: normalizedVariants,
        };
      });

      return finalProducts;
    } catch (err) {
      console.error("❌ Lỗi khi lấy sản phẩm:", err.message);
      console.error("❌ Stack trace:", err.stack);
      throw err;
    }
  }
}

module.exports = ProductModel;
