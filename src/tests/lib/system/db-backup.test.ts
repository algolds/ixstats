/** @jest-environment node */
/**
 * PL-11: db:backup / db:restore argument parsing, retention, targets and commands.
 * Nothing here runs pg_dump, pg_restore or Docker.
 */
import {
  backupFileName,
  dumpCommand,
  parseBackupArgs,
  parseRestoreArgs,
  resolveTarget,
  restoreCommand,
  restoreRefusal,
  selectBackupsToPrune,
  toPgTarget,
} from "~/lib/system/db-backup";

describe("backupFileName", () => {
  it("is a sortable UTC stamp", () => {
    expect(backupFileName(new Date("2026-09-30T03:17:05.123Z"))).toBe(
      "ixstats-20260930T031705Z.dump"
    );
  });
});

describe("selectBackupsToPrune", () => {
  const files = [
    "ixstats-20260903T031700Z.dump",
    "ixstats-20260901T031700Z.dump",
    "notes.txt",
    "ixstats-20260902T031700Z.dump",
    "ixstats-20260904T031700Z.dump.partial",
    "manual-before-migration.dump",
  ];

  it("keeps the newest N backups and returns the rest oldest first", () => {
    expect(selectBackupsToPrune(files, 2)).toEqual(["ixstats-20260901T031700Z.dump"]);
    expect(selectBackupsToPrune(files, 1)).toEqual([
      "ixstats-20260901T031700Z.dump",
      "ixstats-20260902T031700Z.dump",
    ]);
  });

  it("never touches other files, and prunes nothing under the limit", () => {
    expect(selectBackupsToPrune(files, 14)).toEqual([]);
  });

  it("rejects a non-positive keep", () => {
    expect(() => selectBackupsToPrune(files, 0)).toThrow();
  });
});

describe("parseBackupArgs", () => {
  it("defaults to 14 backups in backups/", () => {
    expect(parseBackupArgs([])).toEqual({ keep: 14, dir: "backups", noDocker: false });
  });

  it("reads --keep, --dir and --no-docker in either form", () => {
    expect(parseBackupArgs(["--", "--keep", "7", "--dir=/srv/dumps", "--no-docker"])).toEqual({
      keep: 7,
      dir: "/srv/dumps",
      noDocker: true,
    });
    expect(parseBackupArgs(["--keep=3"]).keep).toBe(3);
  });

  it("rejects bad values and unknown flags", () => {
    expect(() => parseBackupArgs(["--keep", "0"])).toThrow(/positive integer/);
    expect(() => parseBackupArgs(["--keep", "two"])).toThrow(/positive integer/);
    expect(() => parseBackupArgs(["--keep"])).toThrow(/needs a value/);
    expect(() => parseBackupArgs(["--keep", "--dir"])).toThrow(/needs a value/);
    expect(() => parseBackupArgs(["--force"])).toThrow(/Unknown argument/);
  });
});

describe("parseRestoreArgs / restoreRefusal", () => {
  it("parses the file and flags", () => {
    expect(parseRestoreArgs(["--", "x.dump", "--yes"])).toEqual({
      file: "x.dump",
      yes: true,
      production: false,
      noDocker: false,
    });
    expect(() => parseRestoreArgs(["a.dump", "b.dump"])).toThrow(/Only one/);
    expect(() => parseRestoreArgs(["a.dump", "--force"])).toThrow(/Unknown argument/);
  });

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

  it("uses the running Docker container first", () => {
    const target = resolveTarget({ databaseUrl: url, containerRunning: () => true });
    expect(target.kind).toBe("docker");
    expect(dumpCommand(target)).toEqual({
      command: "docker",
      args: ["exec", "ixstats-postgres", "pg_dump", "-U", "postgres", "-Fc", "ixstats"],
    });
    expect(restoreCommand(target, "backups/a.dump")).toEqual({
      command: "docker",
      args: [
        "exec",
        "-i",
        "ixstats-postgres",
        "pg_restore",
        "-U",
        "postgres",
        "-d",
        "ixstats",
        "--clean",
        "--if-exists",
        "--no-owner",
      ],
      stdin: "backups/a.dump",
    });
  });

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

  it("fails clearly with neither a container nor a URL", () => {
    expect(() => resolveTarget({ containerRunning: () => false })).toThrow(/DATABASE_URL/);
    expect(() => toPgTarget("file:./dev.db")).toThrow(/PostgreSQL/);
    expect(() => toPgTarget("not a url")).toThrow(/valid URL/);
  });
});
