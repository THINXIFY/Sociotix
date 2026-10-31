import "server-only";
import type { LandingAvailability } from "@/components/social/landing";
import { SOCIAL_PROVIDER_IDS } from "@/lib/social/platforms";
import { getEnv } from "@/server/env";
import { providerAvailability } from "@/server/social/service";

/**
 * Which social platforms can really be connected, from the server's configuration at build time
 * (rebuild after switching one on). Public pages use it so their copy never overstates availability.
 */
export function socialReadiness(): LandingAvailability {
  let env: ReturnType<typeof getEnv> | null = null;
  try {
    env = getEnv();
  } catch {
    env = null;
  }
  return Object.fromEntries(SOCIAL_PROVIDER_IDS.map((id) => [id, env ? providerAvailability(env, id).state === "available" : false])) as LandingAvailability;
}
