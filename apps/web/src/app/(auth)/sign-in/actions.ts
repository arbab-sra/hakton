"use server";

import { signIn } from "@codemri/auth";

export async function signInWithGitHub() {
  await signIn("github", { redirectTo: "/dashboard" });
}
