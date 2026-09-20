import assert from "node:assert/strict";
import test from "node:test";
import { hasSchoolAdminGroup, requireClassMembership } from "../api/_auth.ts";
import { canChangeTeamCount } from "../api/_team-roster.ts";

function membershipClient(row) {
  return {
    async query(sql, values) {
      assert.match(sql, /FROM class_teachers/);
      assert.equal(values[0], "class-a");
      return row ? { rowCount: 1, rows: [row] } : { rowCount: 0, rows: [] };
    },
  };
}

test("class members retain their assigned editing role", async () => {
  await assert.doesNotReject(() => requireClassMembership(membershipClient({ role: "editor" }), "class-a", "teacher-a"));
  assert.equal(await requireClassMembership(membershipClient({ role: "lead" }), "class-a", "teacher-a"), "lead");
});

test("a teacher without a class membership is denied", async () => {
  await assert.rejects(
    () => requireClassMembership(membershipClient(), "class-a", "teacher-b"),
    /do not have access to this class/,
  );
});

test("school overview requires a configured dedicated Entra group", () => {
  assert.equal(hasSchoolAdminGroup(["staff", "quiz-admins"], "quiz-admins"), true);
  assert.equal(hasSchoolAdminGroup(["staff"], "quiz-admins"), false);
  assert.equal(hasSchoolAdminGroup(["quiz-admins"], undefined), false);
});

test("a submitted class can rename teams but cannot change its team count", () => {
  assert.equal(canChangeTeamCount(true, 6, 6), true);
  assert.equal(canChangeTeamCount(true, 6, 7), false);
  assert.equal(canChangeTeamCount(false, 6, 7), true);
});
