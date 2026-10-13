import { expect, test } from "@playwright/test";

test("campus map keeps markers and sends navigation to Google Maps", async ({
  page, context,
}) => {
  await context.route("https://www.google.com/maps/dir/**", route =>
    route.fulfill({ contentType: "text/html", body: "<h1>Google Maps handoff</h1>" }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          _success: PositionCallback,
          error?: PositionErrorCallback,
        ) =>
          error?.({
            code: 1,
            message: "Permission denied",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError),
      },
    });
  });

  await page.goto("/map");

  const marker = page.getByRole("button", {
    name: /Parking Garage 3: \d+ spaces available/,
  });
  await expect(marker).toBeVisible();
  await expect(page.getByText(/\d+ live · \d+ awaiting live data/)).toBeVisible();

  await page.getByPlaceholder("Search campus...").fill("Garage 3");
  await expect(
    page.getByRole("heading", { name: "Parking Garage 3" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Live high-confidence estimate from trusted availability update/,
    ),
  ).toBeVisible();

  const detailLink = page.getByRole("link", { name: "View Garage" });
  const navigationLink = page.getByRole("link", { name: "Navigate" });
  await expect(detailLink).toHaveAttribute("href", "/garages/library-garage");
  await expect(navigationLink).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=26.4667616%2C-81.774101&travelmode=driving",
  );
  await expect(navigationLink).toHaveAttribute("target", "_blank");

  await detailLink.click();
  await expect(page).toHaveURL(/\/garages\/library-garage$/);
  await expect(
    page.getByRole("heading", { name: "Parking Garage 3" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Navigate/i }),
  ).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=26.4667616%2C-81.774101&travelmode=driving");
  await expect(page.getByText("Drive Time", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Walk to Class", { exact: true })).toHaveCount(0);
  const detailPopup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Navigate Here" }).click();
  const detailMaps = await detailPopup;
  await expect(detailMaps).toHaveURL(/google\.com\/maps\/dir\/.*destination=26\.4667616%2C-81\.774101/);
  await detailMaps.close();
  await expect(page).toHaveURL(/\/garages\/library-garage$/);

  await page.goto("/garages");
  await expect(page.getByText(/\d+m (drive|walk)/)).toHaveCount(0);

  await page.goto("/map");
  await page.getByPlaceholder("Search campus...").fill("Garage 3");
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Navigate", exact: true }).click();
  const maps = await popup;
  await expect(maps).toHaveURL(/google\.com\/maps\/dir\/.*destination=26\.4667616%2C-81\.774101/);
  await maps.close();
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(0);
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`opening garage details during map zoom is safe at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/map");
    await expect(page.getByRole("button", { name: /Parking Garage 3: \d+ spaces available/ })).toBeVisible();

    await page.getByPlaceholder("Search campus...").fill("Garage 3");
    await page.locator(".leaflet-zoom-anim").waitFor({ state: "attached" });
    await page.getByRole("link", { name: "View Garage" }).evaluate(link => {
      // Activate immediately, without Playwright waiting for map animation stability.
      if (!document.querySelector(".leaflet-zoom-anim")) {
        throw new Error("Regression check must leave while the zoom is active");
      }
      (link as HTMLAnchorElement).click();
    });
    await expect(page).toHaveURL(/\/garages\/library-garage$/);
    // Observe beyond Leaflet's 250ms fallback timer to catch delayed errors.
    await page.waitForTimeout(350);
    expect(errors).toEqual([]);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Parking Garage 3" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Navigate Here" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=26.4667616%2C-81.774101&travelmode=driving",
    );
  });
}

test("map navigation includes the location already shown on the map", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => success({
          coords: { latitude: 26.462, longitude: -81.773 },
        } as GeolocationPosition),
      },
    });
  });
  await page.goto("/map");
  await page.getByRole("button", { name: "Show my location" }).click();
  await page.getByPlaceholder("Search campus...").fill("Garage 3");
  await expect(page.getByRole("link", { name: "Navigate", exact: true })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=26.4667616%2C-81.774101&travelmode=driving&origin=26.462%2C-81.773",
  );
});

test.describe("mobile Google Maps handoff", () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile" });

  test("uses the universal Maps link with browser fallback for report-only lots", async ({ page, context }) => {
    await context.route("https://www.google.com/maps/dir/**", route =>
      route.fulfill({ contentType: "text/html", body: "<h1>Google Maps handoff</h1>" }),
    );
    await page.goto("/garages/fgcu-lot-8");
    await expect(page.getByText("User Reports Only", { exact: true }).first()).toBeVisible();
    const navigate = page.getByRole("link", { name: "Navigate Here" });
    await expect(navigate).toHaveAttribute("target", "_self");
    const href = await navigate.getAttribute("href");
    const garage = await (await page.request.get("/api/garages/fgcu-lot-8")).json();
    expect(new URL(href!).searchParams.get("destination")).toBe(`${garage.latitude},${garage.longitude}`);
    await navigate.click();
    await expect(page).toHaveURL(href!);
    await expect(page.getByRole("heading", { name: "Google Maps handoff" })).toBeVisible();
  });
});