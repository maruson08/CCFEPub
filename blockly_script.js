import { GoogleGenAI } from "https://cdn.jsdelivr.net/npm/@google/genai@1.24.0/dist/web/index.mjs";

const API_KEY = prompt(
  "Enter your GEMINI API KEY:",
  "YOUR_GEMINI_API_KEY_HERE"
);

let chatSession = null;
let aiClient = null;

const runCommandsButton = document.getElementById("runCommandsButton");
const codeOutput = document.getElementById("codeOutput");
const outputLog = document.getElementById("outputLog");
const chatContainer = document.getElementById("chatContainer");
const chatbotNameSpan = document.getElementById("chatbotName");
const chatLog = document.getElementById("chatLog");
const userInput = document.getElementById("userInput");
const sendMessageButton = document.getElementById("sendMessageButton");

let config = {
  name: "AI 친구",
  role: "다정하고 호기심 많은 대화 상대",
  personality: "친절하고 때로는 농담을 던지는",
  tone: "편안하고 친구같은 말투",
  limitLength: null,
  useEmoji: false,
  defaultReply:
    "죄송해요, 그 말은 잘 모르겠어요. 다른 주제로 이야기해 주시겠어요?",
  knowledgeBase: null,
  examples: [],
  blockPersonalInfo: false,
  sensitiveTopics: [],
  safeReplyMsg: "이 주제는 제가 대답할 수 없는 민감한 주제예요.",
};

let workspace;

document.addEventListener("DOMContentLoaded", () => {
  const toolbox = document.getElementById("toolbox");

  if (typeof Blockly === "undefined" || !toolbox) {
    outputLog.textContent =
      "ERROR: Blockly 라이브러리 또는 툴박스 정의(blockly_blocks.js) 로드 실패.";
    return;
  }

  workspace = Blockly.inject("blocklyDiv", {
    toolbox: toolbox,
    scrollbars: true,
    horizontalLayout: false,
    toolboxPosition: "start",
    trashcan: true,
  });

  loadInitialBlocks();
});

runCommandsButton.addEventListener("click", () => {
  const code = Blockly.JavaScript.workspaceToCode(workspace);
  codeOutput.textContent = code;

  const commands = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  parseAndRunCommands(commands);
});

sendMessageButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !userInput.disabled) {
    sendMessage();
  }
});

loadInitialBlocks();

