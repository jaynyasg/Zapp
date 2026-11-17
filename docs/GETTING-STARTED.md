<!-- generated-by: gsd-doc-writer -->

# Getting started

1. Install Node.js 24.15 or later. Run `npm ci`, `npm run build`, then `npm start` in the repository.
2. Open http://127.0.0.1:3001. Choose **Create an account**. Use a password of at least 12 characters.
3. Name a workspace. Choose Home for personal records or Facility for your shared SOP workspace.
4. Choose **Upload media**, select a supported file and enter a title. The analysis checkbox explains that content is sent to your configured AI provider. Clear it to store only.
5. If AI is configured and funded, watch the item progress from Queued to Analyzing to Draft. Otherwise the original remains available. Open a failed item to see its error and retry when resolved.
6. Open **Review generated draft**. Check source evidence, edit the checklist and gaps, then submit for review. An owner can approve it.
7. In **Team & training**, add a person who has already registered, select an approved procedure, and assign a due date. The assigned person opens the record and acknowledges it.
8. Use Journal for observations and Activity for the recorded history. Use the workspace selector or New workspace to separate teams and personal records.

Source documents can be PDF, TXT or Markdown. Export Office files and scanner captures as PDF. Photo/video playback uses browser-supported formats. For clips, visual sampling can miss actions and speech is not analyzed. Generated drafts require review.

No email account recovery is implemented. Keep your password securely. Hosting and email delivery are not provisioned by running the local app.

Open **Learning studio** to publish the generated lesson after its procedure is approved. Select a lesson and check off steps; progress persists across sessions. **Capture & practice** enables browser cameras and sampled visual guidance. **AI assistant** supports typed questions, optional dictation, and read-aloud replies. See [Learning and AI](LEARNING-AND-AI.md) for detailed limits and setup. Mobile camera access requires HTTPS; localhost on your desktop is not a phone-accessible deployment.

For everyday photo records, choose **My collection**, create a plant/seed/material profile, and use **Save observation**. Measurement fields are optional and user-defined. Use the issue record type to track a concern and record a manual review. This area is independent of lesson progress; it stores observations without automatic AI analysis.

## Manage your collection

The same **My collection** page has five sections:

1. **Records** keeps your existing profiles, photos, observations and measurements.
2. **Areas** creates a named grid (up to 12 × 12). Choose a plant or seed record, then tap an empty cell to place or move it. Tap an occupied cell to select its record and open its history. **Remove from layout** removes the placement without deleting the profile. Grid cells describe positions, not measured dimensions.
3. **Tasks** schedules your own reminder for a record, an area or the entire collection. Complete, cancel, edit or snooze a task by one hour; reopen it when needed. Deadlines display in your device's local time zone. Completion is shared within the workspace and is separate from private lesson progress.
4. **Materials** tracks stock and optionally links an existing material profile. Set a unit, current quantity, restock threshold and target. **Adjust stock** records a positive addition or negative usage with a note. The restock list suggests the difference between your target and current stock when the threshold is reached. Stock history records who made each adjustment.
5. **Projects** manages sites and grow projects. Add a site's name, location/address and notes. Create a project covering one or more sites, with optional start/target dates and a Planned, Active, Paused or Completed status. Project cards show assigned record/area/material counts and completed tasks. Status is set manually; it does not complete tasks or lessons.

Use **Filter by site** and **Filter by project** to focus Records, Areas, Tasks and Materials. New items inherit those filter selections. Existing items remain unassigned until you use **Assign site & project** on their detail or card. An item has at most one site and one project; a project may span multiple sites. The Projects overview shows all sites/projects, and its **Open site** / **Open project** buttons apply the corresponding collection filter.

Assigned linked records must agree on site/project. For example, a North-site plant cannot be placed in a South-site area. Remove an existing placement or adjust linked records before changing a conflicting assignment. You cannot remove a site from a project while records still use that site/project combination. Unassigned legacy records remain available under All sites/All projects; linking one does not implicitly relocate it. Opening a linked record clears collection filters so its history remains reachable. Existing links are preserved when editing a task or material under a narrower filter.

All sites and projects share workspace membership. Use separate workspaces when locations need separate access permissions. Task deadlines still display in the device's local time zone, and workspace reminder banners include tasks and restocks across all sites.

Use **Enable notifications** in Tasks for supported browsers. Keep the app open for its alerts. For reminders outside the app, choose **Calendar alarm** on a pending task and import the downloaded `.ics` file into your calendar. Calendar copies are independent: re-import after edits and update or remove the calendar event after completion/cancellation. Calendar notification delivery depends on the calendar app's settings.

If a shared record changes while you are editing, the server rejects the stale save. Close and reopen the editor to load the latest record before trying again.
