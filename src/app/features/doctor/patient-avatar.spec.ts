import { patientInitials } from "./patient-avatar";
import { TestBed } from "@angular/core/testing";
import { PatientAvatar } from "./patient-avatar";
describe("Shared patient initials", () => {
  it("uses the first and second names rather than the last name", () =>
    expect(patientInitials("  Sara   Ali Hassan ")).toBe("SA"));
  it("handles one name and missing text", () => {
    expect(patientInitials("Mina")).toBe("M");
    expect(patientInitials("  ")).toBe("");
  });
  it("is deterministic across component instances", () => {
    const a = TestBed.createComponent(PatientAvatar),
      b = TestBed.createComponent(PatientAvatar);
    a.componentRef.setInput("name", "Sara Ali");
    b.componentRef.setInput("name", "Sara Ali");
    expect(a.componentInstance.palette()).toEqual(
      b.componentInstance.palette(),
    );
  });
  it("supports Arabic names and whitespace", () =>
    expect(
      patientInitials(
        "  \u0645\u064a\u0646\u0627  \u0639\u0644\u064a \u062d\u0633\u0646 ",
      ),
    ).toBe("\u0645\u0639"));
});
