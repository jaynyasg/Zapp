import { test, expect } from "@playwright/test";
test("projects span sites and collection filters keep their records distinct", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Project Tester");
  await page
    .getByLabel("Email address")
    .fill(`projects-${Date.now()}@test.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("projects-browser-passphrase");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Workspace name").fill("Multi-site collection");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My collection", exact: true })
    .click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  for (const name of ["North site", "South site"]) {
    await page.getByRole("button", { name: "Add site", exact: true }).click();
    await page.getByLabel("Site name").fill(name);
    await page.getByRole("button", { name: "Save site", exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project name").fill("Winter survey");
  await page.getByRole("checkbox", { name: "North site", exact: true }).check();
  await page.getByRole("checkbox", { name: "South site", exact: true }).check();
  await page.getByLabel("Project status").selectOption("active");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Winter survey", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filter by site").selectOption({ label: "North site" });
  await page
    .getByLabel("Filter by project")
    .selectOption({ label: "Winter survey" });
  await page
    .getByRole("button", { name: "Add to collection", exact: true })
    .click();
  await page.getByLabel("Record name", { exact: true }).fill("North plant");
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "North plant", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Areas", exact: true }).click();
  await page.getByRole("button", { name: "Add area", exact: true }).click();
  await page.getByLabel("Area name").fill("North shelf");
  await page.getByRole("button", { name: "Save area", exact: true }).click();
  await page
    .getByLabel("Plant or seed to place")
    .selectOption({ label: "North plant" });
  await page
    .getByRole("button", { name: "Row 1, column 1: Empty", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Row 1, column 1: North plant",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Records", exact: true }).click();
  await page
    .getByRole("button", { name: "Assign site & project", exact: true })
    .click();
  await page.getByLabel("Assigned site").selectOption({ label: "South site" });
  await page
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "different sites",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("North record review");
  await page
    .getByLabel("Linked collection record")
    .selectOption({ label: "North plant" });
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  const northTask = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "North record review" }),
  });
  await northTask
    .getByRole("button", { name: "Complete", exact: true })
    .click();
  await expect(northTask.getByText("Completed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page.getByRole("button", { name: "Add material", exact: true }).click();
  await page.getByLabel("Material name").fill("North labels");
  await page.getByLabel("Stock unit").fill("pieces");
  await page
    .getByRole("button", { name: "Save material", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "North labels", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filter by site").selectOption({ label: "South site" });
  await expect(
    page.getByRole("heading", { name: "North labels", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(northTask).toBeHidden();
  await page.getByRole("button", { name: "Areas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Give your collection a home" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Records", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "North plant", exact: true }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Add to collection", exact: true })
    .click();
  await page.getByLabel("Record name", { exact: true }).fill("South plant");
  await page
    .getByRole("button", { name: "Create record", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "South plant", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  const project = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Winter survey" }) });
  await expect(project.getByText("2 records", { exact: true })).toBeVisible();
  await expect(
    project.getByText("1 of 1 tasks completed", { exact: true }),
  ).toBeVisible();
  await project.getByRole("button", { name: "Edit project" }).click();
  await page.getByLabel("Project status").selectOption("paused");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page.reload();
  await expect(project.getByText("Paused", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/collection-projects-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/screenshots/collection-projects-mobile.png",
    fullPage: true,
  });
  // Existing unassigned profiles can still be linked from a site-scoped task.
  const spaces = await (await page.request.get("/api/workspaces")).json();
  const root = `/api/workspaces/${spaces[0].id}`;
  const org = await (await page.request.get(root + "/organization")).json();
  const legacyResponse = await page.request.post(root + "/specimens", {
    data: { name: "Legacy unassigned record", kind: "plant" },
  });
  expect(legacyResponse.status()).toBe(201);
  const legacy = await legacyResponse.json();
  const linkedTask = await page.request.post(root + "/garden-tasks", {
    data: {
      title: "Legacy review",
      dueAt: "2099-01-01T12:00:00Z",
      siteId: org.sites.find((s: { name: string }) => s.name === "North site")
        .id,
      projectId: org.projects[0].id,
      specimenId: legacy.id,
    },
  });
  expect(linkedTask.status()).toBe(201);
  await page.getByLabel("Filter by site").selectOption({ label: "North site" });
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const legacyCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Legacy review" }) });
  await legacyCard
    .getByRole("button", { name: "Edit task", exact: true })
    .click();
  await expect(page.getByLabel("Linked collection record")).toHaveValue(
    legacy.id,
  );
  await page.getByLabel("Task notes").fill("Keep the existing record link.");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await legacyCard
    .getByRole("button", { name: "Legacy unassigned record", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Legacy unassigned record",
      exact: true,
    }),
  ).toBeVisible();
});
