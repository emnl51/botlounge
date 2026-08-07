/**
 * Browser requests stay on the web application's origin. The Next.js API
 * route forwards them to API_INTERNAL_URL inside the Compose network.
 *
 * This avoids exposing Docker hostnames and prevents HTTPS deployments from
 * making blocked or mixed-content requests to http://localhost:4000.
 */
export const browserApiUrl = "/api";
