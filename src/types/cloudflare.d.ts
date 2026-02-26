/**
 * Type declarations for Cloudflare Workers modules
 * used by src/worker.ts
 */

declare module "cloudflare:node" {
  /**
   * Forward a Workers fetch Request to a Node.js HTTP server
   * registered on the given port via server.listen(port).
   */
  export function handleAsNodeRequest(
    port: number,
    request: Request,
  ): Promise<Response>;

  /**
   * Create a Workers default export handler that bridges all
   * incoming requests to a Node.js HTTP server.
   */
  export function httpServerHandler(
    options: { port: number } | import("node:http").Server,
  ): ExportedHandler;
}
