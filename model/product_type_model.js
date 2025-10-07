const supabase = require("../supabaseClient");
const path = require("path");

class ProductTypeModel {
  static SELECT_FIELDS =
    "id, type_name, description, parent_id, product_type:type_name, image_url, is_active";

  // Lấy tất cả loại sản phẩm
  static async getAllProductType() {
    try {
      const { data, error } = await supabase
        .from("product_types")
        .select(this.SELECT_FIELDS)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(
          `Lỗi khi lấy danh sách loại sản phẩm: ${error.message}`
        );
      }

      return {
        success: true,
        data,
        message: "Lấy danh sách loại sản phẩm thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Tạo mới loại sản phẩm
  static async createProductType(typeData, file) {
    try {
      const { type_name, description, parent_id, is_active = true } = typeData;
      let image_url = null;

      // Kiểm tra dữ liệu đầu vào
      if (!type_name) {
        throw new Error("Tên loại sản phẩm là bắt buộc");
      }

      // Xử lý upload ảnh nếu có
      if (file) {
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${type_name.replace(
          /\s+/g,
          "-"
        )}${fileExt}`;
        const filePath = `product_types/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product_types")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
          });

        if (uploadError) {
          throw new Error(`Lỗi khi upload ảnh: ${uploadError.message}`);
        }

        // Lấy URL công khai của ảnh
        const { data: publicUrlData } = supabase.storage
          .from("product_types")
          .getPublicUrl(filePath);

        image_url = publicUrlData.publicUrl;
      }

      // Tạo bản ghi loại sản phẩm trong database
      const { data, error } = await supabase
        .from("product_types")
        .insert({
          type_name,
          description,
          parent_id,
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
            .from("product_types")
            .remove([`product_types/${path.basename(image_url)}`]);
        }
        if (error.code === "23505") {
          throw new Error("Tên loại sản phẩm đã tồn tại");
        }
        throw new Error(`Lỗi khi tạo loại sản phẩm: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: "Tạo loại sản phẩm thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Cập nhật loại sản phẩm
  static async updateProductType(id, typeData, file) {
    try {
      const { type_name, description, parent_id, is_active } = typeData;
      let image_url = typeData.image_url; // Giữ URL hiện tại nếu không upload ảnh mới

      // Kiểm tra ID hợp lệ
      if (!id || isNaN(id)) {
        throw new Error("ID loại sản phẩm không hợp lệ");
      }

      // Lấy thông tin loại sản phẩm hiện tại
      const { data: existingType, error: fetchError } = await supabase
        .from("product_types")
        .select("image_url")
        .eq("id", id)
        .single();

      if (fetchError || !existingType) {
        throw new Error("Loại sản phẩm không tồn tại");
      }

      // Xử lý upload ảnh mới nếu có
      if (file) {
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${
          type_name?.replace(/\s+/g, "-") || "type"
        }${fileExt}`;
        const filePath = `product_types/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product_types")
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
          });

        if (uploadError) {
          throw new Error(`Lỗi khi upload ảnh: ${uploadError.message}`);
        }

        // Lấy URL công khai của ảnh mới
        const { data: publicUrlData } = supabase.storage
          .from("product_types")
          .getPublicUrl(filePath);

        image_url = publicUrlData.publicUrl;

        // Xóa ảnh cũ nếu có
        if (existingType.image_url) {
          const oldFilePath = `product_types/${path.basename(
            existingType.image_url
          )}`;
          await supabase.storage.from("product_types").remove([oldFilePath]);
        }
      }

      // Cập nhật bản ghi loại sản phẩm
      const updateData = {
        type_name: type_name || undefined,
        description: description || undefined,
        parent_id: parent_id || undefined,
        image_url: image_url || undefined,
        is_active: is_active !== undefined ? is_active : undefined,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("product_types")
        .update(updateData)
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        // Xóa ảnh mới upload nếu update thất bại
        if (file && image_url) {
          await supabase.storage
            .from("product_types")
            .remove([`product_types/${path.basename(image_url)}`]);
        }
        if (error.code === "23505") {
          throw new Error("Tên loại sản phẩm đã tồn tại");
        }
        throw new Error(`Lỗi khi cập nhật loại sản phẩm: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: "Cập nhật loại sản phẩm thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Xóa loại sản phẩm
  static async deleteProductType(id) {
    try {
      // Kiểm tra ID hợp lệ
      if (!id || isNaN(id)) {
        throw new Error("ID loại sản phẩm không hợp lệ");
      }

      // Kiểm tra xem loại sản phẩm có sản phẩm liên quan không
      const { data: relatedProducts, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("type_id", id)
        .limit(1);

      if (productError) {
        throw new Error(
          `Lỗi khi kiểm tra sản phẩm liên quan: ${productError.message}`
        );
      }

      if (relatedProducts && relatedProducts.length > 0) {
        throw new Error("Không thể xóa loại sản phẩm vì có sản phẩm liên quan");
      }

      // Kiểm tra xem có loại sản phẩm con không
      const { data: childTypes, error: childError } = await supabase
        .from("product_types")
        .select("id")
        .eq("parent_id", id)
        .limit(1);

      if (childError) {
        throw new Error(
          `Lỗi khi kiểm tra loại sản phẩm con: ${childError.message}`
        );
      }

      if (childTypes && childTypes.length > 0) {
        throw new Error("Không thể xóa loại sản phẩm vì có loại sản phẩm con");
      }

      // Lấy thông tin loại sản phẩm để xóa ảnh
      const { data: type, error: fetchError } = await supabase
        .from("product_types")
        .select("image_url")
        .eq("id", id)
        .single();

      if (fetchError || !type) {
        throw new Error("Loại sản phẩm không tồn tại");
      }

      // Xóa bản ghi loại sản phẩm
      const { error } = await supabase
        .from("product_types")
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error(`Lỗi khi xóa loại sản phẩm: ${error.message}`);
      }

      // Xóa ảnh trong storage nếu có
      if (type.image_url) {
        const filePath = `product_types/${path.basename(type.image_url)}`;
        const { error: storageError } = await supabase.storage
          .from("product_types")
          .remove([filePath]);

        if (storageError) {
          console.warn(
            `Cảnh báo: Không thể xóa ảnh loại sản phẩm: ${storageError.message}`
          );
        }
      }

      return {
        success: true,
        message: "Xóa loại sản phẩm thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = ProductTypeModel;
