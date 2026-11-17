import { test, expect } from "@playwright/test";
test("My collection combines layouts, plant reminders and stock tracking", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Garden Tester");
  await page.getByLabel("Email address").fill(`garden-${Date.now()}@test.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("garden-browser-passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Workspace name").fill("Window collection");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My collection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to collection", exact: true })
    .click();
  await page.getByLabel("Record name", { exact: true }).fill("Plant A");
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await page.getByRole("button", { name: "Areas", exact: true }).click();
  await page.getByRole("button", { name: "Add area", exact: true }).click();
  await page.getByLabel("Area name").fill("Window shelf");
  await page.getByLabel("Rows", { exact: true }).fill("2");
  await page.getByLabel("Columns", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save area", exact: true }).click();
  await page
    .getByLabel("Plant or seed to place")
    .selectOption({ label: "Plant A" });
  await page
    .getByRole("button", { name: "Row 1, column 1: Empty", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Row 1, column 1: Plant A", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Row 1, column 1: Plant A", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/collection-areas-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/screenshots/collection-areas-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("Take progress photo");
  await page
    .getByLabel("Linked collection record")
    .selectOption({ label: "Plant A" });
  await page.getByLabel("Remind me at").fill("2020-01-01T12:00");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  const task = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "Take progress photo" }),
    });
  await expect(task.getByText("Due now", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await task.getByRole("link", { name: "Calendar alarm" }).click();
  expect((await download).suggestedFilename()).toBe("mastergrow-task.ics");
  await task.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(task.getByText("Completed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page.getByRole("button", { name: "Add material", exact: true }).click();
  await page.getByLabel("Material name").fill("Record labels");
  await page.getByLabel("Stock unit").fill("pieces");
  await page.getByLabel("Current quantity").fill("2");
  await page.getByLabel("Restock at or below").fill("3");
  await page.getByLabel("Target quantity").fill("10");
  await page
    .getByRole("button", { name: "Save material", exact: true })
    .click();
  await expect(
    page.getByText("Add 8 pieces to reach your target.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adjust stock", exact: true }).click();
  await page.getByLabel("Quantity change").fill("8");
  await page.getByLabel("Adjustment note").fill("Received supplies");
  await page
    .getByRole("button", { name: "Save adjustment", exact: true })
    .click();
  await expect(
    page.getByText("No restocks needed", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("10 pieces on hand", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/screenshots/collection-materials-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: "docs/screenshots/collection-materials-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(task.getByText("Completed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Records", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Plant A", exact: true }),
  ).toBeVisible();
});
