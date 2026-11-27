import { describe, expect, it } from "vitest";
import { canReadFile, isValidFilePath, type FileLookup } from "./access";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333";
const myPath = `${ME}/${FILE}.jpg`;
const otherPath = `${OTHER}/${FILE}.jpg`;

/** RLS-scoped lookups: each set holds the paths the signed-in user can see rows for. */
function lookup(visible: { orders?: string[]; registrations?: string[]; students?: string[] } = {}): FileLookup {
  return {
    orderWithSlip: async (p) => (visible.orders ?? []).includes(p),
    registrationWithPhoto: async (p) => (visible.registrations ?? []).includes(p),
    studentWithPhoto: async (p) => (visible.students ?? []).includes(p),
  };
}

describe("isValidFilePath", () => {
  it("accepts <uuid>/<uuid>.<ext> for allowed image types", () => {
    for (const ext of ["jpg", "png", "webp", "heic"]) expect(isValidFilePath(`${ME}/${FILE}.${ext}`)).toBe(true);
  });
  it.each([
    ["traversal", `${ME}/../${OTHER}/${FILE}.jpg`],
    ["extra folder", `${ME}/x/${FILE}.jpg`],
    ["no folder", `${FILE}.jpg`],
    ["leading slash", `/${ME}/${FILE}.jpg`],
    ["other extension", `${ME}/${FILE}.svg`],
    ["uppercase / not a uuid", `${ME}/NOT-A-UUID.jpg`],
    ["empty", ""],
  ])("rejects %s", (_name, path) => {
    expect(isValidFilePath(path)).toBe(false);
  });
});

describe("canReadFile", () => {
  it("lets the uploader read their own slip and photo", async () => {
    expect(await canReadFile(lookup(), ME, "slips", myPath)).toBe(true);
    expect(await canReadFile(lookup(), ME, "student-photos", myPath)).toBe(true);
  });

  it("denies another parent's slip when no visible order points at it", async () => {
    expect(await canReadFile(lookup(), ME, "slips", otherPath)).toBe(false);
  });

  it("lets staff read a slip of an order they can see (same branch)", async () => {
    expect(await canReadFile(lookup({ orders: [otherPath] }), ME, "slips", otherPath)).toBe(true);
  });

  it("does not use photo rows to grant slip access", async () => {
    expect(await canReadFile(lookup({ students: [otherPath], registrations: [otherPath] }), ME, "slips", otherPath)).toBe(false);
  });

  it("lets staff or a linked parent read a photo of a visible registration or student", async () => {
    expect(await canReadFile(lookup({ registrations: [otherPath] }), ME, "student-photos", otherPath)).toBe(true);
    expect(await canReadFile(lookup({ students: [otherPath] }), ME, "student-photos", otherPath)).toBe(true);
  });

  it("does not use order rows to grant photo access", async () => {
    expect(await canReadFile(lookup({ orders: [otherPath] }), ME, "student-photos", otherPath)).toBe(false);
  });

  it("denies invalid paths and unknown buckets even for the owner", async () => {
    expect(await canReadFile(lookup(), ME, "slips", `${ME}/../x.jpg`)).toBe(false);
    expect(await canReadFile(lookup({ orders: [myPath] }), ME, "backups" as never, myPath)).toBe(false);
  });

  it("denies when there is no signed-in user", async () => {
    expect(await canReadFile(lookup({ orders: [otherPath] }), null, "slips", otherPath)).toBe(false);
  });
});
