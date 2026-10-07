export function sameOrigin(request: { headers: Headers; nextUrl: { origin: string; protocol: string } }) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const actual = new URL(origin);
    const host = request.headers.get("host") ?? new URL(request.nextUrl.origin).host;
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? request.nextUrl.protocol.replace(":", "");
    return actual.host === host && actual.protocol === `${protocol}:`;
  } catch { return false; }
}
