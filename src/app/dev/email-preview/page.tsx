import { redirect } from "next/navigation";

/** Alias for the email template previews (development only; the proxy 404s every /dev route elsewhere). */
export default function Page() {
  redirect("/dev/emails");
}
