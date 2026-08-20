import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requiredIds = [
  "runCommandsButton", "newProjectButton", "loadExampleButton", "importProjectInput",
  "exportProjectButton", "clearChatButton", "clearApiKey",
];

for (const [page, controller, navId] of [
  ["index.html", "script.js", "switchToBlock"],
  ["block.html", "blockly_script.js", "switchToText"],
]) {
  test(`${page} exposes and wires all release-candidate actions`, async () => {
    const [html, script] = await Promise.all([
      readFile(new URL(`../${page}`, import.meta.url), "utf8"),
      readFile(new URL(`../${controller}`, import.meta.url), "utf8"),
    ]);
    for (const id of [...requiredIds, navId]) {
      assert.match(html, new RegExp(`id=["']${id}["']`), `${id} missing from ${page}`);
      if (!["clearChatButton", "clearApiKey"].includes(id)) {
        assert.match(script, new RegExp(`#${id}`), `${id} not wired in ${controller}`);
      }
    }
    const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
    assert.match(app, /#clearChatButton/);
    assert.match(app, /#clearApiKey/);
  });
}
