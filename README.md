# CCFEPub

CCFEPub(Custom Chatbot For Education)은 텍스트 명령어나 Blockly 블록으로 챗봇의 이름, 성격, 대화 규칙, 지식, 안전 설정을 설계해 보는 교육용 웹 앱입니다. 별도 서버나 빌드 과정 없이 GitHub Pages에서 실행됩니다.

## 주요 기능

- Text Editor와 Block Editor가 동일한 `ChatbotConfig` 및 system prompt 엔진 사용
- 여러 명령어 처리, 줄 번호 오류 표시, 따옴표·Unicode 안전 파싱
- Gemini 2.5 Flash 기반 대화와 로컬 우선 대화 규칙
- system prompt 미리보기(키는 포함되지 않음)
- 텍스트 명령어와 Blockly workspace 자동 저장
- API 키 Show/Hide/Clear 및 세션 범위 보관
- `Ctrl + Enter` / `Cmd + Enter` 실행, 명령어 복사, 기본 예제 초기화

## Text Editor

`index.html`에서 명령어로 챗봇을 구성합니다. 기존 v1 명령어를 유지하며 한 줄에 하나씩 쓰거나 세미콜론으로 여러 명령어를 구분할 수 있습니다.

```text
setName("AI 친구")
setRole("친절한 코딩 멘토")
setPersonality("다정하고 호기심 많은")
setTone("편안한 말투")
whenUserSays("안녕").reply("안녕하세요!")
whenUserIncludes("이름").reply("제 이름은 AI 친구예요.")
defaultReply("다른 질문을 해 주세요.")
limitLength(100)
useEmoji(True)
blockPersonalInfo()
blockSensitiveTopics(["정치", "종교"])
safeReply("그 주제에는 답할 수 없어요.")
addKnowledge("제작자", "Realize가 만들었어요.")
addExample("반가워", "저도 반가워요!")
showSystemPrompt()
startChatbot()
```

편집 내용은 `localStorage`에 자동 저장됩니다. **Reset example**은 확인 후 기본 예제로 돌아갑니다.

## Block Editor

`block.html`에서 같은 설정을 블록으로 조립합니다. 블록은 문자열 JavaScript를 실행하지 않고 구조화된 operation으로 변환된 뒤 Text Editor와 같은 공통 엔진에 전달됩니다. workspace는 Blockly serialization API(지원되지 않으면 XML)에 의해 `localStorage`에 저장되고 새로고침 시 복원됩니다.

## Gemini API 사용

1. [Google AI Studio](https://ai.google.dev/aistudio)에서 Gemini API 키를 발급합니다.
2. 페이지의 **Gemini API Key** 입력란에 키를 넣습니다.
3. `startChatbot()` 명령어나 **챗봇 시작하기** 블록을 포함하고 **Run**을 누릅니다.

API 키는 코드에 포함되거나 `localStorage`에 저장되지 않고 `sessionStorage`에만 보관됩니다. **Clear**로 즉시 지울 수 있습니다. 다만 서버가 없는 브라우저 앱의 특성상 실행 중인 키를 개발자 도구와 네트워크 접근 권한을 가진 사용자로부터 완전히 숨길 수는 없습니다. 교육·개발용으로 제한된 키를 사용하고 Google Cloud에서 사용량과 제한을 설정하세요.

기존 API 키 발급 안내 이미지는 [`img/`](./img/)에 보존되어 있습니다.

## 실행 및 배포

GitHub Pages에서는 저장소 루트를 Pages source로 지정하면 됩니다. 모든 프로젝트 asset은 상대 경로를 사용하므로 프로젝트 하위 경로에서도 동작합니다.

로컬에서는 ES module과 CDN 요청을 위해 간단한 정적 서버를 사용하세요.

```bash
python -m http.server 8000
```

그 다음 `http://localhost:8000/` 또는 `http://localhost:8000/block.html`을 엽니다. Node/npm이나 별도 빌드는 필요하지 않습니다.

## 브라우저 지원

최신 Chrome, Edge, Firefox, Safari를 대상으로 합니다. `dialog`, ES modules, `localStorage`/`sessionStorage`, Blockly가 동작해야 하며 Clipboard API 권한 정책은 브라우저와 접속 방식에 따라 다를 수 있습니다.

## v2 foundation 변경점

- `engine.js`: parser, `ChatbotConfig`, validation, prompt 생성, 로컬 응답 규칙
- `app.js`: Gemini 세션, API 키 UI, prompt preview, 공통 chat UI
- `script.js`: Text Editor 입력, 실행, 예제, 저장
- `blockly_blocks.js`: custom block 정의
- `blockly_script.js`: block → operation 변환, workspace 저장, 실행
- 중복 Blockly import, 중복 HTML 닫기 태그, 두 모드의 중복 runtime 제거

## 테스트

Node.js가 있다면 의존성 설치 없이 다음을 실행할 수 있습니다.

```bash
node --test tests/*.test.mjs
```

## Contributing

이 프로젝트는 오픈 소스입니다. 기능 브랜치에서 변경하고 테스트한 뒤 pull request를 보내 주세요. 원 프로젝트와 기존 저작자 정보는 [GitHub 저장소](https://github.com/CWFEPub/CCFEPub)에서 확인할 수 있습니다.

## License

Copyright (c) 2025 maruson08. MIT License로 배포되며 자세한 내용은 [LICENSE](./LICENSE)를 참고하세요.
