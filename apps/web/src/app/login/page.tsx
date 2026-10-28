import { redirect } from "next/navigation";

// The login form lives on the landing page (PRD AUTH-1, AUTH-2); /login just takes you to it.
export default function LoginPage() {
  redirect("/#login");
}
