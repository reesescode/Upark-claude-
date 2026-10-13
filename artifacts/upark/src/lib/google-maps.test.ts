import { describe, expect, it, vi, afterEach } from "vitest";
import { getGoogleMapsUrl, getGoogleMapsTarget } from "./google-maps";

afterEach(() => vi.unstubAllGlobals());

describe("Google Maps navigation", () => {
  it("uses exact stored coordinates, not a garage name or address", () => {
    const url = new URL(getGoogleMapsUrl({ latitude: 26.4667, longitude: -81.7715 }));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("destination")).toBe("26.4667,-81.7715");
    expect(url.searchParams.get("travelmode")).toBe("driving");
    expect(url.searchParams.has("origin")).toBe(false);
  });

  it("passes a known current location as the origin", () => {
    const url = new URL(getGoogleMapsUrl(
      { latitude: 26.46, longitude: -81.77 },
      { lat: 26.45, lng: -81.78 },
    ));
    expect(url.searchParams.get("origin")).toBe("26.45,-81.78");
    expect(url.searchParams.get("destination")).toBe("26.46,-81.77");
  });

  it.each([
    ["Mozilla/5.0 (Windows NT 10.0)", "Win32", 0, "_blank"],
    ["Mozilla/5.0 (iPhone)", "iPhone", 5, "_self"],
    ["Mozilla/5.0 (Linux; Android 14)", "Linux", 5, "_self"],
    ["Mozilla/5.0 (Macintosh)", "MacIntel", 5, "_self"],
    ["Mozilla/5.0 (Macintosh)", "MacIntel", 0, "_blank"],
  ])("selects the right handoff for %s", (userAgent, platform, maxTouchPoints, target) => {
    vi.stubGlobal("navigator", { userAgent, platform, maxTouchPoints });
    expect(getGoogleMapsTarget()).toBe(target);
  });
});
