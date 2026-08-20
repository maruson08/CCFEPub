/* global Blockly */

if (typeof Blockly !== "undefined") {
Blockly.defineBlocksWithJsonArray([
  {
    type: "chatbot_set_name",
    message0: "챗봇 이름 %1",
    args0: [{ type: "field_input", name: "NAME", text: "블록지니" }],
    previousStatement: null, nextStatement: null, colour: 230,
    tooltip: "챗봇의 이름을 설정합니다.",
  },
  {
    type: "chatbot_set_role",
    message0: "역할 / 직업 %1",
    args0: [{ type: "field_input", name: "ROLE", text: "친절한 코딩 멘토" }],
    previousStatement: null, nextStatement: null, colour: 230,
    tooltip: "챗봇의 역할을 정의합니다.",
  },
  {
    type: "chatbot_set_personality",
    message0: "성격 %1",
    args0: [{ type: "field_input", name: "PERSONALITY", text: "다정하고 호기심 많은" }],
    previousStatement: null, nextStatement: null, colour: 230,
    tooltip: "챗봇의 성격을 정의합니다.",
  },
  {
    type: "chatbot_set_tone",
    message0: "말투 / 스타일 %1",
    args0: [{ type: "field_input", name: "TONE", text: "편안하고 친구같은 말투" }],
    previousStatement: null, nextStatement: null, colour: 230,
    tooltip: "챗봇의 말투를 설정합니다.",
  },
  {
    type: "chatbot_when_says",
    message0: "사용자가 정확히 %1 라고 말하면 %2 응답",
    args0: [
      { type: "field_input", name: "TRIGGER", text: "안녕" },
      { type: "field_input", name: "REPLY", text: "안녕하세요!" },
    ],
    previousStatement: null, nextStatement: null, colour: 330,
    tooltip: "사용자 입력이 정확히 일치할 때 지정한 답변을 합니다.",
  },
  {
    type: "chatbot_when_includes",
    message0: "입력에 %1 가 포함되면 %2 응답",
    args0: [
      { type: "field_input", name: "KEYWORD", text: "이름" },
      { type: "field_input", name: "REPLY", text: "제 이름을 알려드릴게요." },
    ],
    previousStatement: null, nextStatement: null, colour: 330,
    tooltip: "사용자 입력에 키워드가 포함될 때 지정한 답변을 합니다.",
  },
  {
    type: "chatbot_default_reply",
    message0: "기본 답변 %1",
    args0: [{ type: "field_input", name: "REPLY", text: "다른 질문을 해 주세요." }],
    previousStatement: null, nextStatement: null, colour: 330,
  },
  {
    type: "chatbot_limit_length",
    message0: "응답 최대 글자 수 %1",
    args0: [{ type: "field_number", name: "LENGTH", value: 100, min: 1, precision: 1 }],
    previousStatement: null, nextStatement: null, colour: 30,
  },
  {
    type: "chatbot_use_emoji",
    message0: "응답에 이모지 사용 %1",
    args0: [{ type: "field_dropdown", name: "USE", options: [["사용", "TRUE"], ["사용 안 함", "FALSE"]] }],
    previousStatement: null, nextStatement: null, colour: 30,
  },
  {
    type: "chatbot_block_personal_info",
    message0: "개인정보가 포함된 입력 차단",
    previousStatement: null, nextStatement: null, colour: 30,
  },
  {
    type: "chatbot_block_sensitive_topics",
    message0: "민감 주제 차단 (JSON 배열 또는 쉼표) %1",
    args0: [{ type: "field_input", name: "TOPICS", text: "정치, 종교" }],
    previousStatement: null, nextStatement: null, colour: 30,
  },
  {
    type: "chatbot_safe_reply",
    message0: "민감 주제 거절 답변 %1",
    args0: [{ type: "field_input", name: "REPLY", text: "그 주제에는 답할 수 없어요." }],
    previousStatement: null, nextStatement: null, colour: 30,
  },
  {
    type: "chatbot_add_knowledge",
    message0: "지식 추가 주제 %1 설명 %2",
    args0: [
      { type: "field_input", name: "SUBJECT", text: "제작자" },
      { type: "field_input", name: "DESCRIPTION", text: "Realize가 만들었어요." },
    ],
    previousStatement: null, nextStatement: null, colour: 180,
  },
  {
    type: "chatbot_add_example",
    message0: "예시 대화 사용자 %1 챗봇 %2",
    args0: [
      { type: "field_input", name: "USER", text: "반가워" },
      { type: "field_input", name: "ASSISTANT", text: "저도 반가워요!" },
    ],
    previousStatement: null, nextStatement: null, colour: 180,
  },
  {
    type: "chatbot_show_system_prompt",
    message0: "최종 시스템 프롬프트 표시",
    previousStatement: null, nextStatement: null, colour: 180,
  },
  {
    type: "chatbot_start",
    message0: "챗봇 시작하기",
    previousStatement: null, colour: 120,
  },
]);
}
