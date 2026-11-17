import { test, expect } from "@playwright/test";
test("new account can preserve notes, upload evidence and approve a procedure", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Browser Tester");
  await page.getByLabel("Email address").fill(`browser-${Date.now()}@test.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-testing-passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Workspace name").fill("Test studio");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good things grow from good records." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/overview-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeHidden();
  await page.screenshot({
    path: "docs/screenshots/overview-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await page.getByRole("button", { name: "New entry" }).click();
  await page.getByLabel("Title", { exact: true }).fill("First record");
  await page.getByLabel("Notes").fill("The visitor register is now organized.");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("First record")).toBeVisible();
  await page.reload();
  await expect(page.getByText("First record")).toBeVisible();
  await page
    .getByRole("button", { name: "Media library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Upload media", exact: true })
    .first()
    .click();
  await page.getByLabel("Choose file").setInputFiles({
    name: "visitor.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Enter each visitor name in the register."),
  });
  await page.getByLabel("Title", { exact: true }).fill("Visitor source");
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(
    page.getByText("Visitor source", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Procedures", exact: true }).click();
  await page.getByRole("button", { name: "New procedure" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Visitor welcome");
  await page.getByLabel("Summary").fill("Maintain a visitor record.");
  await page
    .getByLabel("Checklist — one step per line")
    .fill("Write visitor name.\nRecord arrival.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Visitor welcome", { exact: true }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.getByRole("button", { name: "Approve procedure" }).click();
  await expect(
    page.getByText("Approved", { exact: true }).first(),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export Markdown" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("procedure.md");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Team & training", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Assign training", exact: true })
    .click();
  await page.getByLabel("Due date").fill("2027-01-01");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Assign training" })
    .click();
  await page.getByText("Visitor welcome", { exact: true }).click();
  await page
    .getByRole("button", { name: "I have read and understood this procedure" })
    .click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "New workspace", exact: true })
    .click();
  await page.getByLabel("Workspace name").fill("Second workspace");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByLabel("Switch workspace").locator("option:checked"),
  ).toHaveText("Second workspace · Home");
  await expect(
    page.getByText("Build confidence, one procedure at a time"),
  ).toBeVisible();
  await expect(page.getByText("Visitor welcome", { exact: true })).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
