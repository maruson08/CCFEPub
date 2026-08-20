import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

for (const page of ["index.html", "block.html"]) {
  test(`${page} exposes project files, inspector, and accessible mode navigation`, async () => {
    const html = await readFile(new URL(`../${page}`, import.meta.url), "utf8");
    assert.match(html, /id="exportProjectButton"/);
    assert.match(html, /id="importProjectInput"[^>]+type="file"/);
    assert.match(html, /for="importProjectInput"/);
    assert.match(html, /id="inspector"[^>]+aria-live="polite"/);
    assert.match(html, /aria-current="page"/);
    assert.match(html, /Project format v1/);
  });
}

test("Text and Block controllers use the shared canonical project key", async () => {
  const project = await readFile(new URL("../project.js", import.meta.url), "utf8");
  const text = await readFile(new URL("../script.js", import.meta.url), "utf8");
  const block = await readFile(new URL("../blockly_script.js", import.meta.url), "utf8");
  assert.match(project, /ccfepub\.project\.v1/);
  assert.match(text, /saveProject\(localStorage/);
  assert.match(block, /saveProject\(localStorage/);
  assert.doesNotMatch(`${text}\n${block}`, /localStorage\.setItem\(["']ccfepub\.(?:textCommands|blocklyWorkspace)/);
});

test("Blockly dependency failure is guarded before custom block registration", async () => {
  const blocks = await readFile(new URL("../blockly_blocks.js", import.meta.url), "utf8");
  const controller = await readFile(new URL("../blockly_script.js", import.meta.url), "utf8");
  assert.match(blocks, /typeof Blockly !== "undefined"/);
  assert.match(controller, /Block editor could not load Blockly/);
});
