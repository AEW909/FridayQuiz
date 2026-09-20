import { createRemoteJWKSet, jwtVerify } from "jose";
import type pg from "pg";

export interface AuthenticatedTeacher {
  authSubject: string;
  email: string | null;
  displayName: string;
  groupIds: string[];
}

export function hasSchoolAdminGroup(groupIds: string[], schoolAdminGroupId: string | undefined) {
  return Boolean(schoolAdminGroupId && groupIds.includes(schoolAdminGroupId));
}

export async function requireTeacher(request: Request): Promise<AuthenticatedTeacher> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const tenantId = process.env.VITE_ENTRA_TENANT_ID;
  const clientId = process.env.VITE_ENTRA_CLIENT_ID;
  const staffGroupId = process.env.ENTRA_STAFF_GROUP_ID;
  if (!token || !tenantId || !clientId || !staffGroupId) throw new Error("A Microsoft access token is required.");

  const keys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
  const { payload } = await jwtVerify(token, keys, {
    issuer: [
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
      `https://sts.windows.net/${tenantId}/`,
    ],
    audience: [clientId, `api://${clientId}`],
  });
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  if (payload.tid !== tenantId) throw new Error("This Microsoft account is not in the configured school tenant.");
  if (!groups.includes(staffGroupId)) throw new Error("Your Microsoft token does not include LRGS-STAFF membership.");
  if (typeof payload.sub !== "string") throw new Error("Microsoft did not provide a stable staff identity.");

  return {
    authSubject: `${tenantId}:${payload.sub}`,
    email: typeof payload.preferred_username === "string" ? payload.preferred_username : null,
    displayName: typeof payload.name === "string" ? payload.name : "Friday Quiz teacher",
    groupIds: groups.filter((group): group is string => typeof group === "string"),
  };
}

export async function requireSchoolAdmin(request: Request) {
  const teacher = await requireTeacher(request);
  if (!hasSchoolAdminGroup(teacher.groupIds, process.env.ENTRA_SCHOOL_ADMIN_GROUP_ID)) {
    throw new Error("School administrator access is required.");
  }
  return teacher;
}

export async function upsertTeacher(client: pg.PoolClient, teacher: AuthenticatedTeacher) {
  const result = await client.query(
    `INSERT INTO teachers (auth_subject, email, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (auth_subject) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
     RETURNING id, display_name AS "displayName", email`,
    [teacher.authSubject, teacher.email, teacher.displayName],
  );
  return result.rows[0] as { id: string; displayName: string; email: string | null };
}

export async function requireClassMembership(client: pg.PoolClient, classId: string, teacherId: string) {
  const membership = await client.query(
    `SELECT role FROM class_teachers WHERE class_id = $1 AND teacher_id = $2`,
    [classId, teacherId],
  );
  if (!membership.rowCount) throw new Error("You do not have access to this class.");
  return membership.rows[0].role as "lead" | "editor";
}
