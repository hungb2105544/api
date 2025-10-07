require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function createAdminUser() {
  try {
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: "admin1@gmail.com",
        password: "Hung@1234",
        email_confirm: true,
      });
    if (authError) throw authError;

    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        full_name: "Admin User",
        role: "admin",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        registration_source: "admin_creation",
      });
    if (profileError) throw profileError;

    console.log("✅ Admin user created:", authData.user.id);
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
  }
}

createAdminUser();
