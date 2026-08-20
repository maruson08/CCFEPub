# CCFEPub v2 Release Candidate

CCFEPub(Custom Chatbot For Education)은 텍스트 명령어와 Blockly 블록으로 하나의 AI 챗봇 프로젝트를 만드는 교육용 웹 앱입니다. 별도 빌드 없이 정적 서버와 GitHub Pages에서 실행됩니다.

## 첫 프로젝트 만들기

1. **New Project**로 빈 프로젝트를 만들거나 **Load Example**로 전체 흐름을 불러옵니다.
2. Text Editor에서 명령어를 작성하거나 Block Editor에서 블록을 조립합니다.
3. **Project Inspector**에서 이름, 규칙, 지식, 안전 설정, 응답 길이를 확인합니다.
4. Gemini API 키를 입력하고 **Run**을 눌러 Test Chat을 시작합니다.
5. 프로젝트를 변경했다면 `Configuration changed. Run again` 안내에 따라 다시 Run합니다.

API 키는 새 프로젝트·예제 불러오기·Clear Chat에도 유지됩니다. **Clear API Key**를 누르거나 키 값을 변경하면 활성 Test Chat은 즉시 무효화됩니다.

## 기본 예제

기본 학습 도우미 예제는 프로젝트의 대표 기능을 한 번에 보여 줍니다.

```text
setName("학습 도우미")
setRole("질문을 차근차근 설명하는 학습 파트너")
whenUserSays("안녕").reply("안녕하세요! 오늘은 무엇을 공부할까요?")
whenUserIncludes("힌트").reply("좋아요. 정답 대신 첫 단서부터 함께 찾아볼게요.")
addKnowledge("공부 방법", "큰 문제를 작은 단계로 나누고 한 단계씩 확인해요.")
blockPersonalInfo()
blockSensitiveTopics(["폭력", "성적인 내용"])
safeReply("그 주제 대신 안전한 학습 주제로 이야기해 볼까요?")
showSystemPrompt()
startChatbot()
```

Text와 Blocks는 같은 canonical operation sequence를 편집합니다. 화면을 전환할 때 변환할 수 없는 명령이나 블록이 있으면 전환을 중단하고 마지막 유효 프로젝트를 보존합니다.

## Test Chat 상태

런타임은 다음 상태를 사용자에게 명시적으로 표시합니다.

- `Idle` — 편집 가능, Test Chat은 아직 시작하지 않음
- `Validating` — 현재 프로젝트 설정 확인 중
- `API key required` — API 키 입력 필요
- `Starting` — Gemini SDK 및 세션 시작 중
- `Ready` — 메시지 전송 가능
- `Sending` — 응답 대기 중
- `Configuration changed. Run again` — 편집 또는 API 키 변경으로 기존 세션 무효화
- `Error` — SDK, 인증, 네트워크, 요청 한도 또는 요청 오류

**Clear Chat**은 보이는 대화와 Gemini 대화 세션만 새로 만들며 프로젝트 설정과 API 키를 유지합니다. System prompt dialog에서는 생성된 prompt를 확인하고 복사할 수 있습니다.

## Project format v1

프로젝트의 source of truth는 순서를 보존하는 `operations`입니다.

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

- 자동 저장: `localStorage`의 `ccfepub.project.v1`
- API 키: 현재 탭의 `sessionStorage`에만 저장
- Export: `<project-name>.ccfepub.json`; 이름이 없으면 `ccfepub-project.ccfepub.json`
- Import: format, version, operations를 먼저 검증하며 실패 시 현재 프로젝트를 그대로 유지
- Migration: 기존 `ccfepub.textCommands.v2`, `ccfepub.blocklyWorkspace.v2`를 가능한 경우 format v1으로 이전

API 키와 chat message는 project JSON에 포함되지 않습니다. 브라우저 기반 앱에서는 키를 완전히 숨길 수 없으므로 교육·개발용으로 제한된 키와 사용량 제한을 권장합니다.

## 로컬 실행

ES modules와 CDN 리소스를 위해 저장소 루트에서 정적 서버를 실행합니다.

```bash
python -m http.server 8000
```

- Text Editor: `http://localhost:8000/`
- Block Editor: `http://localhost:8000/block.html`

Gemini SDK와 Blockly는 실행 시 CDN 네트워크가 필요합니다. Gemini SDK가 차단되더라도 편집기와 Run 이벤트는 계속 동작하며 별도의 SDK 로드 오류를 표시합니다.

## 구조

- `engine.js` — parser, canonical operations, serializer, prompt
- `project.js` — project format v1, validation, persistence, migration
- `block_mapping.js` — canonical operation ↔ Blockly record
- `examples.js` — Text/Blockly 공통 제품 예제
- `project_ui.js` — Inspector, import/export, 파일명 처리
- `app.js` — Gemini adapter, runtime lifecycle, API key, prompt, Test Chat
- `script.js` / `blockly_script.js` — 편집기별 UI controller

## 검증

의존성 설치 없이 전체 테스트를 실행합니다.

```bash
node --test
```

테스트는 parser와 serializer, project schema, Text/Block round-trip, New Project, Load Example, dirty/stale runtime, API key invalidation, Clear Chat, import atomicity, export filename, SDK·Gemini 오류, storage failure, DOM wiring을 검증합니다.

정적 검증:

```bash
node --check app.js
node --check script.js
node --check blockly_script.js
git diff --check
```

## License

Copyright (c) 2025 maruson08. MIT License로 배포됩니다. 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.
