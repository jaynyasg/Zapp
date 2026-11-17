<!-- generated-by: gsd-doc-writer -->

# Getting started

1. Install Node.js 24.15 or later. Run `npm ci`, `npm run build`, then `npm start` in the repository.
2. Open http://127.0.0.1:3001. Choose **Create an account**. Use a password of at least 12 characters.
3. Name a workspace. Choose Home for personal records or Facility for your shared SOP workspace.
4. Choose **Upload media**, select a supported file and enter a title. The analysis checkbox explains that content is sent to Anthropic. Clear it to store only.
5. If AI is configured and funded, watch the item progress from Queued to Analyzing to Draft. Otherwise the original remains available. Open a failed item to see its error and retry when resolved.
6. Open **Review generated draft**. Check source evidence, edit the checklist and gaps, then submit for review. An owner can approve it.
7. In **Team & training**, add a person who has already registered, select an approved procedure, and assign a due date. The assigned person opens the record and acknowledges it.
8. Use Journal for observations and Activity for the recorded history. Use the workspace selector or New workspace to separate teams and personal records.

Source documents are TXT or Markdown in this release; PDF and Office document ingestion are not implemented. Photo/video playback uses browser-supported formats. For clips, visual sampling can miss actions and speech is not analyzed. Generated drafts require review.

No email account recovery is implemented. Keep your password securely. Hosting and email delivery are not provisioned by running the local app.
