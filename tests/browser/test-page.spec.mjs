import { test, expect } from "@playwright/test";

test("browser logic suite passes", async ({ page }) => {
  await page.goto("/test.html");
  const summary = page.locator("#summary");
  const failures = await page.locator("li.fail").allTextContents();
  expect(failures, "in-browser unit test failures").toEqual([]);
  await expect(summary).toHaveClass("good");
});

test("new profiles can be created and reach onboarding", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("New profile name").fill("Browser Test");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Welcome to EduDit", { exact: false })).toBeVisible();
});
