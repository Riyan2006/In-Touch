import { describe, expect, it } from "vitest";
import { detectTextsOnly, parseWhatsAppExport } from "./whatsapp";

const android = [
  "01/01/24, 09:00 - Alex: hello",
  "continuation line that is not another message",
  "15/02/24, 09:00 - Me: hi",
  "15/03/24, 09:00 - Alex: still here",
  "15/04/24, 09:00 - Me: four months",
].join("\n");

describe("parseWhatsAppExport", () => {
  it("parses Android timestamps and does not count multiline continuations", () => {
    const result = parseWhatsAppExport(android);
    expect("months" in result && result.months.map((month) => month.message_count)).toEqual([1, 1, 1, 1]);
  });

  it("parses iOS timestamps", () => {
    const result = parseWhatsAppExport(["[01/01/24, 09:00:00] Alex: hello", "[01/02/24, 09:00:00] Me: hi", "[01/03/24, 09:00:00] Alex: hello", "[01/04/24, 09:00:00] Me: hi"].join("\n"));
    expect("months" in result && result.months).toHaveLength(4);
  });

  it("excludes system and placeholder messages", () => {
    const result = parseWhatsAppExport(["01/01/24, 09:00 - Alex: <Media omitted>", "01/01/24, 09:01 - Alex: This message was deleted", "01/01/24, 09:02 - Alex: hello", "01/02/24, 09:00 - Me: hi", "01/03/24, 09:00 - Alex: hello", "01/04/24, 09:00 - Me: hi"].join("\n"));
    expect("months" in result && result.months[0].message_count).toBe(1);
  });

  it("returns clear parser failures for unsupported and too-short exports", () => {
    expect(parseWhatsAppExport("not a WhatsApp export")).toEqual({ error: "unrecognized_format" });
    expect(parseWhatsAppExport("01/01/24, 09:00 - Alex: hello\n01/02/24, 09:00 - Alex: hi")).toEqual({ error: "under_four_months" });
  });

  it("does not treat WhatsApp encryption notices as contact messages", () => {
    const notices = ["01/01/24, 09:00 - Alex: Messages and calls are end-to-end encrypted", "01/02/24, 09:00 - Alex: Messages and calls are end-to-end encrypted", "01/03/24, 09:00 - Alex: Messages and calls are end-to-end encrypted", "01/04/24, 09:00 - Alex: Messages and calls are end-to-end encrypted"].join("\n");
    expect(parseWhatsAppExport(notices)).toEqual({ error: "no_messages" });
  });
});

describe("detectTextsOnly", () => {
  const months = (values: number[]) => values.map((texts_per_week, index) => ({ month: index + 1, label: `M${index + 1}`, message_count: Math.round(texts_per_week * 4.33), texts_per_week }));
  it("leaves steady histories unflagged", () => expect(detectTextsOnly(months([10, 10, 10, 10, 10, 10])).flag.type).toBe("none"));
  it("flags a sustained decline", () => expect(detectTextsOnly(months([20, 20, 20, 20, 6, 5, 4])).flag.type).toBe("decay"));
  it("flags a sustained rise", () => expect(detectTextsOnly(months([5, 5, 5, 5, 13, 15, 16])).flag.type).toBe("rise_existing"));
});
