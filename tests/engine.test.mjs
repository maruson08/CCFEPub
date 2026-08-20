import test from "node:test";
import assert from "node:assert/strict";
import {
  generateSystemPrompt,
  operationsToCommandText,
  parseCommandText,
  processOperations,
  resolveLocalResponse,
} from "../engine.js";

test("parses v1-compatible commands and preserves Unicode and quotes", () => {
  const source = `setName("I'm happy"); setRole('한국어 \"멘토\"')
whenUserSays('What\\'s your name?').reply('I\\'m fine')
whenUserIncludes("인사").reply("사용자가 \\"안녕\\"이라고 말했어요")
blockSensitiveTopics(["정치", "종교"])
addKnowledge("quote", "it's okay")
showSystemPrompt()
startChatbot()`;
  const result = parseCommandText(source);
  assert.deepEqual(result.errors, []);
  assert.equal(result.config.name, "I'm happy");
  assert.equal(result.config.role, '한국어 "멘토"');
  assert.equal(result.config.rules[0].trigger, "What's your name?");
  assert.equal(result.config.rules[0].reply, "I'm fine");
  assert.equal(result.config.rules[1].reply, '사용자가 "안녕"이라고 말했어요');
  assert.deepEqual(result.config.sensitiveTopics, ["정치", "종교"]);
  assert.equal(result.config.knowledge[0].description, "it's okay");
  assert.deepEqual(result.actions, { preview: true, start: true });
});

test("collects multiple parser errors with line numbers", () => {
  const result = parseCommandText(`setNames("잘못된 이름")
setName()
setTone("정상")`);
  assert.equal(result.errors.length, 2);
  assert.deepEqual(result.errors.map((error) => error.line), [1, 2]);
  assert.match(result.errors[0].message, /알 수 없는 명령어/);
  assert.equal(result.config.tone, "정상");
});

test("supports legacy string topics and optional semicolons", () => {
  const result = parseCommandText("blockSensitiveTopics('정치 종교'); useEmoji(False); limitLength(60);");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.config.sensitiveTopics, ["정치", "종교"]);
  assert.equal(result.config.useEmoji, false);
  assert.equal(result.config.limitLength, 60);
});

test("serialized block operations round-trip through the text parser", () => {
  const operations = [
    { type: "setName", value: "I'm 블록지니" },
    { type: "addRule", match: "exact", trigger: '"hello"', reply: "What's this?" },
    { type: "addKnowledge", subject: "언어", description: "한국어" },
    { type: "setSensitiveTopics", topics: ["정치", "종교"] },
    { type: "preview" },
  ];
  const direct = processOperations(operations);
  const parsed = parseCommandText(operationsToCommandText(operations));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.config, direct.config);
  assert.deepEqual(parsed.actions, direct.actions);
});

test("system prompt never contains an API key and local safety/rules win", () => {
  const { config } = parseCommandText(`setName("안전봇")
whenUserSays("안녕").reply("반가워요")
blockPersonalInfo()
blockSensitiveTopics(["비밀"])
safeReply("답할 수 없어요")`);
  const prompt = generateSystemPrompt(config);
  assert.match(prompt, /안전봇/);
  assert.doesNotMatch(prompt, /API.?key/i);
  assert.equal(resolveLocalResponse(config, "안녕"), "반가워요");
  assert.equal(resolveLocalResponse(config, "010-1234-5678"), "답할 수 없어요");
  assert.equal(resolveLocalResponse(config, "비밀 이야기"), "답할 수 없어요");
});
