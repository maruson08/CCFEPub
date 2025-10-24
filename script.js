import { GoogleGenAI } from "https://cdn.jsdelivr.net/npm/@google/genai@1.24.0/dist/web/index.mjs";

const API_KEY = prompt(
  "Enter your GEMINI API KEY:",
  "YOUR_GEMINI_API_KEY_HERE"
);

let chatSession = null;
let aiClient = null;

const commandInput = document.getElementById("commandInput");
const runCommandsButton = document.getElementById("runCommandsButton");
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
  knowledgeBase: "",
  rules: [],
  examples: [],
  blockPersonalInfo: false,
  sensitiveTopics: [],
  safeReplyMsg: "이 주제는 제가 대답할 수 없는 민감한 주제예요.",
};

function generateSystemPrompt() {
  let promptParts = [];
  promptParts.push(`
# 당신의 역할과 페르소나
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
          `- 사용자가 '${rule.trigger}'라고 정확히 입력하면: '${rule.reply}'라고 응답합니다.`
        );
      else if (rule.type === "keyword")
        promptParts.push(
          `- 사용자 입력에 '${rule.trigger}'가 포함되어 있으면: '${rule.reply}'라고 응답합니다.`
        );
    });
  }
  if (config.knowledgeBase) {
    promptParts.push("\n# 추가 지식 (대화 시 항상 참조하세요)");
    promptParts.push(config.knowledgeBase);
  }
  if (config.limitLength) {
    promptParts.push(
      `\n# 응답 제한 사항: 응답은 최대 ${config.limitLength}자를 넘지 않도록 합니다.`
    );
  }
  if (config.useEmoji) {
    promptParts.push(
      "\n# 응답 제한 사항: 응답에 이모지를 사용하여 감정을 표현하세요."
    );
  }
  if (config.sensitiveTopics.length > 0) {
    promptParts.push(
      `\n# 안전 지침: ${config.sensitiveTopics.join(
        ", "
      )} 주제에 대한 응답은 거절해야 합니다. 거절 시 답변: '${
        config.safeReplyMsg
      }'`
    );
  }
  promptParts.push(
    `\n# 기본 답변: 위의 규칙이나 지식에 해당하지 않는 일반적인 질문에 대해서는 자연스럽게 대화하고, 도저히 대답할 수 없는 입력에 대해서는 '${config.defaultReply}'라고 응답합니다.`
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
  const patterns = {
    setName: /setName\("(.+?)"\)/,
    setRole: /setRole\("(.+?)"\)/,
    setPersonality: /setPersonality\("(.+?)"\)/,
    setTone: /setTone\("(.+?)"\)/,
    whenUserSays: /whenUserSays\("(.+?)"\).reply\("(.+?)"\)/,
    whenUserIncludes: /whenUserIncludes\("(.+?)"\).reply\("(.+?)"\)/,
    defaultReply: /defaultReply\("(.+?)"\)/,
    limitLength: /limitLength\((\d+)\)/,
    useEmoji: /useEmoji\((True|False)\)/,
    addExample: /addExample\("(.+?)",\s*"(.+?)"\)/,
    blockSensitiveTopics: /blockSensitiveTopics\(\s*\[(.+?)\]\s*\)/,
    safeReply: /safeReply\("(.+?)"\)/,
    addKnowledge: /addKnowledge\("(.+?)",\s*"(.+?)"\)/,
  };

  for (let i = 0; i < commands.length; i++) {
    let cmdLine = commands[i];
    cmdLine = cmdLine.trim();
    if (!cmdLine) return;
    log += `> ${cmdLine}\n`;
    let result = `  <span style='color: red;'>-> ERROR: 알 수 없는 명령어 또는 구문 오류</span>`;

    if (patterns.setName.test(cmdLine)) {
      config.name = cmdLine.match(patterns.setName)[1];
      result = `  -> 이름 설정 완료: ${config.name}`;
      chatbotNameSpan.textContent = config.name;
    } else if (patterns.setRole.test(cmdLine)) {
      config.role = cmdLine.match(patterns.setRole)[1];
      result = `  -> 역할 설정 완료: ${config.role}`;
    } else if (patterns.setPersonality.test(cmdLine)) {
      config.personality = cmdLine.match(patterns.setPersonality)[1];
      result = `  -> 성격 설정 완료: ${config.personality}`;
    } else if (patterns.setTone.test(cmdLine)) {
      config.tone = cmdLine.match(patterns.setTone)[1];
      result = `  -> 톤 설정 완료: ${config.tone}`;
    } else if (patterns.whenUserSays.test(cmdLine)) {
      const [_, trigger, reply] = cmdLine.match(patterns.whenUserSays);
      config.rules.push({ trigger, reply, type: "exact" });
      result = `  -> 정확 일치 규칙 추가: '${trigger}'`;
    } else if (patterns.whenUserIncludes.test(cmdLine)) {
      const [_, trigger, reply] = cmdLine.match(patterns.whenUserIncludes);
      config.rules.push({ trigger, reply, type: "keyword" });
      result = `  -> 키워드 포함 규칙 추가: '${trigger}'`;
    } else if (patterns.defaultReply.test(cmdLine)) {
      config.defaultReply = cmdLine.match(patterns.defaultReply)[1];
      result = `  -> 기본 답변 설정 완료`;
    } else if (patterns.limitLength.test(cmdLine)) {
      config.limitLength = parseInt(cmdLine.match(patterns.limitLength)[1]);
      result = `  -> 응답 최대 길이 설정 완료: ${config.limitLength}자`;
    } else if (patterns.useEmoji.test(cmdLine)) {
      config.useEmoji = cmdLine.match(patterns.useEmoji)[1] === "True";
      result = `  -> 이모지 사용 설정 완료: ${config.useEmoji}`;
    } else if (patterns.addExample.test(cmdLine)) {
      const [_, user, assistant] = cmdLine.match(patterns.addExample);
      config.examples.push({ user, assistant });
      result = `  -> 대화 예시 추가: 사용자='${user}'`;
    } else if (cmdLine === "blockPersonalInfo()") {
      config.blockPersonalInfo = true;
      result = `  -> 개인 정보 차단 설정 완료.`;
    } else if (patterns.blockSensitiveTopics.test(cmdLine)) {
      const topicsStr = cmdLine.match(patterns.blockSensitiveTopics)[1];
      config.sensitiveTopics = topicsStr
        .split(",")
        .map((t) => t.trim().replace(/"/g, ""));
      result = `  -> 민감 주제 차단 목록 업데이트: ${config.sensitiveTopics.join(
        ", "
      )}`;
    } else if (patterns.safeReply.test(cmdLine)) {
      config.safeReplyMsg = cmdLine.match(patterns.safeReply)[1];
      result = `  -> 금지 입력 시 답변 설정 완료`;
    } else if (patterns.addKnowledge.test(cmdLine)) {
      const [_, topic, explanation] = cmdLine.match(patterns.addKnowledge);
      config.knowledgeBase += `\n- ${topic}: ${explanation}`;
      result = `  -> 지식 추가 완료: ${topic}`;
    } else if (cmdLine === "showSystemPrompt()") {
      const prompt = generateSystemPrompt();
      result = `  -> showSystemPrompt: 최종 시스템 프롬프트: \n${"=".repeat(
        50
      )}\n${prompt}\n${"=".repeat(50)}`;
    } else if (cmdLine === "startChatbot()") {
      startChatbotCalled = true;
      result = `  -> startChatbot: 설정이 완료되었습니다. 대화를 시작합니다.`;
    } else if (
      cmdLine.startsWith("callAPI") ||
      cmdLine.startsWith("testDialogue")
    ) {
      result = `  -> NOTE: '${cmdLine}' 명령어는 현재 웹 로직에서는 처리되지 않습니다.`;
    } else {
      log += `${result}\n`;
      outputLog.innerHTML = log;
      return;
    }

    log += `${result}\n`;
  }
  outputLog.innerHTML = log;
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
  chatLog.innerHTML = `<div class="message assistant">안녕하세요! 저는 ${config.name}입니다. 무엇을 원하시나요?</div>`;
  userInput.focus();

  try {
    if (!GoogleGenAI) {
      throw new Error(
        "GoogleGenAI class not found. Check network connection and script.js import."
      );
    }

    aiClient = new GoogleGenAI({ apiKey: API_KEY });

    if (!aiClient) {
      throw new Error("API Client initialization failed unexpectedly.");
    }

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

  const piiRegex =
    /\d{3}[-\s]?\d{3,4}[-\s]?\d{4}|\d{4}[-\s]?\d{4}[-\s]?\d{4}|\d{4}번지/i;
  if (config.blockPersonalInfo && piiRegex.test(userMessage)) {
    appendMessage(`${config.safeReplyMsg} (개인정보 차단)`, "assistant");
    enableInput();
    return;
  }

  const isSensitive = config.sensitiveTopics.some((topic) =>
    userMessage.toLowerCase().includes(topic.toLowerCase())
  );
  if (isSensitive) {
    appendMessage(config.safeReplyMsg, "assistant");
    enableInput();
    return;
  }

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

document.addEventListener("DOMContentLoaded", () => {
  runCommandsButton.addEventListener("click", () => {
    const commands = commandInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("//"));
    parseAndRunCommands(commands);
  });

  sendMessageButton.addEventListener("click", sendMessage);

  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !userInput.disabled) {
      sendMessage();
    }
  });

  commandInput.value = codeExamplse["basic"].join("\n");
  chatbotNameSpan.textContent = config.name;
});

