import test from "node:test";
import assert from "node:assert/strict";
import { parseCommandText, operationsToCommandText } from "../engine.js";
import {
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  PROJECT_STORAGE_KEY,
  LEGACY_TEXT_STORAGE_KEY,
  createProject,
  migrateLegacyProject,
  parseProjectJson,
  serializeProject,
  updateProject,
} from "../project.js";
import { blockRecordsToOperations, operationsToBlockRecords } from "../block_mapping.js";

const source = `setName("It's called \\"CCFEPub\\"")
setRole("backslash \\\\ test")
whenUserSays("What's your name?").reply("I'm fine")
whenUserIncludes("\\\"hello\\\"").reply("사용자가 \\\"안녕\\\"이라고 말하면")
addKnowledge("인사", "안녕하세요 / こんにちは / emoji 😀")
blockSensitiveTopics(["정치", "성적인 농담"])
showSystemPrompt()
startChatbot()`;

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test("Text operations serialize and parse without semantic loss", () => {
  const parsed = parseCommandText(source);
  assert.deepEqual(parsed.errors, []);
  const reparsed = parseCommandText(operationsToCommandText(parsed.operations));
  assert.deepEqual(reparsed.errors, []);
  assert.deepEqual(reparsed.operations, parsed.operations);
});

test("operations round-trip through Blockly records", () => {
  const operations = parseCommandText(source).operations;
  assert.deepEqual(blockRecordsToOperations(operationsToBlockRecords(operations)), operations);
});

test("Text to Blocks to Text preserves quoted multilingual strings", () => {
  const first = parseCommandText(source).operations;
  const throughBlocks = blockRecordsToOperations(operationsToBlockRecords(first));
  const final = parseCommandText(operationsToCommandText(throughBlocks));
  assert.deepEqual(final.errors, []);
  assert.deepEqual(final.operations, first);
});

test("project JSON export/import preserves canonical state and excludes credentials", () => {
  const operations = parseCommandText(source).operations;
  const project = createProject(operations, { now: "2026-08-20T00:00:00.000Z" });
  const json = serializeProject(project);
  assert.deepEqual(parseProjectJson(json), project);
  assert.doesNotMatch(json, /apiKey|sessionStorage|test-key-never-logged/i);
  assert.equal(project.format, PROJECT_FORMAT);
  assert.equal(project.formatVersion, PROJECT_FORMAT_VERSION);
});

test("project validation reports invalid JSON, wrong format, newer version, and operations", () => {
  assert.throws(() => parseProjectJson("{"), (error) => error.code === "invalid-json");
  assert.throws(() => parseProjectJson('{"format":"other","formatVersion":1,"operations":[]}'), (error) => error.code === "wrong-format");
  assert.throws(
    () => parseProjectJson(JSON.stringify({ format: PROJECT_FORMAT, formatVersion: 99, operations: [] })),
    (error) => error.code === "newer-version",
  );
  assert.throws(
    () => parseProjectJson(JSON.stringify({ format: PROJECT_FORMAT, formatVersion: 1, operations: [{ type: "future" }] })),
    (error) => error.code === "unsupported-operation",
  );
});

test("project updates retain creation time and refresh canonical name", () => {
  const first = createProject([{ type: "setName", value: "First" }], { now: "2026-01-01T00:00:00.000Z" });
  const next = updateProject(first, [{ type: "setName", value: "Second" }], "block", "2026-02-01T00:00:00.000Z");
  assert.equal(next.metadata.name, "Second");
  assert.equal(next.metadata.createdAt, first.metadata.createdAt);
  assert.equal(next.metadata.updatedAt, "2026-02-01T00:00:00.000Z");
  assert.equal(next.editorMode, "block");
});

test("legacy text persistence migrates to project format v1", () => {
  const storage = new MemoryStorage({ [LEGACY_TEXT_STORAGE_KEY]: source });
  const result = migrateLegacyProject(storage, { parseLegacyText: parseCommandText, now: "2026-08-20T00:00:00.000Z" });
  assert.equal(result.migratedFrom, "text");
  assert.deepEqual(result.project.operations, parseCommandText(source).operations);
  assert.equal(parseProjectJson(storage.getItem(PROJECT_STORAGE_KEY)).formatVersion, 1);
});

test("legacy Blockly migration accepts a structural converter", () => {
  const operations = [{ type: "setName", value: "Legacy Block Bot" }];
  const storage = new MemoryStorage({ "ccfepub.blocklyWorkspace.v2": JSON.stringify({ format: "json", data: {} }) });
  const result = migrateLegacyProject(storage, {
    preferredMode: "block",
    convertLegacyBlockly: () => operations,
    now: "2026-08-20T00:00:00.000Z",
  });
  assert.equal(result.migratedFrom, "block");
  assert.deepEqual(result.project.operations, operations);
});
