const CHATBOT_HUE = 230;
const javascriptGenerator = Blockly.JavaScript;

Blockly.Blocks["chatbot_set_name"] = {
  init: function () {
    this.appendValueInput("NAME")
      .setCheck("String")
      .appendField("챗봇 이름 설정");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(CHATBOT_HUE);
    this.setTooltip("챗봇의 이름을 설정합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_set_name"] = function (block, generator) {
  let name =
    generator.valueToCode(block, "NAME", Blockly.JavaScript.ORDER_NONE) || '""';
  name = name.replace(/^["']|["']$/g, "");
  return `setName('${name}');\n`;
};

Blockly.Blocks["chatbot_set_role"] = {
  init: function () {
    this.appendValueInput("ROLE")
      .setCheck("String")
      .appendField("역할/직업 설정");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(CHATBOT_HUE);
    this.setTooltip("챗봇의 역할을 정의합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_set_role"] = function (block, generator) {
  let role =
    generator.valueToCode(block, "ROLE", Blockly.JavaScript.ORDER_NONE) || '""';
  role = role.replace(/^["']|["']$/g, "");
  return `setRole('${role}');\n`;
};

Blockly.Blocks["chatbot_set_personality"] = {
  init: function () {
    this.appendValueInput("PERSONALITY")
      .setCheck("String")
      .appendField("성격 부여");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(CHATBOT_HUE);
    this.setTooltip("챗봇의 성격을 정의합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_set_personality"] = function (
  block,
  generator
) {
  let personality =
    generator.valueToCode(
      block,
      "PERSONALITY",
      Blockly.JavaScript.ORDER_NONE
    ) || '""';
  personality = personality.replace(/^["']|["']$/g, "");
  return `setPersonality('${personality}');\n`;
};

Blockly.Blocks["chatbot_set_tone"] = {
  init: function () {
    this.appendValueInput("TONE")
      .setCheck("String")
      .appendField("말투/스타일 설정");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(CHATBOT_HUE);
    this.setTooltip("챗봇의 말투나 스타일을 설정합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_set_tone"] = function (block, generator) {
  let tone =
    generator.valueToCode(block, "TONE", Blockly.JavaScript.ORDER_NONE) || '""';
  tone = tone.replace(/^["']|["']$/g, "");
  return `setTone('${tone}');\n`;
};

Blockly.Blocks["chatbot_when_says"] = {
  init: function () {
    this.appendValueInput("TRIGGER")
      .setCheck("String")
      .appendField("사용자가 정확히 말하면");
    this.appendValueInput("REPLY")
      .setCheck("String")
      .appendField("다음으로 응답:");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(330);
    this.setTooltip("사용자 입력이 정확히 일치할 때 특정 응답을 합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_when_says"] = function (
  block,
  generator
) {
  let trigger =
    generator.valueToCode(block, "TRIGGER", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  let reply =
    generator.valueToCode(block, "REPLY", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  trigger = trigger.replace(/^["']|["']$/g, "");
  reply = reply.replace(/^["']|["']$/g, "");
  return `'${trigger}'.reply('${reply}');\n`;
};

Blockly.Blocks["chatbot_when_includes"] = {
  init: function () {
    this.appendValueInput("KEYWORD")
      .setCheck("String")
      .appendField("입력에 키워드가 포함되면");
    this.appendValueInput("REPLY")
      .setCheck("String")
      .appendField("다음으로 응답:");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(330);
    this.setTooltip("사용자 입력에 특정 키워드가 포함될 때 응답합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_when_includes"] = function (
  block,
  generator
) {
  let keyword =
    generator.valueToCode(block, "KEYWORD", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  let reply =
    generator.valueToCode(block, "REPLY", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  keyword = keyword.replace(/^["']|["']$/g, "");
  reply = reply.replace(/^["']|["']$/g, "");
  return `whenUserIncludes('${keyword}').reply('${reply}');\n`;
};

Blockly.Blocks["chatbot_default_reply"] = {
  init: function () {
    this.appendValueInput("REPLY")
      .setCheck("String")
      .appendField("기본 답변 설정");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(330);
    this.setTooltip("모든 규칙에 해당하지 않을 때 출력될 답변을 설정합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_default_reply"] = function (
  block,
  generator
) {
  let reply =
    generator.valueToCode(block, "REPLY", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  reply = reply.replace(/^["']|["']$/g, "");
  return `defaultReply('${reply}');\n`;
};

Blockly.Blocks["chatbot_limit_length"] = {
  init: function () {
    this.appendValueInput("LENGTH")
      .setCheck("Number")
      .appendField("응답 최대 글자 수 제한");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(30);
    this.setTooltip("챗봇 응답의 최대 글자 수를 지정합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_limit_length"] = function (
  block,
  generator
) {
  const length =
    generator.valueToCode(block, "LENGTH", Blockly.JavaScript.ORDER_ATOMIC) ||
    0;
  return `limitLength(${length});\n`;
};

Blockly.Blocks["chatbot_use_emoji"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("응답에 이모지 사용")
      .appendField(
        new Blockly.FieldDropdown([
          ["True", "True"],
          ["False", "False"],
        ]),
        "USE"
      );
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(30);
    this.setTooltip("응답에 이모지를 사용할지 여부를 설정합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_use_emoji"] = function (
  block,
  generator
) {
  const use = block.getFieldValue("USE");
  return `useEmoji(${use});\n`;
};

Blockly.Blocks["chatbot_block_personal_info"] = {
  init: function () {
    this.appendDummyInput().appendField("개인정보(전화번호, 주소 등) 차단");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(30);
    this.setTooltip("개인정보가 포함된 입력이나 응답을 차단합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_block_personal_info"] = function (
  block,
  generator
) {
  return `blockPersonalInfo();\n`;
};

Blockly.Blocks["chatbot_block_sensitive_topics"] = {
  init: function () {
    this.appendDummyInput().appendField("민감 주제 차단 (띄어쓰기로 구분)");
    this.appendValueInput("TOPICS")
      .setCheck("String")
      .setAlign(Blockly.ALIGN_RIGHT);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(30);
    this.setTooltip("지정한 민감하거나 금지된 주제에 대한 응답을 차단합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_block_sensitive_topics"] = function (
  block,
  generator
) {
  let topics =
    generator.valueToCode(block, "TOPICS", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  topics = topics.replace(/^["']|["']$/g, "");
  return `blockSensitiveTopics('${topics}');\n`;
};

Blockly.Blocks["chatbot_safe_reply"] = {
  init: function () {
    this.appendValueInput("REPLY")
      .setCheck("String")
      .appendField("민감 주제 거절 응답 설정");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(30);
    this.setTooltip("민감 주제 차단 시 출력할 안내 메시지를 설정합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_safe_reply"] = function (
  block,
  generator
) {
  let reply =
    generator.valueToCode(block, "REPLY", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  reply = reply.replace(/^["']|["']$/g, "");
  return `safeReply('${reply}');\n`;
};

Blockly.Blocks["chatbot_add_knowledge"] = {
  init: function () {
    this.appendValueInput("SUBJECT")
      .setCheck("String")
      .appendField("지식 추가 - 주제:");
    this.appendValueInput("DESCRIPTION")
      .setCheck("String")
      .appendField("설명:");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(180);
    this.setTooltip("특정 주제에 대한 배경 지식을 추가합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_add_knowledge"] = function (
  block,
  generator
) {
  let subject =
    generator.valueToCode(block, "SUBJECT", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  let description =
    generator.valueToCode(
      block,
      "DESCRIPTION",
      Blockly.JavaScript.ORDER_NONE
    ) || '""';
  subject = subject.replace(/^["']|["']$/g, "");
  description = description.replace(/^["']|["']$/g, "");
  return `addKnowledge('${subject}', '${description}');\n`;
};

Blockly.Blocks["chatbot_add_example"] = {
  init: function () {
    this.appendValueInput("USER")
      .setCheck("String")
      .appendField("예시 대화 - 사용자 입력:");
    this.appendValueInput("ASSISTANT")
      .setCheck("String")
      .appendField("챗봇 응답:");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(180);
    this.setTooltip("대화 예시를 등록하여 챗봇의 응답 스타일을 학습시킵니다.");
  },
};
javascriptGenerator.forBlock["chatbot_add_example"] = function (
  block,
  generator
) {
  let user =
    generator.valueToCode(block, "USER", Blockly.JavaScript.ORDER_NONE) || '""';
  let assistant =
    generator.valueToCode(block, "ASSISTANT", Blockly.JavaScript.ORDER_NONE) ||
    '""';
  user = user.replace(/^["']|["']$/g, "");
  assistant = assistant.replace(/^["']|["']$/g, "");
  return `addExample('${user}', '${assistant}');\n`;
};

Blockly.Blocks["chatbot_show_system_prompt"] = {
  init: function () {
    this.appendDummyInput().appendField("최종 시스템 프롬프트 표시");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(180);
    this.setTooltip(
      "설정된 내용을 바탕으로 생성된 최종 시스템 프롬프트를 출력합니다."
    );
  },
};
javascriptGenerator.forBlock["chatbot_show_system_prompt"] = function (
  block,
  generator
) {
  return `showSystemPrompt();\n`;
};

Blockly.Blocks["chatbot_start"] = {
  init: function () {
    this.appendDummyInput().appendField("챗봇 시작하기");
    this.setPreviousStatement(true, null);
    this.setColour(120);
    this.setTooltip("모든 설정을 완료하고 챗봇과의 대화를 시작합니다.");
  },
};
javascriptGenerator.forBlock["chatbot_start"] = function (block, generator) {
  return "startChatbot();\n";
};