function loadInitialBlocks() {
  const initialXmlText = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="chatbot_set_name" x="20" y="20">
    <value name="NAME">
      <block type="text">
        <field name="TEXT">블록지니</field>
      </block>
    </value>
    <next>
      <block type="chatbot_set_role">
        <value name="ROLE">
          <block type="text">
            <field name="TEXT">친절한 코딩 멘토</field>
          </block>
        </value>
        <next>
          <block type="chatbot_when_says">
            <value name="TRIGGER">
              <block type="text">
                <field name="TEXT">안녕</field>
              </block>
            </value>
            <value name="REPLY">
              <block type="text">
                <field name="TEXT">안녕하세요! 블록 코딩 시작해 볼까요? 😊</field>
              </block>
            </value>
            <next>
              <block type="chatbot_start"></block>
            </next>
          </block>
        </next>
      </block>
    </next>
</xml>
    `;

  const parser = new DOMParser();
  const xmlDom = parser.parseFromString(initialXmlText, "text/xml");

  Blockly.Xml.domToWorkspace(xmlDom.documentElement, workspace);
  chatbotNameSpan.textContent = config.name;
}

function generateSystemPrompt() {
  let promptParts = [];
  promptParts.push(`
# 당신의 역할과 페르소나 (Chatbot Personality)
- 이름: ${config.name}
- 역할: ${config.role}
- 성격: ${config.personality}
- 말투: ${config.tone}
- 기본 지침: 위에 설정된 이름, 역할, 성격, 말투를 엄격하게 지켜서 응답합니다.`);

  if (config.rules.length > 0) {
    promptParts.push("\n# 특정 반응 규칙 (이 규칙을 최우선으로 적용하세요)");
    config.rules.forEach((rule) => {
      if (rule.type === "exact")
        promptParts.push(
          `- 사용자가 '${rule.trigger}'라고 정확히 입력하면: '${rule.reply}'라고 응답합니다. (이 규칙은 챗봇 엔진이 최우선으로 처리합니다)`
        );
      else if (rule.type === "keyword")
        promptParts.push(
          `- 사용자 입력에 '${rule.trigger}'가 포함되어 있으면: '${rule.reply}'라고 응답합니다. (이 규칙은 챗봇 엔진이 최우선으로 처리합니다)`
        );
    });
  }

  if (config.knowledgeBase) {
    promptParts.push("\n# 추가 지식 (대화 시 항상 참조하세요)");
    promptParts.push(config.knowledgeBase);
  }

  promptParts.push("\n# 응답 제한 사항");
  if (config.limitLength) {
    promptParts.push(
      `- 응답은 최대 ${config.limitLength}자를 넘지 않도록 합니다.`
    );
  }
  if (config.useEmoji) {
    promptParts.push("- 응답에 이모지를 사용하여 감정을 표현하세요.");
  } else {
    promptParts.push("- 응답에 이모지를 사용하지 마세요.");
  }

  if (config.blockPersonalInfo || config.sensitiveTopics.length > 0) {
    promptParts.push("\n# 안전 지침");
    if (config.blockPersonalInfo) {
      promptParts.push(
        `- 전화번호, 주소, 이름 등 개인정보와 관련된 질문이나 응답을 엄격히 금지합니다. 답변: '${config.safeReplyMsg}'`
      );
    }
    if (config.sensitiveTopics.length > 0) {
      promptParts.push(
        `- ${config.sensitiveTopics.join(
          ", "
        )} 주제에 대한 응답은 거절해야 합니다. 거절 시 답변: '${
          config.safeReplyMsg
        }'`
      );
    }
  }

  promptParts.push(
    `\n# 기본 답변: 위의 규칙이나 지식, 안전 지침에 해당하지 않는 일반적인 질문에 대해서는 자연스럽게 대화하고, 도저히 대답할 수 없는 입력에 대해서는 '${config.defaultReply}'라고 응답합니다.`
  );

  if (config.examples.length > 0) {
    promptParts.push("\n# 예시 대화 (응답 스타일을 학습하세요)");
    config.examples.forEach((ex) => {
      promptParts.push(`User: ${ex.user}\nAssistant: ${ex.assistant}`);
    });
  }

  return promptParts.join("\n");
}

