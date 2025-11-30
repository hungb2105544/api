const supabase = require("../supabaseClient");
const StorageHelper = require("./storage_helper");

class ProductTypeModel {
  static SELECT_FIELDS =
    "id, type_name, description, parent_id, image_url, is_active, created_at";

  /**
   * Lấy tất cả loại sản phẩm với filter
   */
  static async getAllProductType(filters = {}) {
    try {
      let query = supabase
        .from("product_types")
        .select(this.SELECT_FIELDS)
        .order("created_at", { ascending: false })
        .eq("is_active", true);

      // Áp dụng filters
      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }
      if (filters.parent_id !== undefined) {
        if (filters.parent_id === null) {
          query = query.is("parent_id", null);
        } else {
          query = query.eq("parent_id", filters.parent_id);
        }
      }
      if (filters.search) {
        query = query.ilike("type_name", `%${filters.search}%`);
      }

      const { data, error } = await query;

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
      console.error("❌ Model - getAllProductType:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Lấy chi tiết một loại sản phẩm theo ID
   */
  static async getProductTypeById(id) {
    try {
      if (!id || isNaN(id)) {
        throw new Error("ID loại sản phẩm không hợp lệ");
      }

      const { data, error } = await supabase
        .from("product_types")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Không tìm thấy loại sản phẩm");
        }
        throw new Error(`Lỗi khi lấy loại sản phẩm: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: "Lấy loại sản phẩm thành công",
      };
    } catch (error) {
      console.error("❌ Model - getProductTypeById:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Tạo loại sản phẩm mới
   */
  static async createProductType(typeData, file) {
    try {
      const { type_name, description, parent_id, is_active = true } = typeData;
      let image_url = null;

      if (!type_name) {
        throw new Error("Tên loại sản phẩm là bắt buộc");
      }

      // Validate parent_id nếu có
      if (parent_id) {
        const { data: parentType, error: parentError } = await supabase
          .from("product_types")
          .select("id")
          .eq("id", parent_id)
          .single();

        if (parentError || !parentType) {
          throw new Error("Loại sản phẩm cha không tồn tại");
        }
      }

      // Upload ảnh nếu có
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
          parent_id: parent_id || null,
          image_url,
          is_active,
          created_at: new Date().toISOString(),
        })
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        // Xóa ảnh nếu insert thất bại
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
      console.error("❌ Model - createProductType:", error.message);
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
        .select("image_url, id")
        .eq("id", id)
        .single();

      if (fetchError || !existingType) {
        throw new Error("Loại sản phẩm không tồn tại");
      }

      if (parent_id) {
        if (parseInt(parent_id) === parseInt(id)) {
          throw new Error("Loại sản phẩm không thể là cha của chính nó");
        }

        const { data: parentType, error: parentError } = await supabase
          .from("product_types")
          .select("id")
          .eq("id", parent_id)
          .single();

        if (parentError || !parentType) {
          throw new Error("Loại sản phẩm cha không tồn tại");
        }
      }

      if (file) {
        const newImageUrl = await StorageHelper.uploadImage(
          file,
          "product_types",
          type_name || "type"
        );

        if (existingType.image_url) {
          await StorageHelper.deleteImage(
            existingType.image_url,
            "product_types"
          );
        }
        image_url = newImageUrl;
      }

      const updateData = {
        type_name: type_name || undefined,
        description: description !== undefined ? description : undefined,
        parent_id: parent_id !== undefined ? parent_id : undefined,
        image_url: image_url || undefined,
        is_active: is_active !== undefined ? is_active : undefined,
        updated_at: new Date().toISOString(),
      };

      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key]
      );

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
      console.error("❌ Model - updateProductType:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async deleteProductType(id, hardDelete = false) {
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

      if (hardDelete) {
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
      } else {
        const { error } = await supabase
          .from("product_types")
          .update({ is_active: false })
          .eq("id", id);

        if (error) {
          throw new Error(
            `Lỗi khi vô hiệu hóa loại sản phẩm: ${error.message}`
          );
        }
      }

      return {
        success: true,
        message: hardDelete
          ? "Xóa loại sản phẩm thành công"
          : "Vô hiệu hóa loại sản phẩm thành công",
      };
    } catch (error) {
      console.error("❌ Model - deleteProductType:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async getChildTypes(parentId) {
    try {
      if (!parentId || isNaN(parentId)) {
        throw new Error("ID loại sản phẩm cha không hợp lệ");
      }

      const { data, error } = await supabase
        .from("product_types")
        .select(this.SELECT_FIELDS)
        .eq("parent_id", parentId)
        .order("type_name", { ascending: true });

      if (error) {
        throw new Error(`Lỗi khi lấy loại sản phẩm con: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: "Lấy loại sản phẩm con thành công",
      };
    } catch (error) {
      console.error("❌ Model - getChildTypes:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = ProductTypeModel;
