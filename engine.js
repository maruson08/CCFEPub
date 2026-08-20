export const DEFAULT_CONFIG = Object.freeze({
  name: "AI 친구",
  role: "다정하고 호기심 많은 대화 상대",
  personality: "친절하고 때로는 농담을 던지는",
  tone: "편안하고 친구같은 말투",
  limitLength: null,
  useEmoji: false,
  defaultReply:
    "죄송해요, 그 말은 잘 모르겠어요. 다른 주제로 이야기해 주시겠어요?",
  knowledge: [],
  rules: [],
  examples: [],
  blockPersonalInfo: false,
  sensitiveTopics: [],
  safeReply: "이 주제는 제가 대답할 수 없는 민감한 주제예요.",
});

export function createDefaultConfig() {
  return {
    ...DEFAULT_CONFIG,
    knowledge: [],
    rules: [],
    examples: [],
    sensitiveTopics: [],
  };
}

function splitStatements(source) {
  const statements = [];
  let buffer = "";
  let line = 1;
  let startLine = 1;
  let quote = null;
  let escaped = false;
  let depth = 0;
  let comment = false;

  const commit = () => {
    const text = buffer.trim();
    if (text) statements.push({ text, line: startLine });
    buffer = "";
    startLine = line;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (comment) {
      if (char === "\n") {
        comment = false;
        commit();
        line += 1;
        startLine = line;
      }
      continue;
    }

    if (quote) {
      buffer += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      if (char === "\n") line += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      comment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if ((char === ";" || char === "\n") && depth === 0) {
      commit();
      if (char === "\n") {
        line += 1;
        startLine = line;
      }
      continue;
    }
    buffer += char;
  }
  commit();
  return statements;
}

function splitArguments(source) {
  const parts = [];
  let buffer = "";
  let quote = null;
  let escaped = false;
  let depth = 0;

  for (const char of source) {
    if (quote) {
      buffer += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
    } else if (char === "[") {
      depth += 1;
      buffer += char;
    } else if (char === "]") {
      depth -= 1;
      buffer += char;
    } else if (char === "," && depth === 0) {
      parts.push(buffer.trim());
      buffer = "";
    } else {
      buffer += char;
    }
  }
  if (buffer.trim() || source.trim()) parts.push(buffer.trim());
  return parts;
}

function parseString(source) {
  const quote = source[0];
  if ((quote !== '"' && quote !== "'") || source.at(-1) !== quote) {
    throw new Error("문자열은 따옴표로 감싸야 합니다");
  }
  let result = "";
  for (let index = 1; index < source.length - 1; index += 1) {
    const char = source[index];
    if (char !== "\\") {
      result += char;
      continue;
    }
    index += 1;
    if (index >= source.length - 1) throw new Error("잘못된 escape 문자열입니다");
    const escaped = source[index];
    const escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
    result += escapes[escaped] ?? escaped;
  }
  return result;
}

function parseValue(source) {
  const value = source.trim();
  if (!value) throw new Error("인수가 비어 있습니다");
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    return inner ? splitArguments(inner).map(parseValue) : [];
  }
  if (value.startsWith('"') || value.startsWith("'")) return parseString(value);
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (/^(?:True|true)$/.test(value)) return true;
  if (/^(?:False|false)$/.test(value)) return false;
  throw new Error(`지원하지 않는 값 "${value}"`);
}

function readCall(text) {
  const nameMatch = text.match(/^([A-Za-z][A-Za-z0-9]*)\s*\(/);
  if (!nameMatch) throw new Error("명령어 형식은 name(...) 이어야 합니다");
  const name = nameMatch[1];
  const openIndex = text.indexOf("(", nameMatch[0].length - 1);
  let quote = null;
  let escaped = false;
  let depth = 0;
  let closeIndex = -1;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        closeIndex = index;
        break;
      }
    }
  }
  if (closeIndex < 0) throw new Error("닫는 괄호가 없습니다");
  const rawArgs = text.slice(openIndex + 1, closeIndex).trim();
  const args = rawArgs ? splitArguments(rawArgs).map(parseValue) : [];
  return { name, args, tail: text.slice(closeIndex + 1).trim() };
}

function expectArgs(name, args, count, types) {
  if (args.length !== count) throw new Error(`${name} 명령어에는 인수 ${count}개가 필요합니다`);
  types.forEach((type, index) => {
    if (type === "array") {
      if (!Array.isArray(args[index]) || args[index].some((item) => typeof item !== "string")) {
        throw new Error(`${name}의 ${index + 1}번째 인수는 문자열 배열이어야 합니다`);
      }
    } else if (typeof args[index] !== type) {
      throw new Error(`${name}의 ${index + 1}번째 인수는 ${type}이어야 합니다`);
    }
  });
}

