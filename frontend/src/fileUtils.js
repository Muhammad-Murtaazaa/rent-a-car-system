// Uploaded files are served through authenticated, tenant-isolated routes
// (never public static paths). Stored references may be legacy
// "/uploads/<name>" or current "/api/files/<name>"; both normalize here and
// carry the current login token, because <img> tags and plain links cannot
// set an Authorization header.
export function fileViewUrl(p) {
  if (!p) return "";
  const s = String(p);
  if (/^https?:\/\//i.test(s)) return s;
  let path = s;
  if (path.startsWith("/uploads/")) path = "/api/files/" + path.slice("/uploads/".length);
  if (path.startsWith("/api/files/")) {
    const tok =
      (typeof window !== "undefined" &&
        (localStorage.getItem("tenant_token") || localStorage.getItem("saas_super_admin_token"))) ||
      "";
    return tok ? `${path}?token=${encodeURIComponent(tok)}` : path;
  }
  return s;
}

export function fileDownloadUrl(p) {
  const u = fileViewUrl(p);
  if (u.includes("/api/files/")) return u + (u.includes("?") ? "&" : "?") + "download=1";
  return u;
}

export function isImagePath(p) {
  return /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(String(p || ""));
}
