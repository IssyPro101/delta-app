import { proxyAgentRequest } from "../../../../../lib/agent-proxy";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } = await context.params;
  return proxyAgentRequest(request, `/api/agent/conversations/${id}/messages`);
}
