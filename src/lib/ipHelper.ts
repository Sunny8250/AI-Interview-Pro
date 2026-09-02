/**
 * CRIT-03 Fix: Secure IP detection that cannot be spoofed by clients.
 *
 * Security model:
 * - On Vercel: `request.ip` is set by the platform and is always trustworthy.
 * - Behind a trusted reverse proxy (Nginx / Cloudflare): the proxy APPENDS to
 *   X-Forwarded-For, so the RIGHTMOST IP is the one added by YOUR infrastructure
 *   and cannot be forged by the client.
 * - NEVER trust the leftmost (first) IP in X-Forwarded-For directly — it is
 *   fully attacker-controlled.
 */

/** Basic IPv4/IPv6 pattern check — rejects obviously fake values. */
function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  // IPv4
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 (simplified — covers ::1, full, and compressed forms)
  const ipv6 = /^[0-9a-fA-F:]{2,39}$/;
  return ipv4.test(ip) || ipv6.test(ip);
}

export function getClientIp(request: any): string {
  // Headers are only trustworthy when the hosting platform or a proxy we control
  // overwrites them. Do not accept a client-supplied forwarding header by default.
  const isVercel = process.env.VERCEL === '1';
  const trustsProxy = process.env.TRUST_PROXY === 'true';

  if (isVercel) {
    const vercelIp = request.headers?.get?.('x-vercel-forwarded-for');
    const candidate = vercelIp?.split(',')[0].trim();
    if (candidate && isValidIp(candidate)) return candidate;
  }

  if (trustsProxy) {
    const realIp = request.headers?.get?.('x-real-ip');
    const realCandidate = realIp?.trim();
    if (realCandidate && isValidIp(realCandidate)) return realCandidate;

    // A trusted proxy appends its own address, so the rightmost value is the
    // client address only when the proxy is configured to remove inbound XFF.
    const forwardedFor = request.headers?.get?.('x-forwarded-for');
    if (!forwardedFor) return 'unknown_client';
    const ips = forwardedFor
      .split(',')
      .map((ip: string) => ip.trim())
      .filter((ip: string) => isValidIp(ip));
    if (ips.length > 0) return ips[ips.length - 1];
  }

  // Development servers do not normally have a trusted reverse proxy. This
  // branch keeps local testing usable while preserving strict production rules.
  if (process.env.NODE_ENV !== 'production') {
    const forwardedFor = request.headers?.get?.('x-forwarded-for');
    const candidate = forwardedFor?.split(',').pop()?.trim() || request.headers?.get?.('x-real-ip')?.trim();
    if (candidate && isValidIp(candidate)) return candidate;
  }

  // Fail conservatively. Set TRUST_PROXY=true only when the reverse proxy
  // removes client-provided forwarding headers before forwarding requests.
  return 'unknown_client';
}
