import { PublicClientApplication, type AccountInfo } from "@azure/msal-browser";

export interface TeacherIdentity {
  subject: string;
  displayName: string;
  email: string;
}

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID ?? "organizations";

let client: PublicClientApplication | undefined;
let initialization: Promise<void> | undefined;

function toTeacherIdentity(account: AccountInfo): TeacherIdentity {
  return {
    subject: account.homeAccountId,
    displayName: account.name ?? account.username,
    email: account.username,
  };
}

async function getClient() {
  if (!clientId) return undefined;

  client ??= new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: "sessionStorage" },
  });
  initialization ??= client.initialize().then(async () => {
    const response = await client?.handleRedirectPromise();
    if (response?.account) client?.setActiveAccount(response.account);
  });
  await initialization;
  return client;
}

export function isMicrosoftConfigured() {
  return Boolean(clientId);
}

export async function getSignedInTeacher(): Promise<TeacherIdentity | undefined> {
  const instance = await getClient();
  const account = instance?.getActiveAccount() ?? instance?.getAllAccounts()[0];
  return account ? toTeacherIdentity(account) : undefined;
}

export async function signInWithMicrosoft(): Promise<void> {
  const instance = await getClient();
  if (!instance) throw new Error("Microsoft sign-in has not been configured.");
  await instance.loginRedirect({ scopes: ["openid", "profile", "email"] });
}

export async function getTeacherAccessToken() {
  const instance = await getClient();
  if (!instance || !clientId) throw new Error("Microsoft sign-in has not been configured.");
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
  if (!account) throw new Error("Sign in is required.");

  const scopes = [`api://${clientId}/access_as_user`];
  try {
    return (await instance.acquireTokenSilent({ account, scopes })).accessToken;
  } catch {
    await instance.acquireTokenRedirect({ account, scopes });
    throw new Error("Redirecting to Microsoft for access approval.");
  }
}

export async function signOutFromMicrosoft() {
  const instance = await getClient();
  const account = instance?.getActiveAccount() ?? instance?.getAllAccounts()[0];
  if (instance && account) await instance.logoutRedirect({ account, postLogoutRedirectUri: window.location.origin });
}