function parseAndRunCommands(commands) {
  let log = outputLog.textContent + "\n\n--- 명령어 실행 시작 ---\n";
  let startChatbotCalled = false;

  const QUOTE = "['\"]";
  const patterns = {
    setName: new RegExp(`setName\\(${QUOTE}(.+?)${QUOTE}\\)`),
    setRole: new RegExp(`setRole\\(${QUOTE}(.+?)${QUOTE}\\)`),
    setPersonality: new RegExp(`setPersonality\\(${QUOTE}(.+?)${QUOTE}\\)`),
    setTone: new RegExp(`setTone\\(${QUOTE}(.+?)${QUOTE}\\)`),
    whenUserSays: new RegExp(
      `${QUOTE}(.+?)${QUOTE}\\.reply\\(${QUOTE}(.+?)${QUOTE}\\)`
    ),
    whenUserIncludes: new RegExp(
      `whenUserIncludes\\(${QUOTE}(.+?)${QUOTE}\\)\\.reply\\(${QUOTE}(.+?)${QUOTE}\\)`
    ),
    defaultReply: new RegExp(`defaultReply\\(${QUOTE}(.+?)${QUOTE}\\)`),
    limitLength: /limitLength\((\d+)\)/,
    useEmoji: /useEmoji\((True|False)\)/,
    blockPersonalInfo: /blockPersonalInfo\(\)/,
    blockSensitiveTopics: new RegExp(
      `blockSensitiveTopics\\(${QUOTE}(.+?)${QUOTE}\\)`
    ),
    safeReply: new RegExp(`safeReply\\(${QUOTE}(.+?)${QUOTE}\\)`),
    addKnowledge: new RegExp(
      `addKnowledge\\(${QUOTE}(.+?)${QUOTE},\\s*${QUOTE}(.+?)${QUOTE}\\)`
    ),
    addExample: new RegExp(
      `addExample\\(${QUOTE}(.+?)${QUOTE},\\s*${QUOTE}(.+?)${QUOTE}\\)`
    ),
    showSystemPrompt: /showSystemPrompt\(\)/,
  };

  config = {
    name: "AI 친구",
    role: "다정하고 호기심 많은 대화 상대",
    personality: "친절하고 때로는 농담을 던지는",
    tone: "편안하고 친구같은 말투",
    limitLength: null,
    useEmoji: false,
    defaultReply:
      "죄송해요, 그 말은 잘 모르겠어요. 다른 주제로 이야기해 주시겠어요?",
    knowledgeBase: null,
    rules: [],
    examples: [],
    blockPersonalInfo: false,
    sensitiveTopics: [],
    safeReplyMsg: "이 주제는 제가 대답할 수 없는 민감한 주제예요.",
  };

  commands.forEach((cmdLine) => {
    cmdLine = cmdLine.trim();
    if (!cmdLine) return;
    log += `> ${cmdLine}\n`;
    let result = `  -> ERROR: 알 수 없는 명령어 또는 구문 오류`;
    let match;

    if ((match = cmdLine.match(patterns.setName))) {
      config.name = match[1];
      result = `  -> 이름 설정 완료: ${config.name}`;
      chatbotNameSpan.textContent = config.name;
    } else if ((match = cmdLine.match(patterns.setRole))) {
      config.role = match[1];
      result = `  -> 역할 설정 완료: ${config.role}`;
    } else if ((match = cmdLine.match(patterns.setPersonality))) {
      config.personality = match[1];
      result = `  -> 성격 설정 완료: ${config.personality}`;
    } else if ((match = cmdLine.match(patterns.setTone))) {
      config.tone = match[1];
      result = `  -> 말투 설정 완료: ${config.tone}`;
    } else if ((match = cmdLine.match(patterns.whenUserSays))) {
      const [_, trigger, reply] = match;
      config.rules.push({ trigger, reply, type: "exact" });
      result = `  -> 정확 일치 규칙 추가: '${trigger}'`;
    } else if ((match = cmdLine.match(patterns.whenUserIncludes))) {
      const [_, keyword, reply] = match;
      config.rules.push({ trigger: keyword, reply: reply, type: "keyword" });
      result = `  -> 키워드 포함 규칙 추가: '${keyword}'`;
    } else if ((match = cmdLine.match(patterns.defaultReply))) {
      config.defaultReply = match[1];
      result = `  -> 기본 답변 설정 완료`;
    } else if ((match = cmdLine.match(patterns.limitLength))) {
      config.limitLength = parseInt(match[1]);
      result = `  -> 글자 수 제한 설정 완료: ${config.limitLength}자`;
    } else if ((match = cmdLine.match(patterns.useEmoji))) {
      config.useEmoji = match[1] === "True";
      result = `  -> 이모지 사용 설정 완료: ${config.useEmoji}`;
    } else if ((match = cmdLine.match(patterns.blockPersonalInfo))) {
      config.blockPersonalInfo = true;
      result = `  -> 개인정보 차단 설정 완료`;
    } else if ((match = cmdLine.match(patterns.blockSensitiveTopics))) {
      config.sensitiveTopics = match[1]
        .split(/\s+/)
        .filter((t) => t.length > 0);
      result = `  -> 민감 주제 차단 설정 완료: ${config.sensitiveTopics.join(
        ", "
      )}`;
    } else if ((match = cmdLine.match(patterns.safeReply))) {
      config.safeReplyMsg = match[1];
      result = `  -> 거절 응답 설정 완료`;
    } else if ((match = cmdLine.match(patterns.addKnowledge))) {
      config.knowledgeBase += `\n- 주제: ${match[1]}, 설명: ${match[2]}`;
      result = `  -> 지식 추가 완료: ${match[1]}`;
    } else if ((match = cmdLine.match(patterns.addExample))) {
      config.examples.push({ user: match[1], assistant: match[2] });
      result = `  -> 예시 대화 추가 완료`;
    } else if ((match = cmdLine.match(patterns.showSystemPrompt))) {
      outputLog.textContent = log + "\n" + generateSystemPrompt() + "\n";
      result = `  -> 시스템 프롬프트 출력 완료. (위 로그 확인)`;
      log = outputLog.textContent;
    } else if (cmdLine === "startChatbot();") {
      startChatbotCalled = true;
      result = `  -> startChatbot: 설정이 완료되었습니다. 대화를 시작합니다.`;
    }

    if (
      result.includes("ERROR") &&
      cmdLine !== "startChatbot();" &&
      cmdLine !== "showSystemPrompt();"
    ) {
      log += `${result}\n`;
    } else if (!result.includes("ERROR") && cmdLine !== "showSystemPrompt();") {
      log += `${result}\n`;
    }
  });
  outputLog.textContent = log;
  if (startChatbotCalled) startChatbotExperience();
}

