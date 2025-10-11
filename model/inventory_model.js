const supabase = require("../supabaseClient");
const { v4: uuidv4 } = require("uuid");

class InventoryModel {
  static SELECT_FIELDS =
    "id, product_id, variant_id, branch_id, quantity, reserved_quantity, min_stock_level, max_stock_level, updated_at, products(name), branches(name), product_variants(color)";

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
        ip_address: null,
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

  static async getAllInventory(limit = 10, offset = 0, filters = {}) {
    try {
      let query = supabase
        .from("inventory")
        .select(this.SELECT_FIELDS)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

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

      if (existingInventory) {
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

        await this.logInventoryChange(
          "inventory",
          existingInventory.id,
          "UPDATE",
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

        await this.logInventoryChange(
          "inventory",
          result.id,
          "INSERT",
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

      if (newQuantity < inventory.min_stock_level) {
        console.warn(
          `⚠️ Số lượng tồn kho (${newQuantity}) thấp hơn mức tối thiểu (${inventory.min_stock_level})`
        );
      }

      // [SỬA LỖI] Sử dụng RPC chuyên dụng để đảm bảo tính toàn vẹn dữ liệu
      const { data, error } = await supabase.rpc(
        "decrease_inventory_and_return",
        {
          p_inventory_id: inventory.id,
          p_quantity_to_decrease: quantity,
        }
      );

      if (error) {
        console.error("❌ Model - Lỗi khi giảm tồn kho:", error.message);
        throw new Error("Không thể giảm tồn kho");
      }

      await this.logInventoryChange(
        "inventory",
        inventory.id,
        "UPDATE",
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

      // RPC trả về một mảng, ta lấy phần tử đầu tiên
      return data[0];
    } catch (error) {
      console.error("❌ Model - Lỗi khi giảm tồn kho:", error.message);
      throw error;
    }
  }

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
        const newQuantity = inventory.quantity + quantity;

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

        await this.logInventoryChange(
          "inventory",
          inventory.id,
          "UPDATE",
          { quantity: inventory.quantity },
          { quantity: newQuantity },
          userId
        );
      } else {
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

        await this.logInventoryChange(
          "inventory",
          result.id,
          "INSERT",
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

      if (newQuantity > inventory.max_stock_level) {
        throw new Error(
          `Số lượng tồn kho (${newQuantity}) vượt quá mức tối đa (${inventory.max_stock_level})`
        );
      }

      // [SỬA LỖI] Sử dụng RPC chuyên dụng để đảm bảo tính toàn vẹn dữ liệu
      const { data, error } = await supabase.rpc(
        "cancel_order_inventory_and_return",
        {
          p_inventory_id: inventory.id,
          p_quantity_to_increase: quantity,
        }
      );

      if (error) {
        console.error("❌ Model - Lỗi khi hoàn tồn kho:", error.message);
        throw new Error("Không thể hoàn tồn kho");
      }

      await this.logInventoryChange(
        "inventory",
        inventory.id,
        "UPDATE",
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

      // RPC trả về một mảng, ta lấy phần tử đầu tiên
      return data[0];
    } catch (error) {
      console.error("❌ Model - Lỗi khi hoàn tồn kho:", error.message);
      throw error;
    }
  }

  static async deleteInventory(id, userId = null) {
    try {
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

      await this.logInventoryChange(
        "inventory",
        inventory.id,
        "UPDATE",
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

  // THÊM MỚI: Lấy thống kê tồn kho
  static async getInventoryStats(branchId = null) {
    try {
      let query = supabase.rpc("get_inventory_stats", {
        p_branch_id: branchId,
      });

      const { data, error } = await query;

      if (error) {
        console.error(
          "❌ Model - Lỗi khi gọi RPC get_inventory_stats:",
          error.message
        );
        throw new Error("Không thể lấy thống kê tồn kho");
      }

      // RPC trả về một mảng với một đối tượng duy nhất
      const stats = data[0] || {
        total_items: 0,
        total_quantity: 0,
        low_stock_items: 0,
        out_of_stock_items: 0,
      };

      // Chuyển đổi các giá trị BigInt/String thành Number nếu cần
      return {
        total_items: Number(stats.total_items),
        total_quantity: Number(stats.total_quantity),
        low_stock_items: Number(stats.low_stock_items),
        out_of_stock_items: Number(stats.out_of_stock_items),
      };
    } catch (err) {
      console.error("❌ Model - Lỗi khi lấy thống kê tồn kho:", err.message);
      throw err;
    }
  }

  // THÊM MỚI: Kiểm tra tồn kho cho toàn bộ đơn hàng tại một chi nhánh
  static async checkStockForOrder(branchId, orderItems) {
    console.log(
      `\n--- 🔍 Bắt đầu kiểm tra tồn kho cho đơn hàng tại Chi nhánh ID: ${branchId} ---`
    );
    if (!orderItems || orderItems.length === 0) return true; // Không có sản phẩm, coi như đủ hàng

    try {
      // Tạo một mảng các promise để kiểm tra tồn kho song song
      const stockChecks = orderItems.map((item) => {
        return supabase
          .from("inventory")
          .select("quantity")
          .eq("branch_id", branchId)
          .eq("product_id", item.products?.id) // Cần product_id từ item
          .eq("variant_id", item.variant_id || null)
          .single();
      });

      const results = await Promise.all(stockChecks);

      // Kiểm tra kết quả
      for (let i = 0; i < results.length; i++) {
        const { data: inventory, error } = results[i];
        const item = orderItems[i];
        // Nếu không có bản ghi tồn kho hoặc số lượng không đủ
        const requiredQty = item.quantity;
        const availableQty = inventory?.quantity ?? 0;

        console.log(
          `  - Item: [P_ID: ${item.products?.id}, V_ID: ${
            item.variant_id || "N/A"
          }], Cần: ${requiredQty}, Có sẵn: ${availableQty}`
        );

        if (error || !inventory || availableQty < requiredQty) {
          console.log(
            `  ❌ KẾT QUẢ: KHÔNG ĐỦ HÀNG cho sản phẩm này. Dừng kiểm tra.`
          );
          return false; // Chi nhánh không đủ hàng
        }
      }

      console.log(`  ✅ KẾT QUẢ: ĐỦ HÀNG cho tất cả sản phẩm.`);
      return true; // Chi nhánh đủ hàng cho tất cả sản phẩm
    } catch (err) {
      console.error(
        `❌ Model - Lỗi khi kiểm tra tồn kho cho đơn hàng tại chi nhánh ${branchId}:`,
        err.message
      );
      return false; // Mặc định là không đủ hàng nếu có lỗi
    }
  }
}

module.exports = InventoryModel;
