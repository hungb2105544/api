const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

class InventoryModel {
  static SELECT_FIELDS =
    "id, product_id, variant_id, branch_id, quantity, reserved_quantity, min_stock_level, max_stock_level, updated_at, products(name), branches(name), product_variants(color)";

  // Hàm ghi log vào bảng audit_logs
  static async logInventoryChange(
    tableName,
    recordId,
    action,
    oldValues,
    newValues,
    userId = null
  ) {
    try {
      const { error } = await supabase.from("audit_logs").insert({
        table_name: tableName,
        record_id: recordId,
        action,
        old_values: oldValues,
        new_values: newValues,
        user_id: userId,
        ip_address: null, // Có thể thêm từ request nếu có
        user_agent: null,
        created_at: new Date().toISOString(),
      });
      if (error) {
        console.error("❌ Model - Lỗi khi ghi audit log:", error.message);
      }
    } catch (error) {
      console.error(
        "❌ Model - Lỗi không mong muốn khi ghi audit log:",
        error.message
      );
    }
  }

  // Lấy danh sách tồn kho với phân trang và bộ lọc
  static async getAllInventory(limit = 10, offset = 0, filters = {}) {
    try {
      let query = supabase
        .from("inventory")
        .select(this.SELECT_FIELDS)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Áp dụng bộ lọc
      if (filters.branch_id) {
        query = query.eq("branch_id", filters.branch_id);
      }
      if (filters.product_id) {
        query = query.eq("product_id", filters.product_id);
      }
      if (filters.variant_id) {
        query = query.eq("variant_id", filters.variant_id);
      }
      if (filters.has_stock) {
        query = query.gt("quantity", 0);
      }
      if (filters.low_stock) {
        query = query.lte("quantity", supabase.raw("min_stock_level"));
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          "❌ Model - Lỗi Supabase khi lấy danh sách tồn kho:",
          error.message
        );
        throw new Error("Không thể lấy danh sách tồn kho");
      }

      return data;
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy tồn kho:", err.message);
      throw err;
    }
  }

  // Lấy chi tiết tồn kho theo ID
  static async getInventoryById(id) {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select(this.SELECT_FIELDS)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Không tìm thấy bản ghi tồn kho");
        }
        console.error("❌ Model - Lỗi Supabase:", error.message);
        throw new Error("Lỗi khi lấy tồn kho");
      }

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi lấy tồn kho:", error.message);
      throw error;
    }
  }

  // Thêm hoặc cập nhật tồn kho
  static async upsertInventory(inventoryData, userId = null) {
    if (
      !inventoryData.branch_id ||
      !inventoryData.product_id ||
      !inventoryData.quantity
    ) {
      throw new Error("Chi nhánh, sản phẩm và số lượng là bắt buộc");
    }
    if (
      inventoryData.quantity < 0 ||
      (inventoryData.reserved_quantity && inventoryData.reserved_quantity < 0)
    ) {
      throw new Error("Số lượng và số lượng giữ chỗ phải lớn hơn hoặc bằng 0");
    }

    try {
      // Xác thực khóa ngoại
      const { data: branch, error: branchError } = await supabase
        .from("branches")
        .select("id")
        .eq("id", inventoryData.branch_id)
        .eq("is_active", true)
        .single();
      if (branchError || !branch) {
        throw new Error("Chi nhánh không tồn tại hoặc không hoạt động");
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", inventoryData.product_id)
        .eq("is_active", true)
        .single();
      if (productError || !product) {
        throw new Error("Sản phẩm không tồn tại hoặc không hoạt động");
      }

      if (inventoryData.variant_id) {
        const { data: variant, error: variantError } = await supabase
          .from("product_variants")
          .select("id")
          .eq("id", inventoryData.variant_id)
          .eq("is_active", true)
          .single();
        if (variantError || !variant) {
          throw new Error(
            "Biến thể sản phẩm không tồn tại hoặc không hoạt động"
          );
        }
      }

      // Kiểm tra bản ghi tồn kho hiện tại
      const { data: existingInventory, error: checkError } = await supabase
        .from("inventory")
        .select(
          "id, quantity, reserved_quantity, min_stock_level, max_stock_level"
        )
        .eq("branch_id", inventoryData.branch_id)
        .eq("product_id", inventoryData.product_id)
        .eq("variant_id", inventoryData.variant_id || null)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        console.error(
          "❌ Model - Lỗi khi kiểm tra tồn kho:",
          checkError.message
        );
        throw new Error("Lỗi khi kiểm tra tồn kho");
      }

      let result;
      const newQuantity =
        inventoryData.quantity ?? existingInventory?.quantity ?? 0;
      const newReservedQuantity =
        inventoryData.reserved_quantity ??
        existingInventory?.reserved_quantity ??
        0;
      const newMinStockLevel =
        inventoryData.min_stock_level ??
        existingInventory?.min_stock_level ??
        5;
      const newMaxStockLevel =
        inventoryData.max_stock_level ??
        existingInventory?.max_stock_level ??
        1000;

      // Kiểm tra min_stock_level và max_stock_level
      if (newQuantity < newMinStockLevel) {
        console.warn(
          `⚠️ Số lượng tồn kho (${newQuantity}) thấp hơn mức tối thiểu (${newMinStockLevel})`
        );
      }
      if (newQuantity > newMaxStockLevel) {
        throw new Error(
          `Số lượng tồn kho (${newQuantity}) vượt quá mức tối đa (${newMaxStockLevel})`
        );
      }

      // Sử dụng giao dịch để đảm bảo tính toàn vẹn
      if (existingInventory) {
        // Cập nhật bản ghi tồn tại
        const { data, error } = await supabase
          .rpc("execute_transaction", {
            query: `
              BEGIN;
              UPDATE inventory 
              SET 
                quantity = ${newQuantity},
                reserved_quantity = ${newReservedQuantity},
                min_stock_level = ${newMinStockLevel},
                max_stock_level = ${newMaxStockLevel},
                updated_at = NOW()
              WHERE id = ${existingInventory.id};
              COMMIT;
            `,
          })
          .then(async () => {
            return supabase
              .from("inventory")
              .select(this.SELECT_FIELDS)
              .eq("id", existingInventory.id)
              .single();
          });

        if (error) {
          console.error("❌ Model - Lỗi khi cập nhật tồn kho:", error.message);
          throw new Error("Không thể cập nhật tồn kho");
        }
        result = data;

        // Ghi log
        await this.logInventoryChange(
          "inventory",
          existingInventory.id,
          "update",
          {
            quantity: existingInventory.quantity,
            reserved_quantity: existingInventory.reserved_quantity,
            min_stock_level: existingInventory.min_stock_level,
            max_stock_level: existingInventory.max_stock_level,
          },
          {
            quantity: newQuantity,
            reserved_quantity: newReservedQuantity,
            min_stock_level: newMinStockLevel,
            max_stock_level: newMaxStockLevel,
          },
          userId
        );
      } else {
        // Thêm bản ghi mới
        const { data, error } = await supabase
          .rpc("execute_transaction", {
            query: `
              BEGIN;
              INSERT INTO inventory (
                branch_id, product_id, variant_id, quantity, reserved_quantity,
                min_stock_level, max_stock_level, updated_at
              ) VALUES (
                ${inventoryData.branch_id},
                ${inventoryData.product_id},
                ${inventoryData.variant_id || null},
                ${newQuantity},
                ${newReservedQuantity},
                ${newMinStockLevel},
                ${newMaxStockLevel},
                NOW()
              ) RETURNING *;
              COMMIT;
            `,
          })
          .then(async () => {
            return supabase
              .from("inventory")
              .select(this.SELECT_FIELDS)
              .eq("branch_id", inventoryData.branch_id)
              .eq("product_id", inventoryData.product_id)
              .eq("variant_id", inventoryData.variant_id || null)
              .single();
          });

        if (error) {
          console.error("❌ Model - Lỗi khi thêm tồn kho:", error.message);
          throw new Error("Không thể thêm tồn kho");
        }
        result = data;

        // Ghi log
        await this.logInventoryChange(
          "inventory",
          result.id,
          "insert",
          null,
          {
            branch_id: inventoryData.branch_id,
            product_id: inventoryData.product_id,
            variant_id: inventoryData.variant_id,
            quantity: newQuantity,
            reserved_quantity: newReservedQuantity,
            min_stock_level: newMinStockLevel,
            max_stock_level: newMaxStockLevel,
          },
          userId
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Model - Lỗi khi thêm/cập nhật tồn kho:", error.message);
      throw error;
    }
  }

  // Giảm số lượng tồn kho (khi đặt hàng)
  static async decreaseInventory(
    branchId,
    productId,
    variantId = null,
    quantity,
    userId = null
  ) {
    if (!branchId || !productId || !quantity || quantity <= 0) {
      throw new Error("Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc");
    }

    try {
      // Xác thực khóa ngoại
      const { data: branch, error: branchError } = await supabase
        .from("branches")
        .select("id")
        .eq("id", branchId)
        .eq("is_active", true)
        .single();
      if (branchError || !branch) {
        throw new Error("Chi nhánh không tồn tại hoặc không hoạt động");
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .eq("is_active", true)
        .single();
      if (productError || !product) {
        throw new Error("Sản phẩm không tồn tại hoặc không hoạt động");
      }

      if (variantId) {
        const { data: variant, error: variantError } = await supabase
          .from("product_variants")
          .select("id")
          .eq("id", variantId)
          .eq("is_active", true)
          .single();
        if (variantError || !variant) {
          throw new Error(
            "Biến thể sản phẩm không tồn tại hoặc không hoạt động"
          );
        }
      }

      // Kiểm tra bản ghi tồn kho
      const { data: inventory, error: fetchError } = await supabase
        .from("inventory")
        .select(
          "id, quantity, reserved_quantity, min_stock_level, max_stock_level"
        )
        .eq("branch_id", branchId)
        .eq("product_id", productId)
        .eq("variant_id", variantId || null)
        .single();

      if (fetchError || !inventory) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy bản ghi tồn kho");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra tồn kho:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra tồn kho");
      }

      if (inventory.quantity < quantity) {
        throw new Error("Số lượng tồn kho không đủ");
      }

      const newQuantity = inventory.quantity - quantity;
      const newReservedQuantity = inventory.reserved_quantity + quantity;

      // Kiểm tra min_stock_level
      if (newQuantity < inventory.min_stock_level) {
        console.warn(
          `⚠️ Số lượng tồn kho (${newQuantity}) thấp hơn mức tối thiểu (${inventory.min_stock_level})`
        );
      }

      // Sử dụng giao dịch
      const { data, error } = await supabase
        .rpc("execute_transaction", {
          query: `
            BEGIN;
            UPDATE inventory 
            SET 
              quantity = ${newQuantity},
              reserved_quantity = ${newReservedQuantity},
              updated_at = NOW()
            WHERE id = ${inventory.id};
            COMMIT;
          `,
        })
        .then(async () => {
          return supabase
            .from("inventory")
            .select(this.SELECT_FIELDS)
            .eq("id", inventory.id)
            .single();
        });

      if (error) {
        console.error("❌ Model - Lỗi khi giảm tồn kho:", error.message);
        throw new Error("Không thể giảm tồn kho");
      }

      // Ghi log
      await this.logInventoryChange(
        "inventory",
        inventory.id,
        "decrease",
        {
          quantity: inventory.quantity,
          reserved_quantity: inventory.reserved_quantity,
        },
        {
          quantity: newQuantity,
          reserved_quantity: newReservedQuantity,
        },
        userId
      );

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi giảm tồn kho:", error.message);
      throw error;
    }
  }

  // Tăng số lượng tồn kho (khi nhập hàng)
  static async increaseInventory(
    branchId,
    productId,
    variantId = null,
    quantity,
    userId = null
  ) {
    if (!branchId || !productId || !quantity || quantity <= 0) {
      throw new Error("Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc");
    }

    try {
      // Xác thực khóa ngoại
      const { data: branch, error: branchError } = await supabase
        .from("branches")
        .select("id")
        .eq("id", branchId)
        .eq("is_active", true)
        .single();
      if (branchError || !branch) {
        throw new Error("Chi nhánh không tồn tại hoặc không hoạt động");
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .eq("is_active", true)
        .single();
      if (productError || !product) {
        throw new Error("Sản phẩm không tồn tại hoặc không hoạt động");
      }

      if (variantId) {
        const { data: variant, error: variantError } = await supabase
          .from("product_variants")
          .select("id")
          .eq("id", variantId)
          .eq("is_active", true)
          .single();
        if (variantError || !variant) {
          throw new Error(
            "Biến thể sản phẩm không tồn tại hoặc không hoạt động"
          );
        }
      }

      // Kiểm tra bản ghi tồn kho
      const { data: inventory, error: fetchError } = await supabase
        .from("inventory")
        .select(
          "id, quantity, reserved_quantity, min_stock_level, max_stock_level"
        )
        .eq("branch_id", branchId)
        .eq("product_id", productId)
        .eq("variant_id", variantId || null)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error(
          "❌ Model - Lỗi khi kiểm tra tồn kho:",
          fetchError.message
        );
        throw new Error("Lỗi khi kiểm tra tồn kho");
      }

      let result;
      if (inventory) {
        // Cập nhật bản ghi tồn tại
        const newQuantity = inventory.quantity + quantity;

        // Kiểm tra max_stock_level
        if (newQuantity > inventory.max_stock_level) {
          throw new Error(
            `Số lượng tồn kho (${newQuantity}) vượt quá mức tối đa (${inventory.max_stock_level})`
          );
        }

        const { data, error } = await supabase
          .rpc("execute_transaction", {
            query: `
              BEGIN;
              UPDATE inventory 
              SET 
                quantity = ${newQuantity},
                updated_at = NOW()
              WHERE id = ${inventory.id};
              COMMIT;
            `,
          })
          .then(async () => {
            return supabase
              .from("inventory")
              .select(this.SELECT_FIELDS)
              .eq("id", inventory.id)
              .single();
          });

        if (error) {
          console.error("❌ Model - Lỗi khi tăng tồn kho:", error.message);
          throw new Error("Không thể tăng tồn kho");
        }
        result = data;

        // Ghi log
        await this.logInventoryChange(
          "inventory",
          inventory.id,
          "increase",
          { quantity: inventory.quantity },
          { quantity: newQuantity },
          userId
        );
      } else {
        // Thêm bản ghi mới
        const { data, error } = await supabase
          .rpc("execute_transaction", {
            query: `
              BEGIN;
              INSERT INTO inventory (
                branch_id, product_id, variant_id, quantity, reserved_quantity,
                min_stock_level, max_stock_level, updated_at
              ) VALUES (
                ${branchId},
                ${productId},
                ${variantId || null},
                ${quantity},
                0,
                5,
                1000,
                NOW()
              ) RETURNING *;
              COMMIT;
            `,
          })
          .then(async () => {
            return supabase
              .from("inventory")
              .select(this.SELECT_FIELDS)
              .eq("branch_id", branchId)
              .eq("product_id", productId)
              .eq("variant_id", variantId || null)
              .single();
          });

        if (error) {
          console.error("❌ Model - Lỗi khi thêm tồn kho:", error.message);
          throw new Error("Không thể thêm tồn kho");
        }
        result = data;

        // Ghi log
        await this.logInventoryChange(
          "inventory",
          result.id,
          "insert",
          null,
          {
            branch_id: branchId,
            product_id: productId,
            variant_id: variantId,
            quantity,
            reserved_quantity: 0,
            min_stock_level: 5,
            max_stock_level: 1000,
          },
          userId
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Model - Lỗi khi tăng tồn kho:", error.message);
      throw error;
    }
  }

  // Hoàn tồn kho (khi hủy đơn hàng)
  static async cancelOrderInventory(
    branchId,
    productId,
    variantId = null,
    quantity,
    userId = null
  ) {
    if (!branchId || !productId || !quantity || quantity <= 0) {
      throw new Error("Chi nhánh, sản phẩm và số lượng (> 0) là bắt buộc");
    }

    try {
      // Xác thực khóa ngoại
      const { data: branch, error: branchError } = await supabase
        .from("branches")
        .select("id")
        .eq("id", branchId)
        .eq("is_active", true)
        .single();
      if (branchError || !branch) {
        throw new Error("Chi nhánh không tồn tại hoặc không hoạt động");
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .eq("is_active", true)
        .single();
      if (productError || !product) {
        throw new Error("Sản phẩm không tồn tại hoặc không hoạt động");
      }

      if (variantId) {
        const { data: variant, error: variantError } = await supabase
          .from("product_variants")
          .select("id")
          .eq("id", variantId)
          .eq("is_active", true)
          .single();
        if (variantError || !variant) {
          throw new Error(
            "Biến thể sản phẩm không tồn tại hoặc không hoạt động"
          );
        }
      }

      // Kiểm tra bản ghi tồn kho
      const { data: inventory, error: fetchError } = await supabase
        .from("inventory")
        .select(
          "id, quantity, reserved_quantity, min_stock_level, max_stock_level"
        )
        .eq("branch_id", branchId)
        .eq("product_id", productId)
        .eq("variant_id", variantId || null)
        .single();

      if (fetchError || !inventory) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy bản ghi tồn kho");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra tồn kho:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra tồn kho");
      }

      if (inventory.reserved_quantity < quantity) {
        throw new Error("Số lượng giữ chỗ không đủ để hoàn");
      }

      const newQuantity = inventory.quantity + quantity;
      const newReservedQuantity = inventory.reserved_quantity - quantity;

      // Kiểm tra max_stock_level
      if (newQuantity > inventory.max_stock_level) {
        throw new Error(
          `Số lượng tồn kho (${newQuantity}) vượt quá mức tối đa (${inventory.max_stock_level})`
        );
      }

      // Sử dụng giao dịch
      const { data, error } = await supabase
        .rpc("execute_transaction", {
          query: `
            BEGIN;
            UPDATE inventory 
            SET 
              quantity = ${newQuantity},
              reserved_quantity = ${newReservedQuantity},
              updated_at = NOW()
            WHERE id = ${inventory.id};
            COMMIT;
          `,
        })
        .then(async () => {
          return supabase
            .from("inventory")
            .select(this.SELECT_FIELDS)
            .eq("id", inventory.id)
            .single();
        });

      if (error) {
        console.error("❌ Model - Lỗi khi hoàn tồn kho:", error.message);
        throw new Error("Không thể hoàn tồn kho");
      }

      // Ghi log
      await this.logInventoryChange(
        "inventory",
        inventory.id,
        "cancel_order",
        {
          quantity: inventory.quantity,
          reserved_quantity: inventory.reserved_quantity,
        },
        {
          quantity: newQuantity,
          reserved_quantity: newReservedQuantity,
        },
        userId
      );

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi hoàn tồn kho:", error.message);
      throw error;
    }
  }

  // Xóa tồn kho (đặt quantity = 0)
  static async deleteInventory(id, userId = null) {
    try {
      // Kiểm tra bản ghi tồn kho
      const { data: inventory, error: fetchError } = await supabase
        .from("inventory")
        .select(
          "id, quantity, reserved_quantity, min_stock_level, max_stock_level"
        )
        .eq("id", id)
        .single();

      if (fetchError || !inventory) {
        if (fetchError && fetchError.code === "PGRST116") {
          throw new Error("Không tìm thấy bản ghi tồn kho");
        }
        console.error(
          "❌ Model - Lỗi khi kiểm tra tồn kho:",
          fetchError?.message
        );
        throw new Error("Lỗi khi kiểm tra tồn kho");
      }

      if (inventory.reserved_quantity > 0) {
        throw new Error("Không thể xóa vì vẫn còn số lượng giữ chỗ");
      }

      // Sử dụng giao dịch
      const { data, error } = await supabase
        .rpc("execute_transaction", {
          query: `
            BEGIN;
            UPDATE inventory 
            SET 
              quantity = 0,
              updated_at = NOW()
            WHERE id = ${inventory.id};
            COMMIT;
          `,
        })
        .then(async () => {
          return supabase
            .from("inventory")
            .select(this.SELECT_FIELDS)
            .eq("id", inventory.id)
            .single();
        });

      if (error) {
        console.error("❌ Model - Lỗi khi xóa tồn kho:", error.message);
        throw new Error("Không thể xóa tồn kho");
      }

      // Ghi log
      await this.logInventoryChange(
        "inventory",
        inventory.id,
        "delete",
        { quantity: inventory.quantity },
        { quantity: 0 },
        userId
      );

      return data;
    } catch (error) {
      console.error("❌ Model - Lỗi khi xóa tồn kho:", error.message);
      throw error;
    }
  }
}

module.exports = InventoryModel;
