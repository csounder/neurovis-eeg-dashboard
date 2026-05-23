/**
 * Turn thrown/rejected values into a readable string.
 * Browser callbacks often surface `Event` (not `Error`), which would otherwise show as "[object Event]".
 */
export function formatCaught(reason: unknown): string {
  if (reason == null) return "Unknown error";
  if (typeof reason === "string") return reason;
  if (typeof reason === "number" || typeof reason === "boolean") return String(reason);
  if (reason instanceof Error) return reason.message || reason.name || "Error";
  if (typeof DOMException !== "undefined" && reason instanceof DOMException) {
    return reason.message || reason.name;
  }
  if (typeof Event !== "undefined" && reason instanceof Event) {
    if (reason instanceof ErrorEvent && reason.message) return reason.message;
    const t = reason.type || "event";
    return `Browser ${t} (see console for details)`;
  }
  if (typeof reason === "object") {
    const msg = (reason as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
    const name = (reason as { name?: unknown }).name;
    if (typeof name === "string" && name.length > 0) return name;
  }
  try {
    const s = String(reason);
    if (s === "[object Event]" || s === "[object Object]") {
      return "Unexpected non-Error throw (often a browser Event); check the console.";
    }
    return s;
  } catch {
    return "Unknown error";
  }
}