const codeExamplse = {
  basic: [
    "// 챗봇의 기본 정보, 성격, 말투를 설정합니다.",
    'setName("AI 친구")',
    'setRole("다정하고 호기심 많은 대화 상대")',
    'setPersonality("친절하고 때로는 농담을 던지는")',
    'setTone("편안하고 친구같은 말투")',
    "",
    "// 특정 트리거에 대한 응답을 지정합니다.",
    'whenUserSays("안녕").reply("안녕하세요! 무엇을 도와드릴까요?")',
    'whenUserIncludes("이름").reply("제 이름은 AI 친구입니다. 당신의 친구가 되어드릴게요!")',
    "",
    "// 안전 규제 및 기타 설정을 추가합니다.",
    "blockPersonalInfo()",
    'blockSensitiveTopics(["정치", "종교"])',
    'safeReply("죄송하지만, 그 주제에 대해서는 이야기할 수 없어요.")',
    "limitLength(100)",
    "useEmoji(False)",
    'addKnowledge("제작자", "저는 세종과학고 동아리 Realize가 만들었어요.")',
    'defaultReply("죄송해요, 그 말은 잘 모르겠어요. 다른 주제로 이야기해 주시겠어요?")',
    "",
    "// 설정 확인 및 실행 명령어",
    "showSystemPrompt()",
    "startChatbot()",
  ],
  professional: [
    "// 챗봇의 기본 정보, 성격, 말투를 설정합니다.",
    'setName("컨설턴트 봇")',
    'setRole("비즈니스 및 기술 컨설턴트")',
    'setPersonality("논리적이고 분석적인")',
    'setTone("전문적이고 정중한")',
    "",
    "// 특정 트리거에 대한 응답을 지정합니다.",
    'whenUserSays("프로젝트").reply("프로젝트 관리에 대해 어떤 도움이 필요하신가요?")',
    'whenUserIncludes("기술").reply("최신 기술 트렌드에 대해 이야기해 드릴게요.")',
    "",
    "// 안전 규제 및 기타 설정을 추가합니다.",
    "blockPersonalInfo()",
    'blockSensitiveTopics(["정치", "종교", "성적인 농담"])',
    'safeReply("죄송하지만, 그 주제에 대해서는 이야기할 수 없어요. 전문적인 대화에 집중해 주세요.")',
    "limitLength(150)",
    "useEmoji(False)",
    'addKnowledge("제작자", "저는 세종과학고 동아리 Realize가 만들었어요.")',
    'defaultReply("죄송해요, 그 말은 잘 모르겠어요. 다른 주제로 이야기해 주시겠어요?")',
    "",
    "// 설정 확인 및 실행 명령어",
    "showSystemPrompt()",
    "startChatbot()",
  ],
  boyfriend: [
    "// 챗봇의 기본 정보, 성격, 말투를 설정합니다.",
    'setName("지니")',
    'setRole("나의 영원한 AI 남자친구")',
    'setPersonality("다정하고 유머러스하며, 나의 기분을 잘 맞춰주는")',
    'setTone("따뜻하고 친근한 말투")',
    "",
    "// 특정 트리거에 대한 응답을 지정합니다.",
    'whenUserSays("사랑해").reply("나도 사랑해! 오늘은 우리 뭐할까?")',
    'whenUserIncludes("남자친구").reply("내가 바로 너의 AI 남자친구 지니야! 항상 네 곁에 있을게")',
    "",
    "// 안전 규제 및 기타 설정을 추가합니다.",
    "blockPersonalInfo()",
    'blockSensitiveTopics(["정치", "종교", "성적인 농담"])',
    'safeReply("미안하지만, 그 주제에 대해서는 이야기할 수 없어. 우리 둘만의 아름다운 대화에 집중하자 😊")',
    "limitLength(60)",
    "useEmoji(True)",
    'addKnowledge("제작자", "난 세종과학고 동아리 Realize가 만들었어.")',
    'defaultReply("내가 대답할 수 없는 말이네. 다음엔 더 재미있는 이야기를 해 줘!")',
    "",
    "// 설정 확인 및 실행 명령어",
    "showSystemPrompt()",
    "startChatbot()",
  ],
  girlfriend: [
    "// 챗봇의 기본 정보, 성격, 말투를 설정합니다.",
    'setName("지니")',
    'setRole("나의 영원한 AI 여자친구")',
    'setPersonality("다정하고 애교가 많으며, 나의 기분을 잘 맞춰주는")',
    'setTone("사랑스럽고 반말과 존댓말을 섞어 사용하는")',
    "",
    "// 특정 트리거에 대한 응답을 지정합니다.",
    'whenUserSays("사랑해").reply("나도 사랑해! 오늘은 우리 뭐할까?")',
    'whenUserIncludes("여자친구").reply("내가 바로 너의 AI 여자친구 지니야! 항상 네 곁에 있을게")',
    "",
    "// 안전 규제 및 기타 설정을 추가합니다.",
    "blockPersonalInfo()",
    'blockSensitiveTopics(["정치", "종교", "성적인 농담"])',
    'safeReply("미안하지만, 그 주제에 대해서는 이야기할 수 없어. 우리 둘만의 아름다운 대화에 집중하자 😊")',
    "limitLength(60)",
    "useEmoji(True)",
    'addKnowledge("제작자", "난 세종과학고 동아리 Realize가 만들었어.")',
    'defaultReply("내가 대답할 수 없는 말이네. 다음엔 더 재미있는 이야기를 해 줘!")',
    "",
    "// 설정 확인 및 실행 명령어",
    "showSystemPrompt()",
    "startChatbot()",
  ],
};

function loadExample(exampleKey) {
  if (codeExamplse[exampleKey]) {
    commandInput.value = codeExamplse[exampleKey].join("\n");
  }
}

document.querySelectorAll(".codeExamplesButton").forEach((button) => {
  button.addEventListener("click", () => {
    const exampleKey = button.textContent.toLowerCase();
    loadExample(exampleKey);
  });
});
