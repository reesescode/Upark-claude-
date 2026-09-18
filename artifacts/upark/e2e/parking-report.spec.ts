import { expect, test } from "@playwright/test";

test("a signed-in student report appears immediately and survives reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder("e.g. Taylor").fill("Regression");
  await page.getByPlaceholder("e.g. 1029384").fill(`test-${Date.now()}`);
  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(page).toHaveURL(/\/map$/);

  await page.goto("/garages");
  const garageLink = page.locator('a[href^="/garages/"]').first();
  await expect(garageLink).toBeVisible();
  const garageName = (await garageLink.locator("span").first().textContent())?.trim();
  expect(garageName).toBeTruthy();
  await garageLink.click();
  await expect(page.getByRole("heading", { name: garageName! })).toBeVisible();

  await page.getByRole("button", { name: "Report Parking", exact: true }).click();
  await page.getByRole("dialog").getByText("Almost Full", { exact: true }).click();
  await page.getByRole("button", { name: "Submit Report" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Parking report submitted!",
  );
  const recentReports = page
    .getByRole("heading", { name: "Recent Parking Reports" })
    .locator("xpath=ancestor::section");
  await expect(recentReports.locator(".space-y-3 > div").first()).toContainText(
    "Almost Full",
  );
  await expect(recentReports.locator(".space-y-3 > div").first()).toContainText(
    "reported just now",
  );

  await page.reload();
  await expect(page.getByRole("heading", { name: garageName! })).toBeVisible();
  await expect(recentReports.locator(".space-y-3 > div").first()).toContainText(
    "Almost Full",
  );
});