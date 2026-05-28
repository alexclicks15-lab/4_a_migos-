import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const PROFILE_ROLES = new Set(["user", "super_admin"]);
const COMPANY_ROLES = new Set(["owner", "admin", "manager", "sales_agent", "support_agent", "viewer"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function supabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || currentProfile?.role !== "super_admin") {
    return Response.json({ error: "Super admin access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = normalizeText(body.email).toLowerCase();
  const fullName = normalizeText(body.fullName);
  const password = normalizeText(body.password);
  const profileRole = normalizeText(body.profileRole) || "user";
  const companyId = normalizeText(body.companyId);
  const companyRole = normalizeText(body.companyRole) || "sales_agent";

  if (!email || !email.includes("@")) {
    return Response.json({ error: "A valid email address is required" }, { status: 400 });
  }

  if (!fullName) {
    return Response.json({ error: "Full name is required" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "Temporary password must be at least 6 characters" }, { status: 400 });
  }

  if (!PROFILE_ROLES.has(profileRole)) {
    return Response.json({ error: "Invalid platform role" }, { status: 400 });
  }

  if (companyId && !COMPANY_ROLES.has(companyRole)) {
    return Response.json({ error: "Invalid company role" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: authData, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (createUserError || !authData.user) {
    const message = createUserError?.message || "Failed to create auth user";
    const status = message.toLowerCase().includes("already") ? 409 : 400;
    return Response.json({ error: message }, { status });
  }

  const userId = authData.user.id;

  const { data: profile, error: upsertProfileError } = await admin
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        full_name: fullName,
        email,
        role: profileRole,
      },
      { onConflict: "user_id" }
    )
    .select("id, user_id, full_name, email, role")
    .single();

  if (upsertProfileError || !profile) {
    await admin.auth.admin.deleteUser(userId);
    const message = upsertProfileError?.message || "Failed to create profile";
    if (message.includes('profile_id') && message.includes('ambiguous')) {
      return Response.json(
        {
          error:
            "Database trigger handle_user_default_company has an ambiguous profile_id reference. Apply migration 022_fix_profile_id_ambiguous_default_company.sql, then try again.",
        },
        { status: 500 }
      );
    }

    return Response.json(
      { error: message },
      { status: 400 }
    );
  }

  if (companyId) {
    const { error: companyUserError } = await admin.from("company_users").insert({
      company_id: companyId,
      profile_id: profile.id,
      role: companyRole,
      status: "active",
    });

    if (companyUserError) {
      await admin.from("profiles").delete().eq("id", profile.id);
      await admin.auth.admin.deleteUser(userId);

      const message =
        companyUserError.code === "23505"
          ? "This profile is already assigned to that company"
          : companyUserError.message;
      return Response.json({ error: message }, { status: 400 });
    }
  }

  return Response.json({ profile }, { status: 201 });
}
