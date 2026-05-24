import { showToast } from './auth.js';

export function initAI() {
  const toggleBtn = document.getElementById('btn-ai-toggle');
  const chatWindow = document.getElementById('ai-chat-window');
  const closeBtn = document.getElementById('btn-ai-chat-close');
  const sendBtn = document.getElementById('btn-ai-chat-send');
  const chatInput = document.getElementById('ai-chat-input');
  const chatMessages = document.getElementById('ai-chat-messages');

  if (!toggleBtn || !chatWindow) return;

  // Toggle chat window visibility
  toggleBtn.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
    if (!chatWindow.classList.contains('hidden')) {
      chatInput.focus();
    }
  });

  // Close chat window
  closeBtn.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
  });

  // Action to send message
  const handleSend = () => {
    const text = chatInput.value.trim();
    if (!text) return;

    // Append User Message
    appendMessage(text, 'user');
    chatInput.value = '';

    // Scroll chat window to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show AI typing indicator
    const typingIndicator = showTypingIndicator();

    setTimeout(() => {
      // Remove typing indicator
      typingIndicator.remove();

      // Retrieve matched AI Response
      const reply = getAIResponse(text);
      appendMessage(reply, 'ai');
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 600);
  };

  sendBtn.addEventListener('click', handleSend);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  });

  // Global event listener for click on suggestions
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('ai-suggestion-btn')) {
      const text = e.target.textContent;
      chatInput.value = text;
      handleSend();
    }
  });
}

/**
 * Appends a message bubble inside the chatbot messaging view
 */
