# 📚 도서관 좌석 예약 및 관리 시스템 (Library Seat Reservation System)

Google 스프레드시트(Google Apps Script)를 데이터베이스로 연동하여 동작하는 실시간 도서관 좌석 예약 및 관리 웹 애플리케이션입니다.

---

## 🌟 주요 기능

- **실시간 좌석 현황판**: 25개 좌석의 상태(이용 가능, 사용 중, 예약 중) 실시간 반영
- **사용자 예약 & 즉시 입실**: 이용 시작 시간 및 이용 시간(1~4시간) 선택 예약
- **자동 반납 및 만료 처리**: 종료 시간 경과 시 자동으로 좌석 반납 및 완료 상태 처리
- **내 예약 조회 및 반납**: 학번/이름 기반 예약 내역 조회 및 즉시 반납/취소
- **관리자 대시보드**: 전체 좌석 현황 요약, 실시간 예약 목록 검색 및 강제 퇴실/반납 기능
- **Google Sheets 완벽 동기화**: `seats`, `reservations`, `user` 시트와 실시간 연동 (CORS 지원)

---

## 🚀 1. GitHub 업로드 방법

프로젝트 루트 폴더에서 터미널을 열고 아래 명령어를 순서대로 실행하세요.

```bash
# 1. 깃 초기화
git init

# 2. 파일 전체 스테이징
git add .

# 3. 첫 번째 커밋 생성
git commit -m "feat: 도서관 좌석 예약 시스템 초기 커밋"

# 4. 기본 브랜치를 main으로 설정
git branch -M main

# 5. 깃허브 원격 저장소 연결 (본인의 깃허브 저장소 URL로 변경)
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git

# 6. 원격 저장소로 푸시
git push -u origin main
```

---

## ⚡ 2. Vercel(버셀) 배포 가이드

이 프로젝트는 **Vite + React SPA**로 구성되어 있으며, 이미 루트에 Vercel 배포 설정 파일(`vercel.json`)이 포함되어 있습니다.

### 배포 순서
1. [Vercel](https://vercel.com)에 로그인 후 **[Add New...] > [Project]**를 클릭합니다.
2. 위에서 푸시한 **GitHub 저장소를 Import**합니다.
3. 프로젝트 설정(Configure Project):
   - **Framework Preset**: `Vite` (자동 감지됨)
   - **Root Directory**: `./` (기본값)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables (환경 변수) 설정 (권장)**:
   - Key: `VITE_GAS_API_URL`
   - Value: 배포하신 Google Apps Script 웹 앱 URL (예: `https://script.google.com/macros/s/.../exec`)
   > 💡 환경 변수를 등록하지 않더라도, 배포된 웹 사이트 우측 상단의 **[시트연동 · Code.gs]** 모달에서 직접 URL을 입력하고 저장할 수 있습니다.
5. **[Deploy]** 버튼을 클릭하면 약 1분 내에 배포가 완료됩니다!

---

## 📊 3. Google Apps Script(Code.gs) 및 스프레드시트 연동

- **대상 스프레드시트 ID**: `1HFjhDBULAtBK2g32S8Sc6t-z1DbXa_qgKowsH5GgK4w`
- **스크립트 파일**: 프로젝트 루트의 `Code.gs` 파일 참조

### 연동 4단계 순서
1. 구글 스프레드시트 상단 메뉴에서 **[확장 프로그램] > [Apps Script]** 클릭
2. 기존 편집창 코드를 모두 지우고 프로젝트의 `Code.gs` 내용을 전체 복사하여 붙여넣기 후 저장 (`Ctrl + S`)
3. 상단 함수 선택 드롭다운에서 **`setupDatabase`**를 선택하고 **[실행]** 클릭  
   *(스프레드시트에 25개 좌석, user, reservations 탭이 자동 생성 및 초기화됩니다)*
4. 우측 상단 **[배포] > [새 배포]** 클릭:
   - 유형: **웹 앱(Web app)**
   - 다음 사용자 권한으로 실행: **나(Me)**
   - 액세스 권한이 있는 사용자: **모든 사용자(Anyone)**  *(중요!)*
   - 배포 후 생성된 **웹 앱 URL (`https://script.google.com/macros/s/.../exec`)** 복사
5. 웹 애플리케이션의 **[시트연동 · Code.gs]** 모달에 URL을 입력하고 **[연결 테스트]** 후 **[저장 및 적용]**

---

## 💻 4. 로컬 개발 환경 실행

```bash
# 의존성 패키지 설치
npm install

# 로컬 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드 테스트
npm run build
```

---

## 📁 주요 프로젝트 구조

```
├── Code.gs             # 구글 시트 전용 Apps Script 소스코드
├── vercel.json         # Vercel SPA 배포 및 라우팅 설정
├── vite.config.ts      # Vite 빌드 설정
├── package.json        # 프로젝트 의존성 및 스크립트
├── .env.example        # 환경 변수 예시 (VITE_GAS_API_URL 등)
├── index.html          # HTML 메인 엔트리
├── src/
│   ├── App.tsx         # 좌석 예약 UI 및 상태 관리 메인 컴포넌트
│   ├── gasCode.ts      # Code.gs 코드 및 시트 연동 헬퍼
│   ├── main.tsx        # React 렌더링 엔트리
│   └── index.css       # 스타일링 (Tailwind CSS)
└── public/
    └── library_seat_app.html # 단일 파일 독립 실행 버전
```
