import { describe, expect, it } from "vitest";
import { moderateParkingNote, noteMentionsEmergency, NOTE_BLOCKED_MESSAGE } from "./parking-note-moderation";

describe("parking note moderation", () => {
  it.each([
    "I’m leaving now, spot opening up near the stairs.",
    "This lot is filling up fast.",
    "Entrance is blocked right now.",
    "Use the passage near class. Assistant is directing traffic.",
    "P7 has 10-15 spaces near the entrance.",
    "Please contact campus police. Fire near the garage.",
  ])("allows helpful parking information: %s", (note) => {
    expect(moderateParkingNote(note)).toEqual({ note, error: null });
  });
  it.each([undefined, "", "   "])("accepts no note: %s", (note) => {
    expect(moderateParkingNote(note)).toEqual({ note: null, error: null });
  });
  it("trims notes and enforces the exact length limit", () => {
    expect(moderateParkingNote("  Entrance blocked  ").note).toBe("Entrance blocked");
    expect(moderateParkingNote("a".repeat(101)).error).toContain("100 characters");
    const maximumNote = "Near stairs. ".repeat(8).slice(0, 100);
    expect(maximumNote.length).toBe(100);
    expect(moderateParkingNote(maximumNote).error).toBeNull();
  });
  it.each([
    "Fuck!", "f u c k", "f.u.c.k", "f*ck", "f**k", "s**t", "f***", "fuk", "fvck", "shyt", "sh1t", "sh!t",
    "b!tch", "b1tch", "bytch", "assh0le", "asshol", "bitches",
    "n i g g e r", "fаggot", "You are an idiot", "I will shoot you",
    "kill yourself", "I am going to bomb the garage", "I hate muslims",
    "free porn", "Send nudes", "Buy now! Free money",
    "hello hello hello hello", "aaaaaaaaaaa",
    "Text me 239-555-1234", "+1 (239) 555-1234", "hello@example.com",
    "hello [at] example [dot] com", "hello at example dot com",
    "two three nine five five five one two three four",
    "Visit spam.com", "@myhandle", "DM me on instagram",
  ])("blocks unsafe or obfuscated content: %s", (note) => {
    expect(moderateParkingNote(note).error).toBe(NOTE_BLOCKED_MESSAGE);
  });
  it.each(["Fire in P6", "Medical emergency near stairs", "Someone has a weapon", "Immediate danger", "Call 911"])("recognizes emergencies: %s", (note) => {
    expect(noteMentionsEmergency(note)).toBe(true);
  });
  it("does not call ordinary parking information an emergency", () => {
    expect(noteMentionsEmergency("Entrance is blocked right now.")).toBe(false);
  });
});
