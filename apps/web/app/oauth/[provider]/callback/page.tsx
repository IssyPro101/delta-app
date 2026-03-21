import { notFound } from "next/navigation";

import { OAuthCallbackClient } from "../../../../components/oauth-callback-client";

export default async function OAuthCallbackPage({
  params,
}: Readonly<{
  params: Promise<{ provider: string }>;
}>) {
  const { provider } = await params;

  if (provider !== "hubspot" && provider !== "fathom") {
    notFound();
  }

  return <OAuthCallbackClient provider={provider} />;
}
