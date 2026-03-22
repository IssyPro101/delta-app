import { proxyAgentRequest } from "../../../lib/agent-proxy";

export async function POST(request: Request) {
  return proxyAgentRequest(request, "/api/agent/chat", {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
