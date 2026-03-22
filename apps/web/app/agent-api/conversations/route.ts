import { proxyAgentRequest } from "../../../lib/agent-proxy";

export async function GET(request: Request) {
  return proxyAgentRequest(request, "/api/agent/conversations");
}

export async function POST(request: Request) {
  return proxyAgentRequest(request, "/api/agent/conversations", {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