function appendMessage(text, sender) {
  const messagesContainer = document.getElementById('ai-chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `ai-message ai-message-${sender}`;
  
  // Format simple markdown-style backticks and bold text into HTML tags
  let formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background-color: var(--color-border-subtle); padding: 1px 3px; border-radius: 3px; font-family: monospace; font-size: 11px;">$1</code>')
    .replace(/\n/g, '<br>');

  msgDiv.innerHTML = formattedText;
  messagesContainer.appendChild(msgDiv);
}

/**
 * Renders a visual typing dots indicator
 */
function showTypingIndicator() {
  const messagesContainer = document.getElementById('ai-chat-messages');
  const indicator = document.createElement('div');
  indicator.className = 'ai-message ai-message-ai ai-typing-indicator';
  indicator.innerHTML = `
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  `;
  messagesContainer.appendChild(indicator);
  return indicator;
}

/**
 * Analyzes natural language keywords to serve contextual instructions
 */
function getAIResponse(query) {
  const q = query.toLowerCase();

  // 1. Connection line features
  if (q.includes('연결선') || q.includes('선') || q.includes('연결') || q.includes('connect') || q.includes('링크선') || q.includes('관계선')) {
    return `🔗 **연결선(Relationship Lines)을 설정하는 방법**입니다:

1. **연결선 달기 (Connect)**:
   - 단축키 \`C\`를 누르거나, 화면 왼쪽 툴바에서 **연결 도구(콘센트 플러그 형태 또는 연결선 아이콘)**를 클릭합니다.
   - 캔버스에서 선을 시작하고 싶은 카드를 마우스로 클릭합니다. (카드가 점선으로 테두리가 쳐지며 활성화됩니다.)
   - 마우스를 연결할 대상 카드 위로 가져가서 클릭합니다.
   - 두 카드 사이에 깔끔한 곡선 형태의 연결선이 자동으로 이어집니다.
   - 도구를 끝내려면 \`ESC\` 키를 누르거나 툴바의 **선택 도구(V)**를 누르세요.

2. **연결선 삭제하기 (Delete)**:
   - 캔버스에 생성된 연결선 자체를 마우스로 직접 클릭합니다. (선택 시 연결선이 굵은 노란색/파란색 선으로 강조됩니다.)
   - 키보드의 \`Delete\` 또는 \`Backspace\` 키를 누르면 바로 삭제됩니다.`;
  }

  // 2. Section card features
  if (q.includes('섹션') || q.includes('그룹') || q.includes('바운드') || q.includes('figma') || q.includes('피그마') || q.includes('section')) {
    return `📁 **피그마 스타일 섹션(Section) 그룹화** 기능입니다:

1. **섹션 카드 추가**:
   - 좌측 툴바에서 **섹션 도구(레이아웃 형태 아이콘)**를 클릭해 생성합니다.
2. **자석식 그룹 드래그 (Figma-like Grouping)**:
   - 섹션의 빈 사각형 영역 안에 일반 카드(텍스트, 체크리스트, 링크 카드 등)를 놓아둡니다.
   - 섹션 카드를 움직이면, 그 안에 배치되어 있던 자식 카드들이 자동으로 인식되어 **다 함께 한 몸처럼 연동 이동**합니다!
3. **크기 변경**:
   - 섹션 카드 오른쪽 아래 대각선 크기 조절 핸들을 잡아당기면 마음대로 크기를 확대/축소할 수 있습니다.`;
  }

  // 3. Sharing features
  if (q.includes('공유') || q.includes('카카오톡') || q.includes('카톡') || q.includes('카카오') || q.includes('보내기')) {
    return `📤 **보드 데이터 공유 및 불러오기** 안내입니다:

1. **보드 공유**:
   - 화면 우측 상단의 **[공유하기]** 버튼을 누릅니다.
   - 현재 화면의 모든 카드 위치, 텍스트 내용, 연결 상태가 안전하게 직렬화(Base64)되어 공유 링크로 생성됩니다.
   - **모바일 환경**: 카카오톡 등으로 주소를 직접 보낼 수 있는 시스템 공유 팝업이 바로 작동합니다.
   - **PC 환경**: 주소가 클립보드에 자동 복사되므로, 카카오톡 단체방이나 이메일 등에 \`Ctrl + V\`로 전달할 수 있습니다.
2. **공유받은 보드 로드**:
   - 공유받은 주소를 브라우저 주소창에 넣고 접속하면 자동으로 상대방이 편집하던 캔버스 화면이 완벽히 복원됩니다.`;
  }

  // 4. Keyboard Shortcuts
  if (q.includes('단축키') || q.includes('키') || q.includes('shortcut') || q.includes('도움말') || q.includes('메뉴')) {
    return `⌨️ **하맘캔버스 조작 단축키 목록**입니다:

* **도구 전환**:
  - \`V\` : 선택 & 이동 도구 (기본 마우스)
  - \`H\` : 화면 스크롤 도구 (마우스로 움켜쥐고 드래그)
  - \`C\` : 카드 연결 도구 (카드 ➜ 카드 연결)
* **네비게이션**:
  - \`Space\` + 마우스 드래그 : 화면 빠르게 이동
  - \`마우스 휠\` : 포인터 기준 화면 줌인 / 줌아웃
  - \`Shift + 1\` : 모든 카드가 화면에 맞춰 보이도록 조정 (Zoom to Fit)
* **삭제**:
  - \`Delete\` / \`Backspace\` : 선택한 카드나 연결선 즉시 삭제`;
  }

  // 5. Link Card features
  if (q.includes('링크') || q.includes('유튜브') || q.includes('미리보기') || q.includes('영상') || q.includes('크롤')) {
    return `🌐 **웹 사이트 및 유튜브 카드 미리보기** 기능입니다:

1. **링크 추가**:
   - 링크 카드 아래 \`[+ 링크 추가]\`를 누르면 하단에 인라인 URL 인풋 창이 나타납니다.
   - 추가하고 싶은 링크 주소를 넣고 확인을 클릭합니다.
2. **정보 자동 수집**:
   - 웹 서버 크롤러를 통해 사이트의 대표 썸네일, 제목, 본문글을 자동으로 긁어옵니다. 수집 중에는 로딩 문구와 스피너가 작동합니다.
3. **미리보기**:
   - 링크 목록 항목에 마우스를 대면(Hover) 우측에 즉시 요약 정보 팝업이 노출됩니다.
   - **유튜브**: 실시간 재생이 가능한 비디오 프레임이 나타납니다.
   - **일반 사이트**: 빈 화면 대신 썸네일과 요약 정보가 담긴 북마크 카드가 제공되어 즉시 내용을 인지할 수 있습니다.`;
  }

  // 6. LocalStorage / Backup
  if (q.includes('저장') || q.includes('백업') || q.includes('내보내기') || q.includes('가져오기') || q.includes('파일')) {
    return `💾 **세이브 데이터 백업 및 저장** 안내입니다:

- **자동 세이브**: 보드 제목, 카드 위치, 작성 글귀 등은 1초 단위로 브라우저 저장소(\`localStorage\`)에 백업됩니다.
- **내보내기 (Export)**: 우측 상단 **[내보내기]**를 클릭해 캔버스 데이터를 \`.json\` 파일로 PC에 백업 보관할 수 있습니다.
- **가져오기 (Import)**: 저장해 둔 JSON 파일을 선택하면 언제든지 동일한 화면으로 캔버스를 복구해 냅니다.`;
  }

  // 7. Theme features
  if (q.includes('테마') || q.includes('라이트') || q.includes('다크') || q.includes('밝게') || q.includes('어둡게')) {
    return `☀️ **테마 모드 전환** 안내입니다:

- 상단바 우측 프로필 근처의 **해(Sun) / 달(Moon) 아이콘**을 클릭해 다크 모드와 라이트 모드를 오갈 수 있습니다.
- 설정 값은 브라우저에 저장되어 재접속 시에도 테마가 그대로 적용됩니다.`;
  }

  // 8. General fallback
  return `❓ **하맘 AI 도우미에서 제안하는 키워드**

입력하신 "${query}"에 해당하는 맞춤 가이드를 찾지 못했습니다. 

💡 **아래 추천하는 질문을 직접 클릭해 보시거나, 키워드를 포함해 물어보세요!**
- **"연결선 어떻게 달아?"** (선 연결 방법)
- **"단축키 목록 보여줘"** (단축키 요약)
- **"피그마 스타일 섹션 기능은?"** (그룹핑 안내)
- **"보드 카카오톡 공유는 어떻게 해?"** (공유 주소 복사)
- **"링크 자동 정보 수집은 무엇인가요?"** (썸네일 파싱)
- **"보드 백업 및 가져오기"** (JSON 파일 복원)`;
}
