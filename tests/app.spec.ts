import { expect, test } from "@playwright/test";

test("demo entry, reporting, navigation, search, export, and sign-out", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Continue with Microsoft" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Let’s see the big picture." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page.getByRole("heading", { name: "Overview." })).toBeVisible();
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
  const revenue = page.locator(".metric-card").first().locator("strong");
  const before = await revenue.textContent();
  await page.getByLabel("Date range").selectOption("7");
  await expect(revenue).not.toHaveText(before!);
  await page.screenshot({
    path: `test-results/dashboard-${isMobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "View all orders" }).click();
  await page
    .getByRole("textbox", { name: "Search orders" })
    .fill("no-such-customer");
  await expect(
    page.getByRole("heading", { name: "No orders found" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search orders" }).fill("");
  await page.getByLabel("Filter order status").selectOption("Completed");
  await expect(page.locator("tbody tr").first()).toContainText("Completed");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ags-sales-7-days.csv");
  if (isMobile)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Product performance" }),
  ).toBeVisible();
  if (isMobile)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your customers" }),
  ).toBeVisible();
  if (isMobile)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your account" }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(
    page.getByRole("button", { name: "Explore the demo" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("refresh starts a new demo session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Explore the demo" }),
  ).toBeVisible();
});
