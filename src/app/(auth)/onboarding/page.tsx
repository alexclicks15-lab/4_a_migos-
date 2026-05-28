import { redirect } from "next/navigation";

// Onboarding is no longer used — company creation is handled by
// the Super Admin from the /super-admin dashboard.
export default function OnboardingPage() {
  redirect("/super-admin");
}
