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
          .ilike("brand_name", `%${brand_name}%`) // Use ilike for case-insensitive partial match
          .limit(1);

        if (brandError) throw brandError;
        if (brandData?.length) brandId = brandData[0].id;
        else
          return {
            success: false,
            message: `Không tìm thấy thương hiệu '${brand_name}'`,
            products: [],
          }; // Trả về thông báo nếu không tìm thấy
      }

      // === 2️⃣ Tìm type_id từ type_name ===
      if (type_name) {
        const { data: typeData, error: typeError } = await supabase
          .from("product_types")
          .select("id")
          .ilike("type_name", `%${type_name}%`) // Use ilike for case-insensitive partial match
          .limit(1);

        if (typeError) throw typeError;
        if (typeData?.length) typeId = typeData[0].id;
        else
          return {
            success: false,
            message: `Không tìm thấy loại sản phẩm '${type_name}'`,
            products: [],
          }; // Trả về thông báo nếu không tìm thấy
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
      if (!products?.length)
        return {
          success: true,
          message: "Không tìm thấy sản phẩm phù hợp.",
          products: [],
        }; // Trả về mảng rỗng nếu không có sản phẩm

      // === 4️⃣ Lấy giá hiện tại ===
      const ids = products.map((p) => p.id);
      const { data: prices } = await supabase
        .from("product_price_history")
        .select("product_id, price")
        .in("product_id", ids)
        .is("end_date", null)
        .eq("is_active", true); // Chỉ lấy giá đang active

      const priceMap = new Map();
      if (prices?.length) {
        prices.forEach((p) => priceMap.set(p.product_id, Number(p.price)));
      }

      // === 5️⃣ Lấy tồn kho tổng ===
      const { data: inventoryData } = await supabase // Đổi tên biến để tránh trùng
        .from("inventory")
        .select("product_id, quantity")
        .in("product_id", ids);

      const invMap = new Map();
      if (inventoryData?.length) {
        inventoryData.forEach((i) => {
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

      // === 7️⃣ Chuẩn hóa dữ liệu (✅ SAFE VERSION - Null String Fix) ===
      const finalProducts = products.map((p) => {
        const basePrice = priceMap.get(p.id) || 0;
        // Tìm discount phù hợp nhất (ưu tiên product > brand > type > all)
        const productDiscount = discountList.find((d) => d.product_id === p.id);
        const brandDiscount = discountList.find(
          (d) => d.brand_id === p.brand_id
        );
        const typeDiscount = discountList.find((d) => d.type_id === p.type_id);
        const allDiscount = discountList.find((d) => d.apply_to_all);
        const discount =
          productDiscount || brandDiscount || typeDiscount || allDiscount;

        let finalPrice = basePrice;
        let appliedDiscount = null; // Lưu lại discount đã áp dụng

        if (discount) {
          appliedDiscount = {
            // Chỉ lấy các trường cần thiết cho model Dart
            id: discount.id || 0,
            discount_percentage: discount.discount_percentage,
            discount_amount: discount.discount_amount,
            start_date: discount.start_date || "",
            end_date: discount.end_date || "", // Có thể là null, nhưng model Dart nên là String?
            is_active: discount.is_active ?? true,
          };
          if (discount.discount_percentage)
            finalPrice = basePrice * (1 - discount.discount_percentage / 100);
          else if (discount.discount_amount)
            finalPrice = basePrice - discount.discount_amount;
        }

        // Đảm bảo finalPrice không âm
        finalPrice = Math.max(finalPrice, 0);

        // ✅ Lấy product_sizes từ product level và chuẩn hóa
        const productSizesData = (
          Array.isArray(p.product_sizes) ? p.product_sizes : []
        ).map((ps) => ({
          id: ps?.id || 0,
          product_id: ps?.product_id || p.id, // Đảm bảo có product_id
          size_id: ps?.sizes?.id, // Lấy size_id từ sizes lồng nhau
          sizes: {
            id: ps?.sizes?.id || 0,
            size_name: ps?.sizes?.size_name || "", // Đảm bảo size_name là string
            sort_order: ps?.sizes?.sort_order || 0,
          },
          created_at: ps?.created_at || new Date().toISOString(), // Cung cấp giá trị mặc định nếu thiếu
        }));

        // ✅ Chuẩn hóa product_variants với SAFE CHECKS
        let normalizedVariants = null;
        if (p.product_variants && Array.isArray(p.product_variants)) {
          normalizedVariants = p.product_variants.map((variant) => {
            let variantImages = [];
            if (
              variant.product_variant_images &&
              Array.isArray(variant.product_variant_images)
            ) {
              variantImages = variant.product_variant_images.map((img) => ({
                id: img?.id || 0,
                image_url: img?.image_url || "", // Đảm bảo image_url là string
                sort_order: img?.sort_order || 0,
              }));
            }

            // Lấy size từ product level (nếu variant không có size riêng)
            // Lưu ý: Schema của bạn có size_id trong product_variants nhưng query không lấy sizes lồng nhau ở đây.
            // Đoạn code này đang giả định sizes lấy từ product level như model Dart.
            const variantSizes = productSizesData;

            return {
              id: variant?.id || 0,
              color: variant?.color || "", // Đảm bảo color là string
              sku: variant?.sku || "", // Đảm bảo sku là string
              additional_price: Number(variant?.additional_price) || 0,
              is_active: variant?.is_active ?? true,
              product_sizes: variantSizes, // Gán sizes đã chuẩn hóa
              product_variant_images: variantImages,
            };
          });
        }

        // ✅ Chuẩn hóa product_ratings (Fix Null createdAt, images, pros, cons)
        let normalizedRatings = null;
        if (p.product_ratings && Array.isArray(p.product_ratings)) {
          normalizedRatings = p.product_ratings.map((rating) => ({
            ...rating,
            id: rating?.id || 0,
            rating: rating?.rating || 0, // Cần giá trị mặc định cho int
            created_at: rating?.created_at || "", // Đảm bảo created_at là string
            // Đảm bảo các mảng là mảng, kể cả khi null/undefined
            images: Array.isArray(rating?.images)
              ? rating.images.map((img) => img || "")
              : [],
            pros: Array.isArray(rating?.pros)
              ? rating.pros.map((pro) => pro || "")
              : [],
            cons: Array.isArray(rating?.cons)
              ? rating.cons.map((con) => con || "")
              : [],
            // Các trường String? có thể giữ nguyên là null hoặc thay bằng '' nếu cần
            // title: rating?.title || null,
            // comment: rating?.comment || null,
            // user_id: rating?.user_id || null,
          }));
        }

        // ✅ Chuẩn hóa inventory (Fix Null Branch Name/Phone)
        let normalizedInventory = null;
        if (p.inventory && Array.isArray(p.inventory)) {
          normalizedInventory = p.inventory.map((inv) => ({
            id: inv?.id || 0,
            branch_id: inv?.branch_id || 0, // Cần giá trị mặc định cho int
            quantity: inv?.quantity || 0,
            reserved_quantity: inv?.reserved_quantity || 0,
            branches: {
              id: inv?.branches?.id || 0, // Cần giá trị mặc định cho int
              name: inv?.branches?.name || "", // Đảm bảo name là string
              phone: inv?.branches?.phone || "", // Đảm bảo phone là string
            },
          }));
        }

        // ✅ Chuẩn hóa product_price_history
        let normalizedPriceHistory = null;
        if (p.product_price_history && Array.isArray(p.product_price_history)) {
          normalizedPriceHistory = p.product_price_history.map((hist) => ({
            id: hist?.id || 0,
            product_id: hist?.product_id || p.id,
            price: Number(hist?.price) || 0,
            effective_date: hist?.effective_date || new Date().toISOString(),
            end_date: hist?.end_date || null, // Có thể là null
            is_active: hist?.is_active ?? true,
            created_by: hist?.created_by || null, // Có thể là null
            created_at: hist?.created_at || new Date().toISOString(),
          }));
        }

        return {
          // Sao chép các trường gốc, đảm bảo các trường bắt buộc có giá trị
          id: p.id || 0,
          brand_id: p.brand_id,
          type_id: p.type_id,
          name: p.name || "", // Đảm bảo tên sản phẩm là string
          description: p.description || null, // Cho phép null nếu model Dart là String?
          image_urls: Array.isArray(p.image_urls)
            ? p.image_urls.map((url) => url || "")
            : [], // Đảm bảo là mảng string
          sku: p.sku || null, // Cho phép null nếu model Dart là String?
          weight: Number(p.weight) || null, // Cho phép null nếu model Dart là double?
          dimensions: p.dimensions || null, // Giữ nguyên jsonb hoặc null
          material: p.material || null,
          color: p.color || null,
          origin_country: p.origin_country || null,
          warranty_months: p.warranty_months || 0,
          care_instructions: p.care_instructions || null,
          features: p.features || null, // Giữ nguyên jsonb hoặc null
          tags: Array.isArray(p.tags) ? p.tags.map((tag) => tag || "") : [], // Đảm bảo là mảng string
          average_rating: Number(p.average_rating) || 0.0,
          total_ratings: p.total_ratings || 0,
          rating_distribution: p.rating_distribution || {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
          },
          view_count: p.view_count || 0,
          is_featured: p.is_featured ?? false,
          is_active: p.is_active ?? true,
          created_at: p.created_at || new Date().toISOString(), // Cung cấp giá trị mặc định
          updated_at: p.updated_at || new Date().toISOString(), // Cung cấp giá trị mặc định

          // Các đối tượng lồng nhau đã chuẩn hóa
          brands: {
            id: p.brands?.id || 0,
            brand_name: p.brands?.brand_name || "", // Đảm bảo brand_name là string
            image_url: p.brands?.image_url || null,
            description: p.brands?.description || null,
          },
          product_types: {
            id: p.product_types?.id || 0,
            type_name: p.product_types?.type_name || "", // Đảm bảo type_name là string
            description: p.product_types?.description || null,
          },

          // Các mảng lồng nhau đã chuẩn hóa
          product_variants: normalizedVariants,
          product_ratings: normalizedRatings,
          product_sizes: productSizesData, // Gán product_sizes đã chuẩn hóa ở cấp product
          inventory: normalizedInventory,
          product_price_history: normalizedPriceHistory,

          // Các trường tính toán/thêm vào
          price: basePrice, // Giá gốc hiện tại
          final_price: finalPrice, // Giá cuối cùng sau khi áp dụng discount
          product_discounts: appliedDiscount ? [appliedDiscount] : [], // Chỉ trả về discount đã áp dụng (nếu có)
          total_stock: invMap.get(p.id) || 0, // Tổng tồn kho
        };
      });

      // Trả về kết quả thành công cùng danh sách sản phẩm
      return {
        success: true,
        brand: brand_name || null, // Trả về tên brand đã lọc (nếu có)
        type: type_name || null, // Trả về tên type đã lọc (nếu có)
        count: finalProducts.length,
        products: finalProducts,
      };
    } catch (err) {
      console.error("❌ Lỗi khi lấy sản phẩm:", err.message);
      console.error("❌ Stack trace:", err.stack);
      // Trả về lỗi một cách nhất quán
      return {
        success: false,
        message: `Lỗi máy chủ: ${err.message}`,
        products: [],
      };
    }
  }

  static async getProductsWithTypes(filters = {}) {
    try {
      const { type_name } = filters;
      let brandId = null;
      let typeId = null;

      // === 2️⃣ Tìm type_id từ type_name ===
      if (type_name) {
        const { data: typeData, error: typeError } = await supabase
          .from("product_types")
          .select("id")
          .ilike("type_name", `%${type_name}%`) // Use ilike for case-insensitive partial match
          .limit(1);

        if (typeError) throw typeError;
        if (typeData?.length) typeId = typeData[0].id;
        else
          return {
            success: false,
            message: `Không tìm thấy loại sản phẩm '${type_name}'`,
            products: [],
          }; // Trả về thông báo nếu không tìm thấy
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

      if (typeId) query = query.eq("type_id", typeId);

      const { data: products, error: productError } = await query;
      if (productError) throw productError;
      if (!products?.length)
        return {
          success: true,
          message: "Không tìm thấy sản phẩm phù hợp.",
          products: [],
        }; // Trả về mảng rỗng nếu không có sản phẩm

      // === 4️⃣ Lấy giá hiện tại ===
      const ids = products.map((p) => p.id);
      const { data: prices } = await supabase
        .from("product_price_history")
        .select("product_id, price")
        .in("product_id", ids)
        .is("end_date", null)
        .eq("is_active", true); // Chỉ lấy giá đang active

      const priceMap = new Map();
      if (prices?.length) {
        prices.forEach((p) => priceMap.set(p.product_id, Number(p.price)));
      }

      // === 5️⃣ Lấy tồn kho tổng ===
      const { data: inventoryData } = await supabase // Đổi tên biến để tránh trùng
        .from("inventory")
        .select("product_id, quantity")
        .in("product_id", ids);

      const invMap = new Map();
      if (inventoryData?.length) {
        inventoryData.forEach((i) => {
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

      // === 7️⃣ Chuẩn hóa dữ liệu (✅ SAFE VERSION - Null String Fix) ===
      const finalProducts = products.map((p) => {
        const basePrice = priceMap.get(p.id) || 0;
        // Tìm discount phù hợp nhất (ưu tiên product > brand > type > all)
        const productDiscount = discountList.find((d) => d.product_id === p.id);
        const brandDiscount = discountList.find(
          (d) => d.brand_id === p.brand_id
        );
        const typeDiscount = discountList.find((d) => d.type_id === p.type_id);
        const allDiscount = discountList.find((d) => d.apply_to_all);
        const discount =
          productDiscount || brandDiscount || typeDiscount || allDiscount;

        let finalPrice = basePrice;
        let appliedDiscount = null; // Lưu lại discount đã áp dụng

        if (discount) {
          appliedDiscount = {
            // Chỉ lấy các trường cần thiết cho model Dart
            id: discount.id || 0,
            discount_percentage: discount.discount_percentage,
            discount_amount: discount.discount_amount,
            start_date: discount.start_date || "",
            end_date: discount.end_date || "", // Có thể là null, nhưng model Dart nên là String?
            is_active: discount.is_active ?? true,
          };
          if (discount.discount_percentage)
            finalPrice = basePrice * (1 - discount.discount_percentage / 100);
          else if (discount.discount_amount)
            finalPrice = basePrice - discount.discount_amount;
        }

        // Đảm bảo finalPrice không âm
        finalPrice = Math.max(finalPrice, 0);

        // ✅ Lấy product_sizes từ product level và chuẩn hóa
        const productSizesData = (
          Array.isArray(p.product_sizes) ? p.product_sizes : []
        ).map((ps) => ({
          id: ps?.id || 0,
          product_id: ps?.product_id || p.id, // Đảm bảo có product_id
          size_id: ps?.sizes?.id, // Lấy size_id từ sizes lồng nhau
          sizes: {
            id: ps?.sizes?.id || 0,
            size_name: ps?.sizes?.size_name || "", // Đảm bảo size_name là string
            sort_order: ps?.sizes?.sort_order || 0,
          },
          created_at: ps?.created_at || new Date().toISOString(), // Cung cấp giá trị mặc định nếu thiếu
        }));

        // ✅ Chuẩn hóa product_variants với SAFE CHECKS
        let normalizedVariants = null;
        if (p.product_variants && Array.isArray(p.product_variants)) {
          normalizedVariants = p.product_variants.map((variant) => {
            let variantImages = [];
            if (
              variant.product_variant_images &&
              Array.isArray(variant.product_variant_images)
            ) {
              variantImages = variant.product_variant_images.map((img) => ({
                id: img?.id || 0,
                image_url: img?.image_url || "", // Đảm bảo image_url là string
                sort_order: img?.sort_order || 0,
              }));
            }

            // Lấy size từ product level (nếu variant không có size riêng)
            // Lưu ý: Schema của bạn có size_id trong product_variants nhưng query không lấy sizes lồng nhau ở đây.
            // Đoạn code này đang giả định sizes lấy từ product level như model Dart.
            const variantSizes = productSizesData;

            return {
              id: variant?.id || 0,
              color: variant?.color || "", // Đảm bảo color là string
              sku: variant?.sku || "", // Đảm bảo sku là string
              additional_price: Number(variant?.additional_price) || 0,
              is_active: variant?.is_active ?? true,
              product_sizes: variantSizes, // Gán sizes đã chuẩn hóa
              product_variant_images: variantImages,
            };
          });
        }

        // ✅ Chuẩn hóa product_ratings (Fix Null createdAt, images, pros, cons)
        let normalizedRatings = null;
        if (p.product_ratings && Array.isArray(p.product_ratings)) {
          normalizedRatings = p.product_ratings.map((rating) => ({
            ...rating,
            id: rating?.id || 0,
            rating: rating?.rating || 0, // Cần giá trị mặc định cho int
            created_at: rating?.created_at || "", // Đảm bảo created_at là string
            // Đảm bảo các mảng là mảng, kể cả khi null/undefined
            images: Array.isArray(rating?.images)
              ? rating.images.map((img) => img || "")
              : [],
            pros: Array.isArray(rating?.pros)
              ? rating.pros.map((pro) => pro || "")
              : [],
            cons: Array.isArray(rating?.cons)
              ? rating.cons.map((con) => con || "")
              : [],
          }));
        }

        // ✅ Chuẩn hóa inventory (Fix Null Branch Name/Phone)
        let normalizedInventory = null;
        if (p.inventory && Array.isArray(p.inventory)) {
          normalizedInventory = p.inventory.map((inv) => ({
            id: inv?.id || 0,
            branch_id: inv?.branch_id || 0, // Cần giá trị mặc định cho int
            quantity: inv?.quantity || 0,
            reserved_quantity: inv?.reserved_quantity || 0,
            branches: {
              id: inv?.branches?.id || 0, // Cần giá trị mặc định cho int
              name: inv?.branches?.name || "", // Đảm bảo name là string
              phone: inv?.branches?.phone || "", // Đảm bảo phone là string
            },
          }));
        }

        // ✅ Chuẩn hóa product_price_history
        let normalizedPriceHistory = null;
        if (p.product_price_history && Array.isArray(p.product_price_history)) {
          normalizedPriceHistory = p.product_price_history.map((hist) => ({
            id: hist?.id || 0,
            product_id: hist?.product_id || p.id,
            price: Number(hist?.price) || 0,
            effective_date: hist?.effective_date || new Date().toISOString(),
            end_date: hist?.end_date || null, // Có thể là null
            is_active: hist?.is_active ?? true,
            created_by: hist?.created_by || null, // Có thể là null
            created_at: hist?.created_at || new Date().toISOString(),
          }));
        }

        return {
          // Sao chép các trường gốc, đảm bảo các trường bắt buộc có giá trị
          id: p.id || 0,
          brand_id: p.brand_id,
          type_id: p.type_id,
          name: p.name || "", // Đảm bảo tên sản phẩm là string
          description: p.description || null, // Cho phép null nếu model Dart là String?
          image_urls: Array.isArray(p.image_urls)
            ? p.image_urls.map((url) => url || "")
            : [], // Đảm bảo là mảng string
          sku: p.sku || null, // Cho phép null nếu model Dart là String?
          weight: Number(p.weight) || null, // Cho phép null nếu model Dart là double?
          dimensions: p.dimensions || null, // Giữ nguyên jsonb hoặc null
          material: p.material || null,
          color: p.color || null,
          origin_country: p.origin_country || null,
          warranty_months: p.warranty_months || 0,
          care_instructions: p.care_instructions || null,
          features: p.features || null, // Giữ nguyên jsonb hoặc null
          tags: Array.isArray(p.tags) ? p.tags.map((tag) => tag || "") : [], // Đảm bảo là mảng string
          average_rating: Number(p.average_rating) || 0.0,
          total_ratings: p.total_ratings || 0,
          rating_distribution: p.rating_distribution || {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
          },
          view_count: p.view_count || 0,
          is_featured: p.is_featured ?? false,
          is_active: p.is_active ?? true,
          created_at: p.created_at || new Date().toISOString(), // Cung cấp giá trị mặc định
          updated_at: p.updated_at || new Date().toISOString(), // Cung cấp giá trị mặc định

          // Các đối tượng lồng nhau đã chuẩn hóa
          brands: {
            id: p.brands?.id || 0,
            brand_name: p.brands?.brand_name || "", // Đảm bảo brand_name là string
            image_url: p.brands?.image_url || null,
            description: p.brands?.description || null,
          },
          product_types: {
            id: p.product_types?.id || 0,
            type_name: p.product_types?.type_name || "", // Đảm bảo type_name là string
            description: p.product_types?.description || null,
          },

          // Các mảng lồng nhau đã chuẩn hóa
          product_variants: normalizedVariants,
          product_ratings: normalizedRatings,
          product_sizes: productSizesData, // Gán product_sizes đã chuẩn hóa ở cấp product
          inventory: normalizedInventory,
          product_price_history: normalizedPriceHistory,

          // Các trường tính toán/thêm vào
          price: basePrice, // Giá gốc hiện tại
          final_price: finalPrice, // Giá cuối cùng sau khi áp dụng discount
          product_discounts: appliedDiscount ? [appliedDiscount] : [], // Chỉ trả về discount đã áp dụng (nếu có)
          total_stock: invMap.get(p.id) || 0, // Tổng tồn kho
        };
      });

      // Trả về kết quả thành công cùng danh sách sản phẩm
      return {
        success: true,
        brand: brand_name || null, // Trả về tên brand đã lọc (nếu có)
        type: type_name || null, // Trả về tên type đã lọc (nếu có)
        count: finalProducts.length,
        products: finalProducts,
      };
    } catch (err) {
      console.error("❌ Lỗi khi lấy sản phẩm:", err.message);
      console.error("❌ Stack trace:", err.stack);
      // Trả về lỗi một cách nhất quán
      return {
        success: false,
        message: `Lỗi máy chủ: ${err.message}`,
        products: [],
      };
    }
  }

  static async getProductsWithBrands(filters = {}) {
    try {
      const { brand_name } = filters;
      let brandId = null;

      // === 1️⃣ Tìm brand_id từ brand_name ===
      if (brand_name) {
        const { data: brandData, error: brandError } = await supabase
          .from("brands")
          .select("id")
          .ilike("brand_name", `%${brand_name}%`) // Use ilike for case-insensitive partial match
          .limit(1);

        if (brandError) throw brandError;
        if (brandData?.length) brandId = brandData[0].id;
        else
          return {
            success: false,
            message: `Không tìm thấy thương hiệu '${brand_name}'`,
            products: [],
          }; // Trả về thông báo nếu không tìm thấy
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

      const { data: products, error: productError } = await query;
      if (productError) throw productError;
      if (!products?.length)
        return {
          success: true,
          message: "Không tìm thấy sản phẩm phù hợp.",
          products: [],
        }; // Trả về mảng rỗng nếu không có sản phẩm

      // === 4️⃣ Lấy giá hiện tại ===
      const ids = products.map((p) => p.id);
      const { data: prices } = await supabase
        .from("product_price_history")
        .select("product_id, price")
        .in("product_id", ids)
        .is("end_date", null)
        .eq("is_active", true); // Chỉ lấy giá đang active

      const priceMap = new Map();
      if (prices?.length) {
        prices.forEach((p) => priceMap.set(p.product_id, Number(p.price)));
      }

      // === 5️⃣ Lấy tồn kho tổng ===
      const { data: inventoryData } = await supabase // Đổi tên biến để tránh trùng
        .from("inventory")
        .select("product_id, quantity")
        .in("product_id", ids);

      const invMap = new Map();
      if (inventoryData?.length) {
        inventoryData.forEach((i) => {
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

      // === 7️⃣ Chuẩn hóa dữ liệu (✅ SAFE VERSION - Null String Fix) ===
      const finalProducts = products.map((p) => {
        const basePrice = priceMap.get(p.id) || 0;
        // Tìm discount phù hợp nhất (ưu tiên product > brand > type > all)
        const productDiscount = discountList.find((d) => d.product_id === p.id);
        const brandDiscount = discountList.find(
          (d) => d.brand_id === p.brand_id
        );
        const typeDiscount = discountList.find((d) => d.type_id === p.type_id);
        const allDiscount = discountList.find((d) => d.apply_to_all);
        const discount =
          productDiscount || brandDiscount || typeDiscount || allDiscount;

        let finalPrice = basePrice;
        let appliedDiscount = null; // Lưu lại discount đã áp dụng

        if (discount) {
          appliedDiscount = {
            // Chỉ lấy các trường cần thiết cho model Dart
            id: discount.id || 0,
            discount_percentage: discount.discount_percentage,
            discount_amount: discount.discount_amount,
            start_date: discount.start_date || "",
            end_date: discount.end_date || "", // Có thể là null, nhưng model Dart nên là String?
            is_active: discount.is_active ?? true,
          };
          if (discount.discount_percentage)
            finalPrice = basePrice * (1 - discount.discount_percentage / 100);
          else if (discount.discount_amount)
            finalPrice = basePrice - discount.discount_amount;
        }

        // Đảm bảo finalPrice không âm
        finalPrice = Math.max(finalPrice, 0);

        // ✅ Lấy product_sizes từ product level và chuẩn hóa
        const productSizesData = (
          Array.isArray(p.product_sizes) ? p.product_sizes : []
        ).map((ps) => ({
          id: ps?.id || 0,
          product_id: ps?.product_id || p.id, // Đảm bảo có product_id
          size_id: ps?.sizes?.id, // Lấy size_id từ sizes lồng nhau
          sizes: {
            id: ps?.sizes?.id || 0,
            size_name: ps?.sizes?.size_name || "", // Đảm bảo size_name là string
            sort_order: ps?.sizes?.sort_order || 0,
          },
          created_at: ps?.created_at || new Date().toISOString(), // Cung cấp giá trị mặc định nếu thiếu
        }));

        // ✅ Chuẩn hóa product_variants với SAFE CHECKS
        let normalizedVariants = null;
        if (p.product_variants && Array.isArray(p.product_variants)) {
          normalizedVariants = p.product_variants.map((variant) => {
            let variantImages = [];
            if (
              variant.product_variant_images &&
              Array.isArray(variant.product_variant_images)
            ) {
              variantImages = variant.product_variant_images.map((img) => ({
                id: img?.id || 0,
                image_url: img?.image_url || "", // Đảm bảo image_url là string
                sort_order: img?.sort_order || 0,
              }));
            }
            const variantSizes = productSizesData;

            return {
              id: variant?.id || 0,
              color: variant?.color || "", // Đảm bảo color là string
              sku: variant?.sku || "", // Đảm bảo sku là string
              additional_price: Number(variant?.additional_price) || 0,
              is_active: variant?.is_active ?? true,
              product_sizes: variantSizes, // Gán sizes đã chuẩn hóa
              product_variant_images: variantImages,
            };
          });
        }

        // ✅ Chuẩn hóa product_ratings (Fix Null createdAt, images, pros, cons)
        let normalizedRatings = null;
        if (p.product_ratings && Array.isArray(p.product_ratings)) {
          normalizedRatings = p.product_ratings.map((rating) => ({
            ...rating,
            id: rating?.id || 0,
            rating: rating?.rating || 0, // Cần giá trị mặc định cho int
            created_at: rating?.created_at || "", // Đảm bảo created_at là string
            // Đảm bảo các mảng là mảng, kể cả khi null/undefined
            images: Array.isArray(rating?.images)
              ? rating.images.map((img) => img || "")
              : [],
            pros: Array.isArray(rating?.pros)
              ? rating.pros.map((pro) => pro || "")
              : [],
            cons: Array.isArray(rating?.cons)
              ? rating.cons.map((con) => con || "")
              : [],
            // Các trường String? có thể giữ nguyên là null hoặc thay bằng '' nếu cần
            // title: rating?.title || null,
            // comment: rating?.comment || null,
            // user_id: rating?.user_id || null,
          }));
        }

        // ✅ Chuẩn hóa inventory (Fix Null Branch Name/Phone)
        let normalizedInventory = null;
        if (p.inventory && Array.isArray(p.inventory)) {
          normalizedInventory = p.inventory.map((inv) => ({
            id: inv?.id || 0,
            branch_id: inv?.branch_id || 0, // Cần giá trị mặc định cho int
            quantity: inv?.quantity || 0,
            reserved_quantity: inv?.reserved_quantity || 0,
            branches: {
              id: inv?.branches?.id || 0, // Cần giá trị mặc định cho int
              name: inv?.branches?.name || "", // Đảm bảo name là string
              phone: inv?.branches?.phone || "", // Đảm bảo phone là string
            },
          }));
        }

        // ✅ Chuẩn hóa product_price_history
        let normalizedPriceHistory = null;
        if (p.product_price_history && Array.isArray(p.product_price_history)) {
          normalizedPriceHistory = p.product_price_history.map((hist) => ({
            id: hist?.id || 0,
            product_id: hist?.product_id || p.id,
            price: Number(hist?.price) || 0,
            effective_date: hist?.effective_date || new Date().toISOString(),
            end_date: hist?.end_date || null, // Có thể là null
            is_active: hist?.is_active ?? true,
            created_by: hist?.created_by || null, // Có thể là null
            created_at: hist?.created_at || new Date().toISOString(),
          }));
        }

        return {
          // Sao chép các trường gốc, đảm bảo các trường bắt buộc có giá trị
          id: p.id || 0,
          brand_id: p.brand_id,
          type_id: p.type_id,
          name: p.name || "", // Đảm bảo tên sản phẩm là string
          description: p.description || null, // Cho phép null nếu model Dart là String?
          image_urls: Array.isArray(p.image_urls)
            ? p.image_urls.map((url) => url || "")
            : [], // Đảm bảo là mảng string
          sku: p.sku || null, // Cho phép null nếu model Dart là String?
          weight: Number(p.weight) || null, // Cho phép null nếu model Dart là double?
          dimensions: p.dimensions || null, // Giữ nguyên jsonb hoặc null
          material: p.material || null,
          color: p.color || null,
          origin_country: p.origin_country || null,
          warranty_months: p.warranty_months || 0,
          care_instructions: p.care_instructions || null,
          features: p.features || null, // Giữ nguyên jsonb hoặc null
          tags: Array.isArray(p.tags) ? p.tags.map((tag) => tag || "") : [], // Đảm bảo là mảng string
          average_rating: Number(p.average_rating) || 0.0,
          total_ratings: p.total_ratings || 0,
          rating_distribution: p.rating_distribution || {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
          },
          view_count: p.view_count || 0,
          is_featured: p.is_featured ?? false,
          is_active: p.is_active ?? true,
          created_at: p.created_at || new Date().toISOString(), // Cung cấp giá trị mặc định
          updated_at: p.updated_at || new Date().toISOString(), // Cung cấp giá trị mặc định

          // Các đối tượng lồng nhau đã chuẩn hóa
          brands: {
            id: p.brands?.id || 0,
            brand_name: p.brands?.brand_name || "", // Đảm bảo brand_name là string
            image_url: p.brands?.image_url || null,
            description: p.brands?.description || null,
          },
          product_types: {
            id: p.product_types?.id || 0,
            type_name: p.product_types?.type_name || "", // Đảm bảo type_name là string
            description: p.product_types?.description || null,
          },

          // Các mảng lồng nhau đã chuẩn hóa
          product_variants: normalizedVariants,
          product_ratings: normalizedRatings,
          product_sizes: productSizesData, // Gán product_sizes đã chuẩn hóa ở cấp product
          inventory: normalizedInventory,
          product_price_history: normalizedPriceHistory,

          // Các trường tính toán/thêm vào
          price: basePrice, // Giá gốc hiện tại
          final_price: finalPrice, // Giá cuối cùng sau khi áp dụng discount
          product_discounts: appliedDiscount ? [appliedDiscount] : [], // Chỉ trả về discount đã áp dụng (nếu có)
          total_stock: invMap.get(p.id) || 0, // Tổng tồn kho
        };
      });

      // Trả về kết quả thành công cùng danh sách sản phẩm
      return {
        success: true,
        brand: brand_name || null, // Trả về tên brand đã lọc (nếu có)
        count: finalProducts.length,
        products: finalProducts,
      };
    } catch (err) {
      console.error("❌ Lỗi khi lấy sản phẩm:", err.message);
      console.error("❌ Stack trace:", err.stack);
      // Trả về lỗi một cách nhất quán
      return {
        success: false,
        message: `Lỗi máy chủ: ${err.message}`,
        products: [],
      };
    }
  }
}

module.exports = ProductModel;
