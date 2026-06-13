# SyncSlide — Design System

> SyncSlide의 UI는 슬라이드 콘텐츠가 주인공이 되는 **툴 퍼스트** 인터페이스를 지향합니다.
> 화려한 장식 대신 Electric Violet 단일 액센트, 헤어라인 보더, 그리고 넉넉한 여백으로 발표에 집중하는 경험을 만듭니다.

---

## 1. 디자인 철학

- **슬라이드가 주인공**: 모든 UI는 슬라이드 이미지의 시각적 무게를 방해하지 않는다.
- **듀얼 액센트 원칙**: Electric Violet(`#7270ff`)은 주요 액션, Signal Blue(`#1560fb`)는 정보/상태 표시에 사용한다. 나머지는 중성 팔레트를 유지한다.
- **그림자 없는 레이어링**: 그림자나 블러 대신 1px 헤어라인 보더와 배경색 단계 차이로 레이어를 구분한다.
- **모바일 리모컨 예외**: 발표자 리모컨 화면(`/remote`)은 어두운 발표장 환경을 고려해 다크 배경을 사용한다.

---

## 2. 컬러 시스템

### 2.1 핵심 액센트

| 이름 | 값 | 용도 |
|------|-----|------|
| Electric Violet | `#7270ff` | **주 액센트** — Primary CTA 버튼, 활성 탭, 포커스 링, 활성 도구 표시 |
| Signal Blue | `#1560fb` | **보조 액센트** — 소켓 연결 상태 인디케이터, 인라인 링크, 발표장 링크 등 정보/상태 표시 |

### 2.2 텍스트

| 이름 | 값 | 용도 |
|------|-----|------|
| Midnight Ink | `#1c1a2c` | 섹션 타이틀, 최고 강조 텍스트 |
| Deep Indigo | `#2f2b4a` | 본문 제목, 주요 텍스트 |
| Slate | `#4b5563` | 보조 설명, 메타데이터 |
| Silver | `#9ca3af` | 플레이스홀더, 비활성 라벨 |

### 2.3 서피스 & 보더

| 이름 | 값 | 용도 |
|------|-----|------|
| Paper | `#ffffff` | 카드 표면, 인풋 배경, 패널 |
| Bone | `#f9fafb` | 중첩 패널, 조용한 섹션 배경 |
| Pebble | `#f3f4f6` | 페이지 캔버스, 섹션 밴드 |
| Mist | `#e5e7eb` | 카드/인풋/디바이더 보더 (기본 구조선) |
| Fog | `#d9dbda` | 아이콘 스트로크, 저강조 보더 |

### 2.4 다크 서피스 (리모컨 화면 전용)

| 이름 | 값 | 용도 |
|------|-----|------|
| Dark Base | `#0f0e17` | 리모컨 페이지 배경 |
| Dark Surface | `#1c1a2c` | 리모컨 카드/패널 배경 |
| Dark Border | `#2f2b4a` | 리모컨 내 구분선 |
| Dark Text Primary | `#f9fafb` | 리모컨 주요 텍스트 |
| Dark Text Secondary | `#9ca3af` | 리모컨 보조 텍스트 |

### 2.5 그라디언트 (제한적 사용)

```css
/* Sunset — 따뜻한 에너지감, 대기 화면 등 부수적 장식에만 사용 */
linear-gradient(to right, #facc15, #f97316)

/* Bloom — 부드럽고 경쾌한 느낌, 부수적 장식에만 사용 */
linear-gradient(to right, #ec4899, #f87171)
```

> ⚠️ 그라디언트는 전체 배경이나 버튼에 절대 사용하지 않는다.
> 청중 대기 화면의 장식 카드 등 POC 이후 단계에서 선택적으로 활용한다.

---

## 3. 타이포그래피

### 폰트

- **메인**: `Plus Jakarta Sans` (Google Fonts) — 기하학적 휴머니스트 산세리프
- **대체**: `Inter`, `Manrope`
- **코드**: `Google Sans Code` (해당 없으면 생략)

### 타입 스케일

| 역할 | 크기 | Line Height | Letter Spacing | 사용 예 |
|------|------|-------------|----------------|--------|
| caption | 12px | 1.71 | +0.3px | 상태 배지, 타임스탬프 |
| body-sm | 14px | 1.56 | +0.35px | 보조 설명, 메타 |
| body | 16px | 1.5 | +0.4px | 기본 본문, 인풋 |
| subheading | 18px | 1.43 | — | 섹션 소제목 |
| heading-sm | 36px | 1.11 | -0.9px | 페이지 타이틀 |
| heading | 48px | 1.11 | -1.2px | 랜딩/온보딩 헤드라인 |

> ℹ️ 60px display 스케일은 SyncSlide에서 사용하지 않는다 (마케팅 랜딩 불필요).

### 폰트 웨이트

| 웨이트 | 용도 |
|--------|------|
| 700 | 제목, 강조 헤드라인 |
| 600 | UI 레이블, CTA 버튼 텍스트 |
| 500 | 네비게이션, UI 컨트롤 |
| 400 | 본문, 설명 |

---

## 4. 스페이싱 & 레이아웃

**Base unit: 8px**

