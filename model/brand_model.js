const supabase = require("../supabaseClient");
const path = require("path");

class BrandModel {
  static SELECT_FIELDS = "id, brand_name, image_url, description, is_active";

  // Tạo mới thương hiệu
  static async createBrand(brandData, file) {
    try {
      const { brand_name, description, is_active = true } = brandData;
      let image_url = null;

      // Kiểm tra dữ liệu đầu vào
      if (!brand_name) {
        throw new Error("Tên thương hiệu là bắt buộc");
      }

      // Xử lý upload ảnh nếu có
      if (file) {
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${brand_name.replace(
          /\s+/g,
          "-"
        )}${fileExt}`;
        const filePath = `brands/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("brands")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
          });

        if (uploadError) {
          throw new Error(`Lỗi khi upload ảnh: ${uploadError.message}`);
        }

        // Lấy URL công khai của ảnh
        const { data: publicUrlData } = supabase.storage
          .from("brands")
          .getPublicUrl(filePath);

        image_url = publicUrlData.publicUrl;
      }

      // Tạo bản ghi thương hiệu trong database
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
        // Xóa ảnh đã upload nếu insert thất bại
        if (image_url) {
          await supabase.storage
            .from("brands")
            .remove([`brands/${path.basename(image_url)}`]);
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

  // Cập nhật thương hiệu
  static async updateBrand(id, brandData, file) {
    try {
      const { brand_name, description, is_active } = brandData;
      let image_url = brandData.image_url; // Giữ URL hiện tại nếu không upload ảnh mới

      // Kiểm tra ID hợp lệ
      if (!id || isNaN(id)) {
        throw new Error("ID thương hiệu không hợp lệ");
      }

      // Lấy thông tin thương hiệu hiện tại
      const { data: existingBrand, error: fetchError } = await supabase
        .from("brands")
        .select("image_url")
        .eq("id", id)
        .single();

      if (fetchError || !existingBrand) {
        throw new Error("Thương hiệu không tồn tại");
      }

      // Xử lý upload ảnh mới nếu có
      if (file) {
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${
          brand_name?.replace(/\s+/g, "-") || "brand"
        }${fileExt}`;
        const filePath = `brands/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("brands")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
          });

        if (uploadError) {
          throw new Error(`Lỗi khi upload ảnh: ${uploadError.message}`);
        }

        // Lấy URL công khai của ảnh mới
        const { data: publicUrlData } = supabase.storage
          .from("brands")
          .getPublicUrl(filePath);

        image_url = publicUrlData.publicUrl;

        // Xóa ảnh cũ nếu có
        if (existingBrand.image_url) {
          const oldFilePath = `brands/${path.basename(
            existingBrand.image_url
          )}`;
          await supabase.storage.from("brands").remove([oldFilePath]);
        }
      }

      // Cập nhật bản ghi thương hiệu
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
        // Xóa ảnh mới upload nếu update thất bại
        if (file && image_url) {
          await supabase.storage
            .from("brands")
            .remove([`brands/${path.basename(image_url)}`]);
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

  // Xóa thương hiệu
  static async deleteBrand(id) {
    try {
      // Kiểm tra ID hợp lệ
      if (!id || isNaN(id)) {
        throw new Error("ID thương hiệu không hợp lệ");
      }

      // Kiểm tra xem thương hiệu có sản phẩm liên quan không
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

      // Lấy thông tin thương hiệu để xóa ảnh
      const { data: brand, error: fetchError } = await supabase
        .from("brands")
        .select("image_url")
        .eq("id", id)
        .single();

      if (fetchError || !brand) {
        throw new Error("Thương hiệu không tồn tại");
      }

      // Xóa bản ghi thương hiệu
      const { error } = await supabase.from("brands").delete().eq("id", id);

      if (error) {
        throw new Error(`Lỗi khi xóa thương hiệu: ${error.message}`);
      }

      // Xóa ảnh trong storage nếu có
      if (brand.image_url) {
        const filePath = `brands/${path.basename(brand.image_url)}`;
        const { error: storageError } = await supabase.storage
          .from("brands")
          .remove([filePath]);

        if (storageError) {
          console.warn(
            `Cảnh báo: Không thể xóa ảnh thương hiệu: ${storageError.message}`
          );
        }
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
