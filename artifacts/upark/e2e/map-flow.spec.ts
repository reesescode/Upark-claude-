import { expect, test } from "@playwright/test";

test("campus map keeps markers, disclosures, and parking routes usable", async ({
  page,
}) => {
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
    "/navigate/library-garage",
  );

  await detailLink.click();
  await expect(page).toHaveURL(/\/garages\/library-garage$/);
  await expect(
    page.getByRole("heading", { name: "Parking Garage 3" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Navigate/i }),
  ).toHaveAttribute("href", "/navigate/library-garage");

  await page.goto("/map");
  await page.getByPlaceholder("Search campus...").fill("Garage 3");
  await page.getByRole("link", { name: "Navigate" }).click();
  await expect(page).toHaveURL(/\/navigate\/library-garage$/);
  await expect(page.getByTestId("status-route")).toContainText(
    "Location permission was denied",
  );
  await expect(
    page.getByRole("link", { name: "Open directions in Google Maps" }),
  ).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=26.4667616,-81.774101&travelmode=driving",
  );
});