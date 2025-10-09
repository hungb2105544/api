const supabase = require("../supabaseClient");
const StorageHelper = require("./storage_helper");

class ProductTypeModel {
  static SELECT_FIELDS =
    "id, type_name, description, parent_id, product_type:type_name, image_url, is_active";

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

  static async createProductType(typeData, file) {
    try {
      const { type_name, description, parent_id, is_active = true } = typeData;
      let image_url = null;

      if (!type_name) {
        throw new Error("Tên loại sản phẩm là bắt buộc");
      }

      if (file) {
        image_url = await StorageHelper.uploadImage(
          file,
          "product_types",
          type_name
        );
      }

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
        if (image_url) {
          await StorageHelper.deleteImage(image_url, "product_types");
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

  static async updateProductType(id, typeData, file) {
    try {
      const { type_name, description, parent_id, is_active } = typeData;
      let image_url = typeData.image_url;

      if (!id || isNaN(id)) {
        throw new Error("ID loại sản phẩm không hợp lệ");
      }

      const { data: existingType, error: fetchError } = await supabase
        .from("product_types")
        .select("image_url")
        .eq("id", id)
        .single();

      if (fetchError || !existingType) {
        throw new Error("Loại sản phẩm không tồn tại");
      }

      if (file) {
        const newImageUrl = await StorageHelper.uploadImage(
          file,
          "product_types",
          type_name || "type"
        );

        await StorageHelper.deleteImage(
          existingType.image_url,
          "product_types"
        );
        image_url = newImageUrl;
      }

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
        if (file && image_url) {
          await StorageHelper.deleteImage(image_url, "product_types");
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

  static async deleteProductType(id) {
    try {
      if (!id || isNaN(id)) {
        throw new Error("ID loại sản phẩm không hợp lệ");
      }

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

      const { data: type, error: fetchError } = await supabase
        .from("product_types")
        .select("image_url")
        .eq("id", id)
        .single();

      if (fetchError || !type) {
        throw new Error("Loại sản phẩm không tồn tại");
      }

      const { error } = await supabase
        .from("product_types")
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error(`Lỗi khi xóa loại sản phẩm: ${error.message}`);
      }

      if (type.image_url) {
        StorageHelper.deleteImage(type.image_url, "product_types").catch(
          (err) =>
            console.warn(
              `Cảnh báo: Không thể xóa ảnh loại sản phẩm: ${err.message}`
            )
        );
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
