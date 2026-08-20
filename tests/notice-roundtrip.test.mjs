import test from "node:test";
import assert from "node:assert/strict";
import { operationsToCommandText, parseCommandText } from "../engine.js";
import { operationsToBlockRecords } from "../block_mapping.js";

test("legacy no-op commands remain lossless in Text and explicitly block Blockly conversion", () => {
  const source = 'callAPI("gemini")\ntestDialogue("안녕", "반가워")';
  const first = parseCommandText(source);
  assert.deepEqual(first.errors, []);
  const serialized = operationsToCommandText(first.operations);
  const second = parseCommandText(serialized);
  assert.deepEqual(second.operations, first.operations);
  assert.throws(() => operationsToBlockRecords(first.operations), /does not have a Blockly representation/);
});
