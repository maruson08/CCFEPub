import test from "node:test";
import assert from "node:assert/strict";
import { projectFilename } from "../project_ui.js";

test("export filename sanitizes filesystem-reserved characters", () => {
  assert.equal(projectFilename("Study: Assistant / 2026?"), "Study-Assistant-2026.ccfepub.json");
  assert.equal(projectFilename("  "), "ccfepub-project.ccfepub.json");
  assert.equal(projectFilename("CON<>:|?*"), "CON.ccfepub.json");
});
