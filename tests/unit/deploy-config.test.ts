import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * OPS-01C: static checks of the staging templates in deploy/. nginx and systemd are not available on every
 * development machine, so the security invariants are checked here; `nginx -t` and `systemd-analyze verify`
 * still run on the staging host (docs/deployment/STAGING_RUNBOOK.md).
 */

const nginx = readFileSync("deploy/nginx/sociotix.conf", "utf8");
const code = nginx.replace(/#.*$/gm, "");
const unit = (name: string) => readFileSync(`deploy/systemd/${name}`, "utf8");

describe("nginx template", () => {
  it("is structurally sound: balanced braces and every directive terminated", () => {
    let depth = 0;
    for (const ch of code) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
    for (const raw of code.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line === "}" || line.endsWith("{")) continue;
      expect(line, line).toMatch(/[;}]$/);
    }
  });

  it("overwrites X-Forwarded-For and blanks every other client-IP header", () => {
    expect(code).toMatch(/proxy_set_header\s+X-Forwarded-For\s+\$remote_addr;/);
    expect(code).not.toMatch(/\$proxy_add_x_forwarded_for/);
    for (const h of ["X-Real-IP", "Forwarded", "True-Client-IP", "CF-Connecting-IP"]) expect(code).toMatch(new RegExp(`proxy_set_header\\s+${h}\\s+"";`));
    // proxy_set_header in a location would silently drop the server-level overwrites above (nginx inheritance rule).
    const locations = [...code.matchAll(/\blocation\b[^{]*{([^}]*)}/g)].map((m) => m[1]!);
    expect(locations.length).toBeGreaterThan(8);
    for (const loc of locations) expect(loc).not.toMatch(/proxy_set_header/);
  });

  it("proxies only to the loopback app, redirects HTTP to HTTPS and blocks /dev", () => {
    expect(code).toMatch(/upstream sociotix_web\s*{\s*server 127\.0\.0\.1:3000;/);
    expect([...code.matchAll(/proxy_pass\s+([^;]+);/g)].every((m) => m[1] === "http://sociotix_web")).toBe(true);
    expect(code).toMatch(/return 301 https:\/\/\$host\$request_uri;/);
    expect(code).toMatch(/ssl_protocols TLSv1\.2 TLSv1\.3;/);
    expect(code).toMatch(/location \^~ \/dev { return 404; }/);
    expect(code).toMatch(/server_tokens off;/);
  });

  it("allows large bodies only on the upload routes that exist, and above the app's own limits", () => {
    expect(code).toMatch(/^\s*client_max_body_size 1m;/m);
    const bigger = [...code.matchAll(/location (?:=|~) (\S+)\s*{ client_max_body_size (\d+)m;/g)];
    expect(bigger.map((m) => m[1])).toEqual(["/api/content/media", "/api/admin/blog/media", "^/api/admin/digital-products/[^/]+/files$"]);
    expect(existsSync("src/app/api/content/media/route.ts")).toBe(true);
    expect(existsSync("src/app/api/admin/blog/media/route.ts")).toBe(true);
    expect(existsSync("src/app/api/admin/digital-products/[id]/files/route.ts")).toBe(true);
    for (const m of bigger) expect(Number(m[2])).toBeLessThanOrEqual(9);
  });

  it("rate limits sign-in and APIs but never the health checks", () => {
    expect(code).toMatch(/zone=sv_auth:10m\s+rate=10r\/m/);
    expect(code).toMatch(/limit_req_status 429;/);
    for (const p of ["/api/health", "/api/health/worker"]) expect(code).toMatch(new RegExp(`location = ${p.replace(/\//g, "\\/")}\\s*{ proxy_pass http:\\/\\/sociotix_web; }`));
    // Every app auth page named in the sign-in rule exists.
    const auth = /\^\/\(([^)]+)\)\(\/\|\$\)/.exec(code)![1]!.split("|");
    const pages = (p: string) => readdirSync("src/app", { recursive: true, encoding: "utf8" }).some((f) => f.replace(/\\/g, "/").replace(/\([^)]+\)\//g, "") === `${p}/page.tsx`);
    for (const p of auth) expect(pages(p), p).toBe(true);
  });
});

describe("systemd templates", () => {
  it("web binds loopback only and restarts automatically", () => {
    const web = unit("sociotix-web.service");
    expect(web).toMatch(/^ExecStart=\S+\/next start --hostname 127\.0\.0\.1 --port 3000$/m);
    expect(web).toMatch(/^Restart=always$/m);
  });

  it("both units load secrets from the env file, run unprivileged and hardened", () => {
    for (const name of ["sociotix-web.service", "sociotix-worker.service"]) {
      const u = unit(name);
      for (const line of ["User=sociotix", "EnvironmentFile=/etc/sociotix/sociotix.env", "NoNewPrivileges=true", "ProtectSystem=strict", "ProtectHome=true", "PrivateTmp=true", "CapabilityBoundingSet=", "Restart=always", "WantedBy=multi-user.target"]) expect(u, `${name}: ${line}`).toContain(`\n${line}\n`);
      expect(u).not.toMatch(/^Environment=/m);
    }
  });

  it("worker runs the same command as `npm run worker`", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
    const cmd = /^ExecStart=\S+\/node_modules\/\.bin\/(.+)$/m.exec(unit("sociotix-worker.service"))![1];
    expect(cmd).toBe(pkg.scripts.worker);
  });
});