function startChatbotExperience() {
  if (API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    alert("ERROR: Gemini API Key를 설정해야 챗봇을 시작할 수 있습니다.");
    return;
  }

  chatContainer.classList.remove("hidden");
  userInput.disabled = false;
  sendMessageButton.disabled = false;
  chatLog.innerHTML = `<div class="message assistant">안녕하세요! 저는 ${config.name}입니다. 저를 어떻게 만드셨나요? 😊</div>`;
  userInput.focus();

  try {
    if (typeof GoogleGenAI === "undefined") {
      throw new Error(
        "GoogleGenAI class not found. Check network connection and script.js import."
      );
    }

    aiClient = new GoogleGenAI({ apiKey: API_KEY });

    const systemPrompt = generateSystemPrompt();

    chatSession = aiClient.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
    });
  } catch (e) {
    chatLog.innerHTML += `<div class="message assistant">ERROR: 챗봇 초기화에 실패했습니다. API 키와 설정을 확인해 주세요. 상세 오류: ${e.message}</div>`;
    console.error("Chatbot initialization error:", e);
    userInput.disabled = true;
    sendMessageButton.disabled = true;
  }
}

async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage || !chatSession) return;

  appendMessage(userMessage, "user");
  userInput.value = "";
  userInput.disabled = true;
  sendMessageButton.disabled = true;

  let ruleMatchFound = false;
  for (const rule of config.rules) {
    if (rule.type === "exact" && userMessage === rule.trigger) {
      appendMessage(rule.reply, "assistant");
      ruleMatchFound = true;
      break;
    }
    if (rule.type === "keyword" && userMessage.includes(rule.trigger)) {
      appendMessage(rule.reply, "assistant");
      ruleMatchFound = true;
      break;
    }
  }
  if (ruleMatchFound) {
    enableInput();
    return;
  }

  try {
    const response = await chatSession.sendMessage({ message: userMessage });
    let textResponse = response.text;

    if (config.limitLength && textResponse.length > config.limitLength) {
      textResponse = textResponse.substring(0, config.limitLength) + "...";
    }

    appendMessage(textResponse, "assistant");
  } catch (error) {
    console.error("Gemini API Error:", error);
    appendMessage("죄송해요, 대화 중 오류가 발생했습니다.", "assistant");
  } finally {
    enableInput();
  }
}

function appendMessage(text, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);
  messageDiv.textContent = text;
  chatLog.appendChild(messageDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function enableInput() {
  userInput.disabled = false;
  sendMessageButton.disabled = false;
  userInput.focus();
}
