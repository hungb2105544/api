const supabase = require("../supabaseClient");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class StorageHelper {
  static _sanitize(input) {
    if (!input) return "";
    // Thay thế khoảng trắng và các ký tự không an toàn bằng gạch ngang
    // Loại bỏ các ký tự tiếng Việt có dấu
    return input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");
  }

  static async uploadImage(file, bucketName, entityName) {
    if (!file || !file.buffer || !file.mimetype) {
      throw new Error("File không hợp lệ để upload.");
    }
    const sanitizedName = this._sanitize(path.parse(file.originalname).name);
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}-${sanitizedName || "file"}${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Lỗi khi upload ảnh lên bucket '${bucketName}': ${uploadError.message}`
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  }

  static async uploadFiles(files, bucketName, folder = "") {
    if (!files || !Array.isArray(files) || files.length === 0) {
      return [];
    }

    const uploadPromises = files.map((file) => {
      if (!file || !file.buffer) return Promise.resolve(null);

      const sanitizedName = this._sanitize(file.originalname);
      const fileName = `${
        folder ? `${folder}/` : ""
      }${uuidv4()}-${sanitizedName}`;

      return supabase.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        })
        .then(({ error }) => {
          if (error) {
            console.error(
              `❌ Lỗi khi upload file '${fileName}':`,
              error.message
            );
            return null;
          }
          return (
            supabase.storage.from(bucketName).getPublicUrl(fileName).data
              ?.publicUrl || null
          );
        });
    });

    const results = await Promise.all(uploadPromises);
    return results.filter(Boolean);
  }

  static async deleteImage(imageUrl, bucketName) {
    if (!imageUrl) return;
    // Tách đường dẫn file từ URL công khai
    const filePath = imageUrl.substring(
      imageUrl.indexOf(bucketName) + bucketName.length + 1
    );
    if (!filePath) return;

    await supabase.storage.from(bucketName).remove([filePath]);
  }

  static async deleteFiles(imageUrls, bucketName) {
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return;
    }
    const filePaths = imageUrls
      .map((url) => {
        if (!url) return null;
        const pathSegment = url.substring(
          url.indexOf(bucketName) + bucketName.length + 1
        );
        return pathSegment || null;
      })
      .filter(Boolean);

    if (filePaths.length > 0) {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .remove(filePaths);

      if (error) {
        console.error(
          `❌ Lỗi khi xóa các file trong bucket '${bucketName}':`,
          error.message
        );
      }
    }
  }
}

module.exports = StorageHelper;
