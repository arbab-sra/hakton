import { auth } from "@codemri/auth";

export async function getAuthenticatedActor() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return undefined;
  }

  return {
    email,
    name: session.user?.name,
    image: session.user?.image
  };
}