function commandToOperation(text) {
  const call = readCall(text);
  const stringSetters = {
    setName: "setName",
    setRole: "setRole",
    setPersonality: "setPersonality",
    setTone: "setTone",
    defaultReply: "setDefaultReply",
    safeReply: "setSafeReply",
  };

  if (call.name === "whenUserSays" || call.name === "whenUserIncludes") {
    expectArgs(call.name, call.args, 1, ["string"]);
    const reply = readCall(call.tail.startsWith(".") ? call.tail.slice(1) : call.tail);
    if (reply.name !== "reply" || reply.tail) throw new Error(`${call.name} 뒤에는 .reply(...)가 필요합니다`);
    expectArgs("reply", reply.args, 1, ["string"]);
    return {
      type: "addRule",
      match: call.name === "whenUserSays" ? "exact" : "includes",
      trigger: call.args[0],
      reply: reply.args[0],
    };
  }
  if (call.tail) throw new Error(`명령어 뒤에 해석할 수 없는 내용이 있습니다: ${call.tail}`);
  if (stringSetters[call.name]) {
    expectArgs(call.name, call.args, 1, ["string"]);
    return { type: stringSetters[call.name], value: call.args[0] };
  }
  if (call.name === "limitLength") {
    expectArgs(call.name, call.args, 1, ["number"]);
    if (!Number.isInteger(call.args[0]) || call.args[0] <= 0) throw new Error("limitLength는 양의 정수여야 합니다");
    return { type: "setLimitLength", value: call.args[0] };
  }
  if (call.name === "useEmoji") {
    expectArgs(call.name, call.args, 1, ["boolean"]);
    return { type: "setUseEmoji", value: call.args[0] };
  }
  if (call.name === "blockPersonalInfo") {
    expectArgs(call.name, call.args, 0, []);
    return { type: "blockPersonalInfo" };
  }
  if (call.name === "blockSensitiveTopics") {
    if (call.args.length !== 1) throw new Error("blockSensitiveTopics 명령어에는 인수 1개가 필요합니다");
    const topics = Array.isArray(call.args[0])
      ? call.args[0]
      : typeof call.args[0] === "string"
        ? call.args[0].split(/[,\s]+/).filter(Boolean)
        : null;
    if (!topics || topics.some((topic) => typeof topic !== "string")) {
      throw new Error("blockSensitiveTopics는 문자열 또는 문자열 배열을 사용해야 합니다");
    }
    return { type: "setSensitiveTopics", topics };
  }
  if (call.name === "addKnowledge") {
    expectArgs(call.name, call.args, 2, ["string", "string"]);
    return { type: "addKnowledge", subject: call.args[0], description: call.args[1] };
  }
  if (call.name === "addExample") {
    expectArgs(call.name, call.args, 2, ["string", "string"]);
    return { type: "addExample", user: call.args[0], assistant: call.args[1] };
  }
  if (call.name === "showSystemPrompt" || call.name === "startChatbot") {
    expectArgs(call.name, call.args, 0, []);
    return { type: call.name === "showSystemPrompt" ? "preview" : "start" };
  }
  if (call.name === "callAPI" || call.name === "testDialogue") {
    return {
      type: "notice",
      command: text,
      message: `${call.name}은 현재 웹 앱에서 직접 실행되지 않습니다.`,
    };
  }
  throw new Error(`알 수 없는 명령어 "${call.name}"`);
}

export function processOperations(operations) {
  const config = createDefaultConfig();
  const actions = { preview: false, start: false };
  const notices = [];

  for (const operation of operations) {
    switch (operation.type) {
      case "setName": config.name = operation.value; break;
      case "setRole": config.role = operation.value; break;
      case "setPersonality": config.personality = operation.value; break;
      case "setTone": config.tone = operation.value; break;
      case "setDefaultReply": config.defaultReply = operation.value; break;
      case "setSafeReply": config.safeReply = operation.value; break;
      case "setLimitLength": config.limitLength = operation.value; break;
      case "setUseEmoji": config.useEmoji = operation.value; break;
      case "blockPersonalInfo": config.blockPersonalInfo = true; break;
      case "setSensitiveTopics": config.sensitiveTopics = [...operation.topics]; break;
      case "addKnowledge": config.knowledge.push({ subject: operation.subject, description: operation.description }); break;
      case "addExample": config.examples.push({ user: operation.user, assistant: operation.assistant }); break;
      case "addRule": config.rules.push({ match: operation.match, trigger: operation.trigger, reply: operation.reply }); break;
      case "preview": actions.preview = true; break;
      case "start": actions.start = true; break;
      case "notice": notices.push(operation.message); break;
      default: notices.push(`알 수 없는 내부 작업 "${operation.type}"을 건너뛰었습니다.`);
    }
  }
  return { config, actions, notices };
}

