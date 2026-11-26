/**
 * Caminho enviado ao backend: reconstruído contra uma origem fixa e aceito
 * somente quando continua nela, sem host nem esquema vindos do request.
 *
 * A barra final é preservada: sem ela, uma rota declarada com barra responde
 * com redirect para outra origem, que o renderer não consegue seguir.
 */
export function backendRequestPath(source: URL): string {
  const segments = source.pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)));
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Caminho inválido para a ponte local.");
  }
  const trailingSlash =
    segments.length > 0 && source.pathname.endsWith("/") ? "/" : "";
  const query = new URLSearchParams(source.search).toString();
  return `/${segments.join("/")}${trailingSlash}${query ? `?${query}` : ""}`;
}
