# CCFEPub

CCFEPub(Custom Chatbot For Education)은 텍스트 명령어와 Blockly 블록으로 하나의 AI 챗봇 프로젝트를 설계하는 교육용 웹 앱입니다. 별도 빌드나 서버 애플리케이션 없이 GitHub Pages에서 실행됩니다.

## 주요 기능

- Text Editor와 Block Editor가 동일한 canonical operation sequence 편집
- Text → Blocks → Text 무손실 round-trip과 안전한 문자열 escaping
- 읽기 전용 Inspector로 이름, 규칙, 지식, 민감 주제, 응답 제한 확인
- project JSON import/export와 브라우저 자동 저장
- 기존 foundation Text/Blockly 저장 데이터 migration
- 공통 system prompt, Gemini test chat, `Ctrl/Cmd + Enter`

## 통합 Editor

Text Editor에서 명령어를 작성한 뒤 **Block Editor**를 선택하면 parser가 생성한 operations를 구조적인 Blockly block으로 변환합니다. Block Editor에서 **Text Editor**로 돌아오면 같은 operations가 표준 명령어로 직렬화됩니다.

명령어 오류나 지원하지 않는 operation/block이 있으면 전환을 중단하고 오류를 표시합니다. 마지막으로 유효했던 canonical project는 유지되며 데이터가 조용히 삭제되지 않습니다.

```text
setName("AI 친구")
setRole("친절한 코딩 멘토")
whenUserSays("안녕").reply("안녕하세요!")
addKnowledge("제작자", "Realize가 만들었어요.")
blockSensitiveTopics(["정치", "종교"])
showSystemPrompt()
startChatbot()
```

## Project format

프로젝트의 source of truth는 명령 순서를 보존하는 `operations`입니다.

```json
{
  "format": "ccfepub-project",
  "formatVersion": 1,
  "editorMode": "text",
  "operations": [],
  "metadata": {
    "name": "AI 친구",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Export Project**는 `.ccfepub.json` 파일을 만들고 **Import Project**는 identifier, version, operation schema를 검증합니다. Gemini API 키와 chat message는 project에 포함되지 않습니다. API 키는 `sessionStorage`에만 보관됩니다.

Canonical project는 `localStorage`의 `ccfepub.project.v1`에 자동 저장됩니다. 이전 `ccfepub.textCommands.v2` 및 `ccfepub.blocklyWorkspace.v2` 데이터는 가능한 경우 project format v1으로 이전됩니다.

## Build → Inspect → Test

1. **Build** — Text 또는 Blocks로 chatbot operations 편집
2. **Inspect** — canonical config와 동일한 system prompt 확인
3. **Test** — API 키를 입력하고 Run으로 Gemini test chat 시작

브라우저 기반 앱에서는 API 키를 완전히 숨길 수 없습니다. 교육·개발용으로 제한된 키를 사용하고 Google Cloud에서 사용량 제한을 설정하세요.

## 실행 및 GitHub Pages

저장소 루트를 GitHub Pages source로 지정하면 상대 asset 경로를 통해 동작합니다. 로컬에서는 ES modules와 CDN을 위해 정적 서버를 사용하세요.

```bash
python -m http.server 8000
```

그 다음 `http://localhost:8000/` 또는 `http://localhost:8000/block.html`을 엽니다. 최신 Chrome, Edge, Firefox, Safari를 지원 대상으로 합니다.

## Architecture

- `engine.js` — parser, operations serializer, `ChatbotConfig`, prompt
- `project.js` — project format v1, validation, import/export, migration
- `block_mapping.js` — canonical operation ↔ Blockly record mapping
- `project_ui.js` — Inspector와 project file UI
- `app.js` — Gemini session, API key, prompt dialog, chat
- `script.js` / `blockly_script.js` — 각 editor view와 shared project 연결

## 테스트

의존성 설치 없이 실행할 수 있습니다.

```bash
node --test tests/*.test.mjs
```

Parser, serializer, project schema, import/export, API key 제외, Text/Block round-trip, migration, runtime wiring을 검증합니다.

## Contributing

이 프로젝트는 오픈 소스입니다. 기능 브랜치에서 변경하고 테스트한 뒤 pull request를 보내 주세요. 원 프로젝트와 저작자 정보는 [GitHub 저장소](https://github.com/CWFEPub/CCFEPub)에서 확인할 수 있습니다.

## License

Copyright (c) 2025 maruson08. MIT License로 배포되며 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.
