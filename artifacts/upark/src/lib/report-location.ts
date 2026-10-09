export const TOO_FAR_MESSAGE = "You must be near this garage to report its parking status.";

export async function getReportLocation(garage: { latitude: number; longitude: number }) {
  if (!navigator.geolocation) throw new Error("Location is not supported on this device.");
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, maximumAge: 0, timeout: 20_000,
    }),
  ).catch((error: GeolocationPositionError) => {
    throw new Error(error.code === 1
      ? "Allow location access to verify you are near this garage."
      : "Unable to get your location. Enable precise location and try again.");
  });
  const { latitude, longitude, accuracy } = position.coords;
  if (accuracy > 100) throw new Error("Your location is not accurate enough. Enable precise location and try again.");
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(garage.latitude - latitude) / 2) ** 2 +
    Math.cos(rad(latitude)) * Math.cos(rad(garage.latitude)) * Math.sin(rad(garage.longitude - longitude) / 2) ** 2;
  if (6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))) > 100) throw new Error(TOO_FAR_MESSAGE);
  return { latitude, longitude, accuracy, timestamp: position.timestamp };
}
