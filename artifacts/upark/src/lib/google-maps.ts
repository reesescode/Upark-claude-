type Destination = { latitude: number; longitude: number };
type Origin = { lat: number; lng: number };

export function getGoogleMapsUrl(destination: Destination, origin?: Origin | null) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  url.searchParams.set("travelmode", "driving");
  // Omitting origin lets Google Maps use the user's current location.
  if (origin) url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  return url.toString();
}

export function getGoogleMapsTarget() {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Google's universal Maps URL opens the installed mobile app, or the browser.
  return mobile ? "_self" : "_blank";
}
