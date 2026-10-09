import { afterEach, describe, expect, it, vi } from "vitest";
import { getReportLocation, TOO_FAR_MESSAGE } from "./report-location";

const garage = { latitude: 26, longitude: -81 };
afterEach(() => vi.unstubAllGlobals());

function mockPosition(latitude: number, accuracy = 5) {
  const getCurrentPosition = vi.fn((success: PositionCallback) => success({
    coords: { latitude, longitude: -81, accuracy }, timestamp: Date.now(),
  } as GeolocationPosition));
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  return getCurrentPosition;
}

describe("report form location verification", () => {
  it("requests a fresh high-accuracy device reading, not manually entered coordinates", async () => {
    const getter = mockPosition(26);
    const result = await getReportLocation(garage);
    expect(result).toMatchObject({ latitude: 26, longitude: -81, accuracy: 5 });
    expect(getter.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
  });
  it("rejects far-away and inaccurate locations before submitting", async () => {
    mockPosition(27);
    await expect(getReportLocation(garage)).rejects.toThrow(TOO_FAR_MESSAGE);
    mockPosition(26, 101);
    await expect(getReportLocation(garage)).rejects.toThrow("not accurate enough");
  });
  it("explains permission denial without submitting or using a fallback location", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_success: unknown, failure: PositionErrorCallback) => failure({ code: 1 } as GeolocationPositionError) } });
    await expect(getReportLocation(garage)).rejects.toThrow("Allow location access");
  });
});
