/** @jest-environment node */
/**
 * PL-11: db:backup / db:restore argument parsing, retention, targets and commands.
 * Nothing here runs pg_dump, pg_restore or Docker.
 */
import {
  dumpCommand,
  parseRestoreArgs,
  resolveTarget,
  restoreCommand,
  restoreRefusal,
  selectBackupsToPrune,
} from "~/lib/system/db-backup";
describe("selectBackupsToPrune", () => {
  const files = [
    "ixstats-20260903T031700Z.dump",
    "ixstats-20260901T031700Z.dump",
    "notes.txt",
    "ixstats-20260902T031700Z.dump",
    "ixstats-20260904T031700Z.dump.partial",
    "manual-before-migration.dump",
  ];

  it("keeps the newest N backups, prunes the rest oldest first, and never touches another file", () => {
    expect(selectBackupsToPrune(files, 1)).toEqual([
      "ixstats-20260901T031700Z.dump",
      "ixstats-20260902T031700Z.dump",
    ]);
    expect(selectBackupsToPrune(files, 14)).toEqual([]);
  });
});
describe("parseRestoreArgs / restoreRefusal", () => {
  it("refuses production without the explicit flag", () => {
    const args = parseRestoreArgs(["x.dump", "--yes"]);
    expect(restoreRefusal(args, "production")).toMatch(/--i-know-this-is-production/);
    expect(restoreRefusal(args, "development")).toBeNull();
    expect(
      restoreRefusal(parseRestoreArgs(["x.dump", "--i-know-this-is-production"]), "production")
    ).toBeNull();
    expect(restoreRefusal(parseRestoreArgs([]), "development")).toMatch(/No backup file/);
  });
});

describe("targets and commands", () => {
  const url = "postgresql://ixstats:s3cr%40t@db.local:5432/ixstats?schema=public&sslmode=require";
  it("falls back to DATABASE_URL, keeping the password out of the arguments", () => {
    for (const target of [
      resolveTarget({ databaseUrl: url, containerRunning: () => false }),
      resolveTarget({ databaseUrl: url, noDocker: true, containerRunning: () => true }),
    ]) {
      expect(target).toEqual({
        kind: "url",
        url: "postgresql://ixstats@db.local:5432/ixstats?sslmode=require",
        password: "s3cr@t",
      });
      const dump = dumpCommand(target);
      expect(dump.command).toBe("pg_dump");
      expect(dump.args.join(" ")).not.toContain("s3cr");
      expect(dump.env).toEqual({ PGPASSWORD: "s3cr@t" });
      expect(restoreCommand(target, "a.dump").args).toEqual([
        "--clean",
        "--if-exists",
        "--no-owner",
        "--dbname=postgresql://ixstats@db.local:5432/ixstats?sslmode=require",
        "a.dump",
      ]);
    }
  });
});