export function parseCommandText(source) {
  const operations = [];
  const errors = [];
  for (const statement of splitStatements(String(source))) {
    try {
      operations.push(commandToOperation(statement.text));
    } catch (error) {
      errors.push({ line: statement.line, command: statement.text, message: error.message });
    }
  }
  return { operations, errors, ...processOperations(operations) };
}

const quote = (value) => JSON.stringify(value);

export function operationToCommand(operation) {
  switch (operation.type) {
    case "setName": return `setName(${quote(operation.value)})`;
    case "setRole": return `setRole(${quote(operation.value)})`;
    case "setPersonality": return `setPersonality(${quote(operation.value)})`;
    case "setTone": return `setTone(${quote(operation.value)})`;
    case "setDefaultReply": return `defaultReply(${quote(operation.value)})`;
    case "setSafeReply": return `safeReply(${quote(operation.value)})`;
    case "setLimitLength": return `limitLength(${operation.value})`;
    case "setUseEmoji": return `useEmoji(${operation.value ? "True" : "False"})`;
    case "blockPersonalInfo": return "blockPersonalInfo()";
    case "setSensitiveTopics": return `blockSensitiveTopics(${JSON.stringify(operation.topics)})`;
    case "addKnowledge": return `addKnowledge(${quote(operation.subject)}, ${quote(operation.description)})`;
    case "addExample": return `addExample(${quote(operation.user)}, ${quote(operation.assistant)})`;
    case "addRule": {
      const name = operation.match === "exact" ? "whenUserSays" : "whenUserIncludes";
      return `${name}(${quote(operation.trigger)}).reply(${quote(operation.reply)})`;
    }
    case "preview": return "showSystemPrompt()";
    case "start": return "startChatbot()";
    case "notice": return operation.command;
    default: throw new Error(`Operation "${operation.type}" cannot be serialized to text.`);
  }
}

export function operationsToCommandText(operations) {
  return operations.map(operationToCommand).filter(Boolean).join("\n");
}

export function generateSystemPrompt(config) {
  const parts = [
    "# 당신의 역할과 페르소나",
    `- 이름: ${config.name}`,
    `- 역할: ${config.role}`,
    `- 성격: ${config.personality}`,
    `- 말투: ${config.tone}`,
    "- 기본 지침: 위 설정을 일관되게 지켜서 응답합니다.",
  ];
  if (config.rules.length) {
    parts.push("", "# 특정 반응 규칙");
    for (const rule of config.rules) {
      const condition = rule.match === "exact"
        ? `사용자가 ${quote(rule.trigger)}라고 정확히 입력하면`
        : `사용자 입력에 ${quote(rule.trigger)}가 포함되어 있으면`;
      parts.push(`- ${condition}: ${quote(rule.reply)}라고 응답합니다.`);
    }
  }
  if (config.knowledge.length) {
    parts.push("", "# 추가 지식");
    for (const item of config.knowledge) parts.push(`- ${item.subject}: ${item.description}`);
  }
  parts.push("", "# 응답 지침");
  if (config.limitLength) parts.push(`- 응답은 최대 ${config.limitLength}자를 넘지 않습니다.`);
  parts.push(`- 이모지는 ${config.useEmoji ? "자연스럽게 사용합니다" : "사용하지 않습니다"}.`);
  if (config.blockPersonalInfo || config.sensitiveTopics.length) {
    parts.push("", "# 안전 지침");
    if (config.blockPersonalInfo) parts.push(`- 개인정보가 포함된 요청은 ${quote(config.safeReply)}라고 거절합니다.`);
    if (config.sensitiveTopics.length) {
      parts.push(`- ${config.sensitiveTopics.join(", ")} 주제는 ${quote(config.safeReply)}라고 거절합니다.`);
    }
  }
  parts.push("", "# 기본 답변", `- 대답할 수 없는 입력에는 ${quote(config.defaultReply)}라고 응답합니다.`);
  if (config.examples.length) {
    parts.push("", "# 예시 대화");
    for (const example of config.examples) parts.push(`User: ${example.user}\nAssistant: ${example.assistant}`);
  }
  return parts.join("\n");
}

export function resolveLocalResponse(config, message) {
  const pii = /\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4}|\d{4}[-\s]?\d{4}[-\s]?\d{4}|\d+번지/i;
  if (config.blockPersonalInfo && pii.test(message)) return config.safeReply;
  const lowered = message.toLocaleLowerCase();
  if (config.sensitiveTopics.some((topic) => lowered.includes(topic.toLocaleLowerCase()))) return config.safeReply;
  const rule = config.rules.find((candidate) =>
    candidate.match === "exact" ? message === candidate.trigger : message.includes(candidate.trigger));
  return rule?.reply ?? null;
}
