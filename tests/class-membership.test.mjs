import assert from "node:assert/strict";
import test from "node:test";
import { requireClassMembership } from "../api/_auth.ts";
import { canChangeTeamCount, canRetireTeam, matchesActiveRoster } from "../api/_team-roster.ts";
import { isEligibleForYearGroup, phaseForYearGroup } from "../api/_league-eligibility.ts";

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

test("a submitted class can rename teams but cannot change its team count", () => {
  assert.equal(canChangeTeamCount(true, 6, 6), true);
  assert.equal(canChangeTeamCount(true, 6, 7), false);
  assert.equal(canChangeTeamCount(false, 6, 7), true);
});

test("retiring a team preserves a minimum viable class roster", () => {
  assert.equal(canRetireTeam(3), true);
  assert.equal(canRetireTeam(2), false);
});

test("roster edits cannot revive or replace retired team identities", () => {
  assert.equal(matchesActiveRoster(["first", "second"], ["first", "second"]), true);
  assert.equal(matchesActiveRoster(["first", "second"], ["first", "retired"]), false);
  assert.equal(matchesActiveRoster(["first", "second"], ["first", "first"]), false);
  assert.equal(matchesActiveRoster(["first", "second"], ["first"]), false);
});

test("a new class can choose only its own year, phase, or whole-school boards", () => {
  assert.equal(phaseForYearGroup(7), "lower");
  assert.equal(phaseForYearGroup(10), "middle");
  assert.equal(phaseForYearGroup(13), "upper");
  assert.equal(isEligibleForYearGroup({ scope: "year_group", yearGroup: 13, phase: null }, 13), true);
  assert.equal(isEligibleForYearGroup({ scope: "phase", yearGroup: null, phase: "upper" }, 13), true);
  assert.equal(isEligibleForYearGroup({ scope: "whole_school", yearGroup: null, phase: null }, 13), true);
  assert.equal(isEligibleForYearGroup({ scope: "year_group", yearGroup: 12, phase: null }, 13), false);
  assert.equal(isEligibleForYearGroup({ scope: "phase", yearGroup: null, phase: "lower" }, 13), false);
});
