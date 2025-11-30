const supabase = require("../supabaseClient");

class BrandTypeModel {
  static SELECT_FIELDS =
    "id, brand_id, type_id, brands(id, brand_name, image_url), product_types(id, type_name, image_url)";

  static async getAllBrandType(filters = {}) {
    try {
      let query = supabase
        .from("brand_types")
        .select(this.SELECT_FIELDS)
        .order("id", { ascending: true });

      if (filters.brand_id) {
        query = query.eq("brand_id", filters.brand_id);
      }
      if (filters.type_id) {
        query = query.eq("type_id", filters.type_id);
      }

      const { data, error } = await query;

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
      console.error("❌ Model - getAllBrandType:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  static async getBrandTypeById(id) {
    try {
      if (!id || isNaN(id)) {
        throw new Error("ID quan hệ không hợp lệ");
      }

      const { data, error } = await supabase
        .from("brand_types")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Không tìm thấy quan hệ thương hiệu-loại sản phẩm");
        }
        throw new Error(
          `Lỗi khi lấy quan hệ thương hiệu-loại sản phẩm: ${error.message}`
        );
      }

      return {
        success: true,
        data,
        message: "Lấy quan hệ thương hiệu-loại sản phẩm thành công",
      };
    } catch (error) {
      console.error("❌ Model - getBrandTypeById:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Lấy danh sách loại sản phẩm theo brand_id
   */
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
      console.error("❌ Model - getTypeByBrandId:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Lấy danh sách thương hiệu theo type_id
   */
  static async getBrandByTypeId(typeId) {
    try {
      if (!typeId || isNaN(typeId)) {
        throw new Error("ID loại sản phẩm không hợp lệ");
      }

      const { data, error } = await supabase
        .from("brand_types")
        .select(this.SELECT_FIELDS)
        .eq("type_id", typeId)
        .order("id", { ascending: true });

      if (error) {
        throw new Error(`Lỗi khi lấy danh sách thương hiệu: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: "Lấy danh sách thương hiệu theo loại sản phẩm thành công",
      };
    } catch (error) {
      console.error("❌ Model - getBrandByTypeId:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Tạo mới quan hệ brand-type
   */
  static async createBrandType(brandTypeData) {
    try {
      const { brand_id, type_id } = brandTypeData;

      if (!brand_id || !type_id) {
        throw new Error("ID thương hiệu và ID loại sản phẩm là bắt buộc");
      }

      // Xác thực brand tồn tại
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("id", brand_id)
        .single();

      if (brandError || !brand) {
        throw new Error("Thương hiệu không tồn tại");
      }

      // Xác thực type tồn tại
      const { data: productType, error: typeError } = await supabase
        .from("product_types")
        .select("id")
        .eq("id", type_id)
        .single();

      if (typeError || !productType) {
        throw new Error("Loại sản phẩm không tồn tại");
      }

      // Kiểm tra quan hệ đã tồn tại chưa
      const { data: existingRelation, error: relationError } = await supabase
        .from("brand_types")
        .select("id")
        .eq("brand_id", brand_id)
        .eq("type_id", type_id)
        .maybeSingle();

      if (relationError && relationError.code !== "PGRST116") {
        throw new Error(`Lỗi khi kiểm tra quan hệ: ${relationError.message}`);
      }

      if (existingRelation) {
        throw new Error("Quan hệ giữa thương hiệu và loại sản phẩm đã tồn tại");
      }

      // Tạo quan hệ mới
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
      console.error("❌ Model - createBrandType:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Cập nhật quan hệ brand-type
   */
  static async updateBrandType(id, updateData) {
    try {
      const { brand_id, type_id } = updateData;

      if (!id || isNaN(id)) {
        throw new Error("ID quan hệ không hợp lệ");
      }

      if (!brand_id && !type_id) {
        throw new Error("Cần ít nhất brand_id hoặc type_id để cập nhật");
      }

      // Kiểm tra quan hệ tồn tại
      const { data: existingRelation, error: fetchError } = await supabase
        .from("brand_types")
        .select("id, brand_id, type_id")
        .eq("id", id)
        .single();

      if (fetchError || !existingRelation) {
        throw new Error("Không tìm thấy quan hệ để cập nhật");
      }

      const newBrandId = brand_id || existingRelation.brand_id;
      const newTypeId = type_id || existingRelation.type_id;

      // Xác thực brand nếu có thay đổi
      if (brand_id && brand_id !== existingRelation.brand_id) {
        const { data: brand, error: brandError } = await supabase
          .from("brands")
          .select("id")
          .eq("id", brand_id)
          .single();

        if (brandError || !brand) {
          throw new Error("Thương hiệu không tồn tại");
        }
      }

      // Xác thực type nếu có thay đổi
      if (type_id && type_id !== existingRelation.type_id) {
        const { data: productType, error: typeError } = await supabase
          .from("product_types")
          .select("id")
          .eq("id", type_id)
          .single();

        if (typeError || !productType) {
          throw new Error("Loại sản phẩm không tồn tại");
        }
      }

      // Kiểm tra quan hệ mới có bị trùng không
      if (brand_id || type_id) {
        const { data: duplicateCheck, error: dupError } = await supabase
          .from("brand_types")
          .select("id")
          .eq("brand_id", newBrandId)
          .eq("type_id", newTypeId)
          .neq("id", id)
          .maybeSingle();

        if (dupError && dupError.code !== "PGRST116") {
          throw new Error(`Lỗi khi kiểm tra trùng lặp: ${dupError.message}`);
        }

        if (duplicateCheck) {
          throw new Error("Quan hệ mới bị trùng với quan hệ đã tồn tại");
        }
      }

      // Cập nhật
      const { data, error } = await supabase
        .from("brand_types")
        .update({
          brand_id: newBrandId,
          type_id: newTypeId,
        })
        .eq("id", id)
        .select(this.SELECT_FIELDS)
        .single();

      if (error) {
        throw new Error(
          `Lỗi khi cập nhật quan hệ thương hiệu-loại sản phẩm: ${error.message}`
        );
      }

      return {
        success: true,
        data,
        message: "Cập nhật quan hệ thương hiệu-loại sản phẩm thành công",
      };
    } catch (error) {
      console.error("❌ Model - updateBrandType:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Xóa quan hệ brand-type
   */
  static async deleteBrandType(id) {
    try {
      if (!id || isNaN(id)) {
        throw new Error("ID quan hệ thương hiệu-loại sản phẩm không hợp lệ");
      }

      // Lấy thông tin quan hệ
      const { data: relation, error: fetchError } = await supabase
        .from("brand_types")
        .select("brand_id, type_id")
        .eq("id", id)
        .single();

      if (fetchError || !relation) {
        throw new Error("Không tìm thấy quan hệ để xóa");
      }

      // Kiểm tra sản phẩm liên quan
      const { data: relatedProducts, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("brand_id", relation.brand_id)
        .eq("type_id", relation.type_id)
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

      // Xóa quan hệ
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
      console.error("❌ Model - deleteBrandType:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Tạo nhiều quan hệ cùng lúc (bulk create)
   */
  static async bulkCreateBrandTypes(relations) {
    try {
      if (!relations || !Array.isArray(relations) || relations.length === 0) {
        throw new Error("Danh sách quan hệ không hợp lệ");
      }

      // Validate tất cả relations
      for (const rel of relations) {
        if (!rel.brand_id || !rel.type_id) {
          throw new Error("Mỗi quan hệ phải có brand_id và type_id");
        }
      }

      // Lấy tất cả brand_ids và type_ids duy nhất
      const brandIds = [...new Set(relations.map((r) => r.brand_id))];
      const typeIds = [...new Set(relations.map((r) => r.type_id))];

      // Xác thực tất cả brands tồn tại
      const { data: brands, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .in("id", brandIds);

      if (brandError || !brands || brands.length !== brandIds.length) {
        throw new Error("Một hoặc nhiều thương hiệu không tồn tại");
      }

      // Xác thực tất cả types tồn tại
      const { data: types, error: typeError } = await supabase
        .from("product_types")
        .select("id")
        .in("id", typeIds);

      if (typeError || !types || types.length !== typeIds.length) {
        throw new Error("Một hoặc nhiều loại sản phẩm không tồn tại");
      }

      // Kiểm tra các quan hệ đã tồn tại
      const { data: existingRelations, error: existError } = await supabase
        .from("brand_types")
        .select("brand_id, type_id")
        .in("brand_id", brandIds)
        .in("type_id", typeIds);

      if (existError) {
        throw new Error(
          `Lỗi khi kiểm tra quan hệ đã tồn tại: ${existError.message}`
        );
      }

      // Lọc ra các quan hệ chưa tồn tại
      const existingSet = new Set(
        existingRelations.map((r) => `${r.brand_id}-${r.type_id}`)
      );
      const newRelations = relations.filter(
        (r) => !existingSet.has(`${r.brand_id}-${r.type_id}`)
      );

      if (newRelations.length === 0) {
        throw new Error("Tất cả các quan hệ đã tồn tại");
      }

      // Tạo các quan hệ mới
      const { data, error } = await supabase
        .from("brand_types")
        .insert(newRelations)
        .select(this.SELECT_FIELDS);

      if (error) {
        throw new Error(`Lỗi khi tạo bulk quan hệ: ${error.message}`);
      }

      return {
        success: true,
        data,
        message: `Tạo thành công ${data.length} quan hệ (bỏ qua ${
          relations.length - newRelations.length
        } quan hệ đã tồn tại)`,
      };
    } catch (error) {
      console.error("❌ Model - bulkCreateBrandTypes:", error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = BrandTypeModel;
