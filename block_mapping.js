import { validateOperations } from "./project.js";

export class BlockConversionError extends Error {
  constructor(message, code = "block-conversion-error") {
    super(message);
    this.name = "BlockConversionError";
    this.code = code;
  }
}

const record = (type, fields = {}) => ({ type, fields });

export function operationToBlockRecord(operation) {
  const normalized = validateOperations([operation])[0];
  switch (normalized.type) {
    case "setName": return record("chatbot_set_name", { NAME: normalized.value });
    case "setRole": return record("chatbot_set_role", { ROLE: normalized.value });
    case "setPersonality": return record("chatbot_set_personality", { PERSONALITY: normalized.value });
    case "setTone": return record("chatbot_set_tone", { TONE: normalized.value });
    case "setDefaultReply": return record("chatbot_default_reply", { REPLY: normalized.value });
    case "setSafeReply": return record("chatbot_safe_reply", { REPLY: normalized.value });
    case "setLimitLength": return record("chatbot_limit_length", { LENGTH: String(normalized.value) });
    case "setUseEmoji": return record("chatbot_use_emoji", { USE: normalized.value ? "TRUE" : "FALSE" });
    case "blockPersonalInfo": return record("chatbot_block_personal_info");
    case "setSensitiveTopics": return record("chatbot_block_sensitive_topics", { TOPICS: JSON.stringify(normalized.topics) });
    case "addKnowledge": return record("chatbot_add_knowledge", { SUBJECT: normalized.subject, DESCRIPTION: normalized.description });
    case "addExample": return record("chatbot_add_example", { USER: normalized.user, ASSISTANT: normalized.assistant });
    case "addRule":
      return normalized.match === "exact"
        ? record("chatbot_when_says", { TRIGGER: normalized.trigger, REPLY: normalized.reply })
        : record("chatbot_when_includes", { KEYWORD: normalized.trigger, REPLY: normalized.reply });
    case "preview": return record("chatbot_show_system_prompt");
    case "start": return record("chatbot_start");
    default:
      throw new BlockConversionError(
        `Operation "${normalized.type}" does not have a Blockly representation.`,
        "unsupported-operation",
      );
  }
}

function parseTopics(value) {
  const source = String(value ?? "").trim();
  if (!source) return [];
  if (source.startsWith("[")) {
    try {
      const topics = JSON.parse(source);
      if (Array.isArray(topics) && topics.every((topic) => typeof topic === "string")) return topics;
    } catch { /* Fall through to the readable comma syntax. */ }
  }
  return source.split(",").map((topic) => topic.trim()).filter(Boolean);
}

export function blockRecordToOperation(block) {
  if (!block || typeof block !== "object" || typeof block.type !== "string") {
    throw new BlockConversionError("Block record is malformed.");
  }
  const fields = block.fields && typeof block.fields === "object" ? block.fields : {};
  const text = (name) => String(fields[name] ?? "");
  switch (block.type) {
    case "chatbot_set_name": return { type: "setName", value: text("NAME") };
    case "chatbot_set_role": return { type: "setRole", value: text("ROLE") };
    case "chatbot_set_personality": return { type: "setPersonality", value: text("PERSONALITY") };
    case "chatbot_set_tone": return { type: "setTone", value: text("TONE") };
    case "chatbot_default_reply": return { type: "setDefaultReply", value: text("REPLY") };
    case "chatbot_safe_reply": return { type: "setSafeReply", value: text("REPLY") };
    case "chatbot_limit_length": {
      const value = Number(fields.LENGTH);
      if (!Number.isInteger(value) || value <= 0) throw new BlockConversionError("Response length must be a positive integer.");
      return { type: "setLimitLength", value };
    }
    case "chatbot_use_emoji": return { type: "setUseEmoji", value: fields.USE === "TRUE" };
    case "chatbot_block_personal_info": return { type: "blockPersonalInfo" };
    case "chatbot_block_sensitive_topics": return { type: "setSensitiveTopics", topics: parseTopics(fields.TOPICS) };
    case "chatbot_add_knowledge": return { type: "addKnowledge", subject: text("SUBJECT"), description: text("DESCRIPTION") };
    case "chatbot_add_example": return { type: "addExample", user: text("USER"), assistant: text("ASSISTANT") };
    case "chatbot_when_says": return { type: "addRule", match: "exact", trigger: text("TRIGGER"), reply: text("REPLY") };
    case "chatbot_when_includes": return { type: "addRule", match: "includes", trigger: text("KEYWORD"), reply: text("REPLY") };
    case "chatbot_show_system_prompt": return { type: "preview" };
    case "chatbot_start": return { type: "start" };
    default:
      throw new BlockConversionError(`Unsupported Blockly block "${block.type}".`, "unsupported-block");
  }
}

export function operationsToBlockRecords(operations) {
  return validateOperations(operations).map(operationToBlockRecord);
}

export function blockRecordsToOperations(records) {
  if (!Array.isArray(records)) throw new BlockConversionError("Block records must be an array.");
  return validateOperations(records.map(blockRecordToOperation));
}
