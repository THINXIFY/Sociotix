import { Suspense } from "react";
import { getCustomerSession, getStaffSession } from "@/server/auth";
import type { HeaderViewer } from "./header-account";
import { Header as HeaderView } from "./header";

/**
 * The public header, aware of the real session. The page shell (and this header's fallback) stays
 * prerendered; only the account state is read per request, from the session cookies, inside
 * Suspense. Until it streams in, the account area shows a placeholder, never Log In / Sign Up.
 */
type Props = { page?: "home" | "ai" | "other" };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export async function viewerFromSession(): Promise<HeaderViewer> {
  // Same server-side checks as everywhere else; an expired or revoked session reads as signed out.
  const [customer, staff] = await Promise.all([getCustomerSession().catch(() => null), getStaffSession().catch(() => null)]);
  const staffOk = Boolean(staff?.mfaComplete);
  if (customer) {
    const c = customer.customer;
    const name = c.displayName || `${c.firstName} ${c.lastName}`.trim() || customer.session.user.name;
    return { kind: "customer", name, email: customer.session.user.email, initials: initialsOf(name), staff: staffOk };
  }
  // Staff only count once their second factor is done (a password-only staff session isn't signed in yet).
  if (staff && staffOk) return { kind: "staff", name: staff.session.user.name, email: staff.session.user.email, initials: initialsOf(staff.session.user.name), roleName: staff.staff.roleName };
  return { kind: "guest" };
}

async function SessionHeader(props: Props) {
  return <HeaderView {...props} viewer={await viewerFromSession()} />;
}

export function Header(props: Props) {
  return (
    <Suspense fallback={<HeaderView {...props} viewer="loading" />}>
      <SessionHeader {...props} />
    </Suspense>
  );
}
