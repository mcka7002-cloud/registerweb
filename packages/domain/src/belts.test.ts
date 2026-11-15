import { describe, expect, it } from "vitest";
import { beltLook, classesToExam } from "./belts";

describe("beltLook", () => {
  it("maps white, coloured and black ranks like belt_ranks", () => {
    expect(beltLook(0)).toEqual({ color: "white", level: 0, dan: 0, gup: null });
    expect(beltLook(1)).toEqual({ color: "yellow", level: 1, dan: 0, gup: 10 });
    expect(beltLook(2)).toEqual({ color: "yellow", level: 2, dan: 0, gup: 9 });
    expect(beltLook(7)).toEqual({ color: "brown", level: 1, dan: 0, gup: 4 });
    expect(beltLook(10)).toEqual({ color: "red", level: 2, dan: 0, gup: 1 });
    expect(beltLook(11)).toEqual({ color: "black", level: 0, dan: 1, gup: null });
    expect(beltLook(20)).toEqual({ color: "black", level: 0, dan: 10, gup: null });
  });
  it("rejects unknown ranks", () => {
    expect(() => beltLook(21)).toThrow(RangeError);
    expect(() => beltLook(-1)).toThrow(RangeError);
  });
});

describe("classesToExam", () => {
  it("counts down and stops at zero", () => {
    expect(classesToExam(9, 14)).toBe(5);
    expect(classesToExam(20, 14)).toBe(0);
  });
});