| 토큰 | 값 | 주요 용도 |
|------|----|----------|
| `--spacing-8` | 8px | 인라인 요소 간격 |
| `--spacing-16` | 16px | 컴포넌트 내부 패딩 |
| `--spacing-24` | 24px | 카드 패딩, element gap |
| `--spacing-32` | 32px | 섹션 내 콘텐츠 간격 |
| `--spacing-48` | 48px | 섹션 간 간격 |
| `--spacing-64` | 64px | 페이지 레벨 여백 |

**레이아웃**
- Page max-width: `1200px`
- Card padding: `24px`
- Element gap: `24px`

---

## 5. Border Radius

| 요소 | 값 |
|------|----|
| 태그 / 배지 | 4px |
| 카드 / 패널 | 8px |
| 인풋 | 8px |
| 버튼 | 12px |
| 아이콘 컨테이너 / 필 | 9999px |

---

## 6. 컴포넌트 가이드

### Primary CTA 버튼
```
배경: Electric Violet #7270ff
텍스트: Paper #ffffff, 16px, weight 600
Border radius: 12px
Padding: 12px 24px
보더 없음
```
> 페이지당 단 하나의 Primary CTA만 허용한다.

### Secondary (Outlined) 버튼
```
배경: Paper #ffffff
보더: Electric Violet #7270ff 1px
텍스트: Electric Violet, 14px, weight 500
Border radius: 12px
Padding: 8px 20px
```

### Ghost / 텍스트 링크
```
배경 없음
텍스트: Deep Indigo #2f2b4a, 14px, weight 500
Hover: underline
Padding: 4px (수직, 히트 에어리어 확보)
```

### 카드
```
배경: Paper #ffffff
보더: Mist #e5e7eb 1px
Border radius: 8px
Padding: 24px
그림자 없음
```

### 인풋
```
배경: Paper #ffffff
보더: Mist #e5e7eb 1px
Border radius: 8px
Padding: 12px 16px
플레이스홀더: Silver #9ca3af
포커스: 보더 → Electric Violet #7270ff (shadow ring 없음)
```

### 상태 배지
```
Border radius: 9999px (pill)
Font: 12px, weight 600
연결됨: Electric Violet 배경 + Paper 텍스트
대기중: Bone 배경 + Slate 텍스트
오류: 시스템 red + Paper 텍스트
```

### 네비게이션 바
```
배경: Paper #ffffff
높이: 64px
Padding: 40px (수평)
하단 보더: Mist #e5e7eb 1px
텍스트: Deep Indigo, 14px, weight 500
sticky on scroll
```

---

## 7. 리모컨 화면 (다크 모드)

`/remote/[sessionId]` 경로는 다크 테마를 적용한다.

```css
/* 리모컨 전용 오버라이드 */
--rc-bg: #0f0e17;
--rc-surface: #1c1a2c;
--rc-border: #2f2b4a;
--rc-text-primary: #f9fafb;
--rc-text-secondary: #9ca3af;
--rc-accent: #7270ff; /* Electric Violet 동일 */
```

**리모컨 버튼 (다크 환경)**
- 슬라이드 이전/다음: `--rc-surface` 배경, 보더 `--rc-border`, 텍스트 `--rc-text-primary`
- 리모컨 시작 CTA: Electric Violet 동일하게 유지

> 다크 배경에서도 Electric Violet 액센트 색상은 그대로 유지한다.

---

## 8. CSS 토큰 (Tailwind v4 / CSS Custom Properties)

```css
@theme {
  /* 액센트 */
  --color-electric-violet: #7270ff;
  --color-signal-blue: #1560fb;

  /* 텍스트 */
  --color-midnight-ink: #1c1a2c;
  --color-deep-indigo: #2f2b4a;
  --color-slate: #4b5563;
  --color-silver: #9ca3af;

  /* 서피스 */
  --color-paper: #ffffff;
  --color-bone: #f9fafb;
  --color-pebble: #f3f4f6;

  /* 보더 */
  --color-mist: #e5e7eb;
  --color-fog: #d9dbda;

  /* 다크 (리모컨 전용) */
  --color-dark-base: #0f0e17;
  --color-dark-surface: #1c1a2c;
  --color-dark-border: #2f2b4a;

  /* 타이포그래피 */
  --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;

  /* 스페이싱 */
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-48: 48px;
  --spacing-64: 64px;

  /* Border Radius */
  --radius-tags: 4px;
  --radius-cards: 8px;
  --radius-inputs: 8px;
  --radius-buttons: 12px;
  --radius-full: 9999px;
}
```

---

## 9. Do's and Don'ts

### ✅ Do
- **Electric Violet** → 액션 (버튼, CTA, 활성 탭, 포커스), **Signal Blue** → 정보/상태 (링크, 연결 상태, 보조 강조) 로 역할을 구분해서 사용한다.
- 레이어 구분은 **배경색 단계 + 1px Mist 보더**로 처리한다.
- 카드 8px / 버튼 12px / 태그 4px의 **3단계 radius 시스템**을 지킨다.
- 헤드라인에서 핵심 키워드 하나만 Electric Violet으로 강조한다.
- 리모컨 화면에는 **다크 서피스 변수**를 사용한다.

### ❌ Don't
- 그라디언트를 버튼, 인풋, 배경에 사용하지 않는다.
- 그림자, 글로우, 블러로 레이어를 구분하지 않는다.
- Teal, Green, Pink 등 추가 브랜드 컬러를 도입하지 않는다.
- 본문 텍스트를 14px 미만으로 쓰지 않는다.
- 한 페이지에 Primary CTA 버튼을 두 개 이상 쓰지 않는다.
