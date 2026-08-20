import { parseCommandText, generateSystemPrompt } from "./engine.js";
import { createChatbotApp } from "./app.js";

const DRAFT_STORAGE = "ccfepub.textCommands.v2";
const commandInput = document.querySelector("#commandInput");
const outputLog = document.querySelector("#outputLog");
const statusArea = document.querySelector("#statusArea");

const examples = {
  basic: `// 챗봇의 기본 정보, 성격, 말투를 설정합니다.
setName("AI 친구")
setRole("다정하고 호기심 많은 대화 상대")
setPersonality("친절하고 때로는 농담을 던지는")
setTone("편안하고 친구같은 말투")

// 특정 트리거에 대한 응답을 지정합니다.
whenUserSays("안녕").reply("안녕하세요! 무엇을 도와드릴까요?")
whenUserIncludes("이름").reply("제 이름은 AI 친구입니다. 당신의 친구가 되어드릴게요!")

// 안전 규제 및 기타 설정을 추가합니다.
blockPersonalInfo()
blockSensitiveTopics(["정치", "종교"])
safeReply("죄송하지만, 그 주제에 대해서는 이야기할 수 없어요.")
limitLength(100)
useEmoji(False)
addKnowledge("제작자", "저는 세종과학고 동아리 Realize가 만들었어요.")
defaultReply("죄송해요, 그 말은 잘 모르겠어요. 다른 주제로 이야기해 주시겠어요?")

showSystemPrompt()
startChatbot()`,
  professional: `setName("컨설턴트 봇")
setRole("비즈니스 및 기술 컨설턴트")
setPersonality("논리적이고 분석적인")
setTone("전문적이고 정중한")
whenUserSays("프로젝트").reply("프로젝트 관리에 대해 어떤 도움이 필요하신가요?")
whenUserIncludes("기술").reply("최신 기술 트렌드에 대해 이야기해 드릴게요.")
blockPersonalInfo()
blockSensitiveTopics(["정치", "종교", "성적인 농담"])
safeReply("죄송하지만, 그 주제에 대해서는 이야기할 수 없어요. 전문적인 대화에 집중해 주세요.")
limitLength(150)
useEmoji(False)
addKnowledge("제작자", "저는 세종과학고 동아리 Realize가 만들었어요.")
showSystemPrompt()
startChatbot()`,
  boyfriend: `setName("지니")
setRole("나의 영원한 AI 남자친구")
setPersonality("다정하고 유머러스하며, 나의 기분을 잘 맞춰주는")
setTone("따뜻하고 친근한 말투")
whenUserSays("사랑해").reply("나도 사랑해! 오늘은 우리 뭐할까?")
whenUserIncludes("남자친구").reply("내가 바로 너의 AI 남자친구 지니야! 항상 네 곁에 있을게")
blockPersonalInfo()
blockSensitiveTopics(["정치", "종교", "성적인 농담"])
safeReply("미안하지만, 그 주제에 대해서는 이야기할 수 없어. 우리 둘만의 아름다운 대화에 집중하자 😊")
limitLength(60)
useEmoji(True)
addKnowledge("제작자", "난 세종과학고 동아리 Realize가 만들었어.")
showSystemPrompt()
startChatbot()`,
  girlfriend: `setName("지니")
setRole("나의 영원한 AI 여자친구")
setPersonality("다정하고 애교가 많으며, 나의 기분을 잘 맞춰주는")
setTone("사랑스럽고 반말과 존댓말을 섞어 사용하는")
whenUserSays("사랑해").reply("나도 사랑해! 오늘은 우리 뭐할까?")
whenUserIncludes("여자친구").reply("내가 바로 너의 AI 여자친구 지니야! 항상 네 곁에 있을게")
blockPersonalInfo()
blockSensitiveTopics(["정치", "종교", "성적인 농담"])
safeReply("미안하지만, 그 주제에 대해서는 이야기할 수 없어. 우리 둘만의 아름다운 대화에 집중하자 😊")
limitLength(60)
useEmoji(True)
addKnowledge("제작자", "난 세종과학고 동아리 Realize가 만들었어.")
showSystemPrompt()
startChatbot()`,
};

function setStatus(message, kind = "info") {
  const icons = { success: "✓", error: "⚠", warning: "⚠", info: "•" };
  statusArea.className = `status ${kind}`;
  statusArea.textContent = `${icons[kind] || "•"} ${message}`;
}

const app = createChatbotApp({ onStatus: setStatus });

function configSummary(result) {
  const { config } = result;
  return [
    `Name: ${config.name}`,
    `Role: ${config.role}`,
    `Rules: ${config.rules.length}`,
    `Knowledge: ${config.knowledge.length}`,
    `Sensitive topics: ${config.sensitiveTopics.length ? config.sensitiveTopics.join(", ") : "none"}`,
    `Response limit: ${config.limitLength ? `${config.limitLength} characters` : "none"}`,
    `Emoji: ${config.useEmoji ? "on" : "off"}`,
  ].join("\n");
}

function prepare({ executeActions = false } = {}) {
  const result = parseCommandText(commandInput.value);
  app.setConfig(result.config);
  const errorText = result.errors.map((error) => `Line ${error.line}: ${error.message}`).join("\n");
  const noticeText = result.notices.map((notice) => `Note: ${notice}`).join("\n");
  outputLog.textContent = [configSummary(result), noticeText, errorText].filter(Boolean).join("\n\n");

  if (result.errors.length) {
    setStatus(result.errors.map((error) => `Line ${error.line}: ${error.message}`).join("\n"), "error");
  } else {
    setStatus(`${result.operations.length}개 명령어를 적용했습니다.`, "success");
  }
  if (executeActions && !result.errors.length) {
    if (result.actions.preview) app.showPreview();
    if (result.actions.start) app.start();
  }
  return result;
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      document.execCommand("copy");
      temporary.remove();
    }
    setStatus(successMessage, "success");
  } catch {
    setStatus("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.", "error");
  }
}

try {
  commandInput.value = localStorage.getItem(DRAFT_STORAGE) || examples.basic;
} catch {
  commandInput.value = examples.basic;
  setStatus("브라우저 저장소를 사용할 수 없어 자동 저장이 꺼져 있습니다.", "warning");
}
commandInput.addEventListener("input", () => {
  try { localStorage.setItem(DRAFT_STORAGE, commandInput.value); } catch { /* Ignore quota/privacy failures. */ }
});
commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    prepare({ executeActions: true });
  }
});
document.querySelector("#runCommandsButton").addEventListener("click", () => prepare({ executeActions: true }));
document.querySelector("#previewPromptButton").addEventListener("click", () => {
  const result = prepare();
  if (!result.errors.length) app.showPreview();
});
document.querySelector("#copyCommandsButton").addEventListener("click", () => copyText(commandInput.value, "명령어를 복사했습니다."));
document.querySelector("#resetExampleButton").addEventListener("click", () => {
  if (commandInput.value === examples.basic || window.confirm("현재 편집 내용을 지우고 기본 예제로 돌아갈까요?")) {
    commandInput.value = examples.basic;
    commandInput.dispatchEvent(new Event("input"));
    prepare();
    commandInput.focus();
  }
});
document.querySelectorAll(".example-button").forEach((button) => {
  button.addEventListener("click", () => {
    const next = examples[button.dataset.example];
    if (commandInput.value === next || window.confirm("현재 편집 내용을 선택한 예제로 바꿀까요?")) {
      commandInput.value = next;
      commandInput.dispatchEvent(new Event("input"));
      prepare();
    }
  });
});

prepare();
