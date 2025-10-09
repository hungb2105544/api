const supabase = require("../supabaseClient");
const StorageHelper = require("./storage_helper");

class BrandModel {
  static SELECT_FIELDS = "id, brand_name, image_url, description, is_active";

  static async createBrand(brandData, file) {
    try {
      const { brand_name, description, is_active = true } = brandData;
      let image_url = null;

      if (!brand_name) {
        throw new Error("Tên thương hiệu là bắt buộc");
      }

      if (file) {
        image_url = await StorageHelper.uploadImage(file, "brands", brand_name);
      }
      const { data, error } = await supabase
        .from("brands")
        .insert({
          brand_name,
          description,
          image_url,
          is_active,
          created_at: new Date().toISOString(),
        })
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        if (image_url) {
          await StorageHelper.deleteImage(image_url, "brands");
        }
        if (error.code === "23505") {
          throw new Error("Tên thương hiệu đã tồn tại");
        }
        throw new Error(`Lỗi khi tạo thương hiệu: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: "Tạo thương hiệu thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async updateBrand(id, brandData, file) {
    try {
      const { brand_name, description, is_active } = brandData;
      let image_url = brandData.image_url;

      if (!id || isNaN(id)) {
        throw new Error("ID thương hiệu không hợp lệ");
      }

      const { data: existingBrand, error: fetchError } = await supabase
        .from("brands")
        .select("image_url")
        .eq("id", id)
        .single();

      if (fetchError || !existingBrand) {
        throw new Error("Thương hiệu không tồn tại");
      }

      if (file) {
        const newImageUrl = await StorageHelper.uploadImage(
          file,
          "brands",
          brand_name || "brand"
        );

        await StorageHelper.deleteImage(existingBrand.image_url, "brands");
        image_url = newImageUrl;
      }

      const updateData = {
        brand_name: brand_name || undefined,
        description: description || undefined,
        image_url: image_url || undefined,
        is_active: is_active !== undefined ? is_active : undefined,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("brands")
        .update(updateData)
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        if (file && image_url) {
          await StorageHelper.deleteImage(image_url, "brands");
        }
        if (error.code === "23505") {
          throw new Error("Tên thương hiệu đã tồn tại");
        }
        throw new Error(`Lỗi khi cập nhật thương hiệu: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: "Cập nhật thương hiệu thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async deleteBrand(id) {
    try {
      if (!id || isNaN(id)) {
        throw new Error("ID thương hiệu không hợp lệ");
      }

      const { data: relatedProducts, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("brand_id", id)
        .limit(1);

      if (productError) {
        throw new Error(
          `Lỗi khi kiểm tra sản phẩm liên quan: ${productError.message}`
        );
      }

      if (relatedProducts && relatedProducts.length > 0) {
        throw new Error("Không thể xóa thương hiệu vì có sản phẩm liên quan");
      }

      const { data: brand, error: fetchError } = await supabase
        .from("brands")
        .select("image_url")
        .eq("id", id)
        .single();

      if (fetchError || !brand) {
        throw new Error("Thương hiệu không tồn tại");
      }

      const { error } = await supabase.from("brands").delete().eq("id", id);

      if (error) {
        throw new Error(`Lỗi khi xóa thương hiệu: ${error.message}`);
      }

      if (brand.image_url) {
        StorageHelper.deleteImage(brand.image_url, "brands").catch((err) =>
          console.warn(
            `Cảnh báo: Không thể xóa ảnh thương hiệu: ${err.message}`
          )
        );
      }

      return {
        success: true,
        message: "Xóa thương hiệu thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = BrandModel;
