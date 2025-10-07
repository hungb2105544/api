const supabase = require("../supabaseClient");

class BrandTypeModel {
  static SELECT_FIELDS =
    "id, brand_id, type_id, brand:brands(brand_name), product_types(type_name)";

  // Lấy danh sách loại sản phẩm theo brand_id
  static async getTypeByBrandId(brandId) {
    try {
      if (!brandId || isNaN(brandId)) {
        throw new Error("ID thương hiệu không hợp lệ");
      }

      const { data, error } = await supabase
        .from("brand_types")
        .select(this.SELECT_FIELDS)
        .eq("brand_id", brandId)
        .order("id", { ascending: true });

      if (error) {
        throw new Error(
          `Lỗi khi lấy danh sách loại sản phẩm: ${error.message}`
        );
      }

      return {
        success: true,
        data,
        message: "Lấy danh sách loại sản phẩm theo thương hiệu thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Lấy tất cả quan hệ thương hiệu-loại sản phẩm
  static async getAllBrandType() {
    try {
      const { data, error } = await supabase
        .from("brand_types")
        .select(this.SELECT_FIELDS)
        .order("id", { ascending: true });

      if (error) {
        throw new Error(
          `Lỗi khi lấy danh sách quan hệ thương hiệu-loại sản phẩm: ${error.message}`
        );
      }

      return {
        success: true,
        data,
        message: "Lấy danh sách quan hệ thương hiệu-loại sản phẩm thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Xóa quan hệ thương hiệu-loại sản phẩm
  static async deleteBrandType(id) {
    try {
      if (!id || isNaN(id)) {
        throw new Error("ID quan hệ thương hiệu-loại sản phẩm không hợp lệ");
      }

      // Kiểm tra xem quan hệ có sản phẩm liên quan không
      const { data: relatedProducts, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq(
          "brand_id",
          (
            await supabase
              .from("brand_types")
              .select("brand_id")
              .eq("id", id)
              .single()
          ).data.brand_id
        )
        .eq(
          "type_id",
          (
            await supabase
              .from("brand_types")
              .select("type_id")
              .eq("id", id)
              .single()
          ).data.type_id
        )
        .limit(1);

      if (productError) {
        throw new Error(
          `Lỗi khi kiểm tra sản phẩm liên quan: ${productError.message}`
        );
      }

      if (relatedProducts && relatedProducts.length > 0) {
        throw new Error(
          "Không thể xóa quan hệ vì có sản phẩm liên quan đến thương hiệu và loại sản phẩm này"
        );
      }

      const { error } = await supabase
        .from("brand_types")
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error(
          `Lỗi khi xóa quan hệ thương hiệu-loại sản phẩm: ${error.message}`
        );
      }

      return {
        success: true,
        message: "Xóa quan hệ thương hiệu-loại sản phẩm thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Tạo mới quan hệ thương hiệu-loại sản phẩm
  static async createBrandType(brandTypeData) {
    try {
      const { brand_id, type_id } = brandTypeData;

      // Kiểm tra dữ liệu đầu vào
      if (!brand_id || !type_id) {
        throw new Error("ID thương hiệu và ID loại sản phẩm là bắt buộc");
      }

      // Kiểm tra xem brand_id và type_id có tồn tại không
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("id", brand_id)
        .single();

      if (brandError || !brand) {
        throw new Error("Thương hiệu không tồn tại");
      }

      const { data: productType, error: typeError } = await supabase
        .from("product_types")
        .select("id")
        .eq("id", type_id)
        .single();

      if (typeError || !productType) {
        throw new Error("Loại sản phẩm không tồn tại");
      }

      // Kiểm tra xem quan hệ đã tồn tại chưa
      const { data: existingRelation, error: relationError } = await supabase
        .from("brand_types")
        .select("id")
        .eq("brand_id", brand_id)
        .eq("type_id", type_id)
        .single();

      if (relationError && relationError.code !== "PGRST116") {
        throw new Error(`Lỗi khi kiểm tra quan hệ: ${relationError.message}`);
      }

      if (existingRelation) {
        throw new Error("Quan hệ giữa thương hiệu và loại sản phẩm đã tồn tại");
      }

      // Tạo bản ghi quan hệ
      const { data, error } = await supabase
        .from("brand_types")
        .insert({
          brand_id,
          type_id,
        })
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        throw new Error(
          `Lỗi khi tạo quan hệ thương hiệu-loại sản phẩm: ${error.message}`
        );
      }

      return {
        success: true,
        data,
        message: "Tạo quan hệ thương hiệu-loại sản phẩm thành công",
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = BrandTypeModel;
