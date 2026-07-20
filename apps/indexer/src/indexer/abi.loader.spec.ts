import { parseAbiJson } from "./abi.loader";

describe("parseAbiJson", () => {
  it("accepts ABI JSON exported with a UTF-8 BOM", () => {
    expect(
      parseAbiJson('\uFEFF[{"type":"event","name":"Created"}]', "test.json"),
    ).toEqual([{ type: "event", name: "Created" }]);
  });

  it("rejects JSON that is not an ABI array", () => {
    expect(() => parseAbiJson('{"type":"event"}', "test.json")).toThrow(
      "Invalid ABI JSON: test.json",
    );
  });
});
