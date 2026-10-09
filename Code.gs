/**
 * ==============================================================================
 * 도서관 좌석 예약 & 관리 시스템 Google Apps Script (Code.gs)
 * 대상 스프레드시트 ID: 1HFjhDBULAtBK2g32S8Sc6t-z1DbXa_qgKowsH5GgK4w
 * ==============================================================================
 * 
 * [설치 및 배포 가이드]
 * 1. 구글 스프레드시트 (ID: 1HFjhDBULAtBK2g32S8Sc6t-z1DbXa_qgKowsH5GgK4w) 열기
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 3. 기존 코드를 모두 지우고 이 Code.gs 내용 전체를 복사하여 붙여넣기
 * 4. 상단 함수 선택 드롭다운에서 'setupDatabase'를 선택하고 [실행] 버튼 클릭 (권한 승인 팝업 시 허용)
 *    -> seats(25개 좌석), reservations(예약 기록), user(학생 명단) 시트가 자동 구성됩니다.
 * 5. 우측 상단 [배포] > [새 배포] 클릭
 *    - 유형 선택: 웹 앱 (Web app)
 *    - 설명: 도서관 좌석 예약 API v2
 *    - 다음 사용자로 실행: 나 (Me)
 *    - 액세스 권한이 있는 사용자: 모든 사용자 (Anyone)  <-- 필수!
 * 6. [배포] 클릭 후 발급되는 '웹 앱 URL'을 복사하여 웹앱 설정에 입력합니다.
 */

// 연결할 스프레드시트 ID
const SPREADSHEET_ID = "1HFjhDBULAtBK2g32S8Sc6t-z1DbXa_qgKowsH5GgK4w";

// 스프레드시트 객체 가져오기 (ID 지정 또는 바인딩된 활성 시트)
function getSpreadsheet() {
  try {
    if (SPREADSHEET_ID && SPREADSHEET_ID !== "YOUR_SPREADSHEET_ID") {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
  } catch (e) {
    Logger.log("openById 실패, getActiveSpreadsheet 시도: " + e.message);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * 1. 데이터베이스 초기화 및 25개 좌석 세팅 함수
 * Apps Script 편집기에서 'setupDatabase' 함수를 1회 실행하세요.
 */
function setupDatabase() {
  const ss = getSpreadsheet();
  if (!ss) {
    throw new Error("스프레드시트를 열 수 없습니다. 스프레드시트 ID를 확인하세요: " + SPREADSHEET_ID);
  }

  // 1) user 시트 (사용자/학생 명단)
  let userSheet = ss.getSheetByName("user");
  if (!userSheet) {
    userSheet = ss.insertSheet("user");
  }
  if (userSheet.getLastRow() === 0) {
    const userHeaders = ["user_id", "name", "role", "dept"];
    const initialUsers = [
      userHeaders,
      ["20240001", "홍길동", "user", "컴퓨터공학과"],
      ["20240002", "김영희", "user", "경영학과"],
      ["20240003", "이철수", "user", "기계공학과"],
      ["20240004", "곽호준", "user", "전자공학과"],
      ["20240005", "백승경", "user", "국어국문학과"],
      ["20240006", "이민환", "user", "디자인학과"],
      ["20240007", "김인현", "user", "화학공학과"],
      ["20240008", "오승환", "user", "수학과"],
      ["20240009", "유미래", "user", "간호학과"],
      ["admin01", "관리자", "admin", "도서관관리팀"]
    ];
    userSheet.getRange(1, 1, initialUsers.length, userHeaders.length).setValues(initialUsers);
    userSheet.getRange(1, 1, 1, userHeaders.length).setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
    userSheet.autoResizeColumns(1, userHeaders.length);
  }

  // 2) seats 시트 (25개 전체 좌석)
  let seatsSheet = ss.getSheetByName("seats");
  if (!seatsSheet) {
    seatsSheet = ss.insertSheet("seats");
  }
  
  // 25개 좌석 헤더 및 기본 데이터 구성
  const seatHeaders = ["seat_id", "zone", "seat_number", "status", "end_time", "userId"];
  const seatRows = [seatHeaders];
  for (let i = 1; i <= 25; i++) {
    const seatId = "S" + (i < 10 ? "0" + i : i);
    let zone = "A구역 (일반)";
    let seatNum = i;
    let status = "available";
    let endTime = "";
    let userId = "";

    if (i <= 10) {
      zone = "A구역 (일반)";
      seatNum = i;
      if (i === 5) status = "disabled"; // 5번 점검중 예시
    } else if (i <= 20) {
      zone = "B구역 (집중학습)";
      seatNum = i - 10;
    } else {
      zone = "C구역 (노트북존)";
      seatNum = i - 20;
    }

    seatRows.push([seatId, zone, seatNum, status, endTime, userId]);
  }

  // 기존 내용 덮어쓰기 or 새로 작성
  seatsSheet.clear();
  seatsSheet.getRange(1, 1, seatRows.length, seatHeaders.length).setValues(seatRows);
  seatsSheet.getRange(1, 1, 1, seatHeaders.length).setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold");
  seatsSheet.autoResizeColumns(1, seatHeaders.length);

  // 3) reservations 시트 (예약 내역 로그)
  let resSheet = ss.getSheetByName("reservations");
  if (!resSheet) {
    resSheet = ss.insertSheet("reservations");
  }
  if (resSheet.getLastRow() === 0) {
    const resHeaders = [
      "reservation_id", "seat_id", "userId", "user_name",
      "start_time", "end_time", "duration_hours", "status", "created_at"
    ];
    resSheet.getRange(1, 1, 1, resHeaders.length).setValues([resHeaders]);
    resSheet.getRange(1, 1, 1, resHeaders.length).setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
    resSheet.autoResizeColumns(1, resHeaders.length);
  }

  Logger.log("성공: 1HFjhDBULAtBK2g32S8Sc6t-z1DbXa_qgKowsH5GgK4w 시트의 25개 좌석 DB 구성 완료!");
  return "초기화 완료 (25개 좌석, user, reservations 시트 세팅됨)";
}

/**
 * 시간 만료 여부 판정 헬퍼 함수
 * endTimeStr: "HH:mm" (예: "15:30") 또는 ISO 형식
 */
function isExpiredTime(endTimeStr) {
  if (!endTimeStr) return false;
  const str = String(endTimeStr).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})$/);
  const now = new Date();
  
  if (match) {
    const endH = parseInt(match[1], 10);
    const endM = parseInt(match[2], 10);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const endMinutes = endH * 60 + endM;
    return currentMinutes >= endMinutes;
  }
  
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return now.getTime() >= parsed.getTime();
  }
  return false;
}

/**
 * 만료된 좌석 및 예약 자동 상태 갱신 함수
 * (getSeats 또는 조회 시 자동 호출되어 종료시간이 지난 좌석을 available로 자동 반납)
 */
function autoReleaseExpiredSeats(ss) {
  try {
    const seatsSheet = ss.getSheetByName("seats");
    const resSheet = ss.getSheetByName("reservations");
    if (!seatsSheet) return;

    const seatData = seatsSheet.getDataRange().getValues();
    if (seatData.length <= 1) return;

    // seats 시트 컬럼 인덱스
    // seat_id(0), zone(1), seat_number(2), status(3), end_time(4), userId(5)
    for (let r = 1; r < seatData.length; r++) {
      const status = seatData[r][3];
      const endTime = seatData[r][4];
      if (status === "occupied" && endTime && isExpiredTime(endTime)) {
        // 좌석 사용 가능 상태로 복귀
        seatsSheet.getRange(r + 1, 4).setValue("available");
        seatsSheet.getRange(r + 1, 5).setValue("");
        seatsSheet.getRange(r + 1, 6).setValue("");
      }
    }

    // reservations 시트 상태도 completed로 갱신
    if (resSheet && resSheet.getLastRow() > 1) {
      const resData = resSheet.getDataRange().getValues();
      for (let r = 1; r < resData.length; r++) {
        const resStatus = resData[r][7];
        const resEndTime = resData[r][5];
        if (resStatus === "active" && resEndTime && isExpiredTime(resEndTime)) {
          resSheet.getRange(r + 1, 8).setValue("completed");
        }
      }
    }
  } catch (err) {
    Logger.log("autoReleaseExpiredSeats 에러: " + err.message);
  }
}

/**
 * GET 요청 처리 (doGet)
 */
function doGet(e) {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return jsonResponse({ success: false, message: "구글 스프레드시트에 접근할 수 없습니다. SPREADSHEET_ID를 확인하세요." });
    }

    // 만료된 좌석 자동 해제 실행
    autoReleaseExpiredSeats(ss);

    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getSeats";

    // 0. 연결 상태 확인
    if (action === "checkConnection") {
      return jsonResponse({
        success: true,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        message: "연결 성공 (스프레드시트 정상 연동 중)"
      });
    }

    // 1. 좌석 목록 조회 (getSeats)
    if (action === "getSeats") {
      let sheet = ss.getSheetByName("seats");
      if (!sheet) {
        setupDatabase();
        sheet = ss.getSheetByName("seats");
      }
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return jsonResponse({ success: true, data: [] });
      }

      const headers = data[0];
      const seats = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const seatObj = {
          seat_id: String(row[0] || ""),
          zone: String(row[1] || "A구역 (일반)"),
          seat_number: Number(row[2]) || i,
          status: String(row[3] || "available"),
          end_time: row[4] ? String(row[4]) : undefined,
          userId: row[5] ? String(row[5]) : undefined
        };
        seats.push(seatObj);
      }
      return jsonResponse({ success: true, count: seats.length, data: seats });
    }

    // 2. 특정 사용자의 예약 목록 조회 (getUserReservations)
    if (action === "getUserReservations") {
      const userId = e.parameter.userId ? String(e.parameter.userId).trim() : "";
      if (!userId) {
        return jsonResponse({ success: false, message: "userId 파라미터가 필요합니다." });
      }

      const resSheet = ss.getSheetByName("reservations");
      if (!resSheet || resSheet.getLastRow() <= 1) {
        return jsonResponse({ success: true, data: [] });
      }

      const data = resSheet.getDataRange().getValues();
      const userReservations = [];
      for (let i = data.length - 1; i >= 1; i--) { // 최신순
        const row = data[i];
        if (String(row[2]).trim() === userId) {
          userReservations.push({
            reservation_id: String(row[0]),
            seat_id: String(row[1]),
            userId: String(row[2]),
            user_name: String(row[3] || ""),
            start_time: String(row[4] || ""),
            end_time: String(row[5] || ""),
            duration_hours: Number(row[6]) || 2,
            status: String(row[7] || "active"),
            created_at: row[8] ? String(row[8]) : ""
          });
        }
      }
      return jsonResponse({ success: true, data: userReservations });
    }

    // 3. 전체 예약 내역 조회 (관리자용 getAllReservations)
    if (action === "getAllReservations") {
      const resSheet = ss.getSheetByName("reservations");
      if (!resSheet || resSheet.getLastRow() <= 1) {
        return jsonResponse({ success: true, data: [] });
      }

      const data = resSheet.getDataRange().getValues();
      const allReservations = [];
      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        allReservations.push({
          reservation_id: String(row[0]),
          seat_id: String(row[1]),
          userId: String(row[2]),
          user_name: String(row[3] || ""),
          start_time: String(row[4] || ""),
          end_time: String(row[5] || ""),
          duration_hours: Number(row[6]) || 2,
          status: String(row[7] || "active"),
          created_at: row[8] ? String(row[8]) : ""
        });
      }
      return jsonResponse({ success: true, count: allReservations.length, data: allReservations });
    }

    // 4. 등록된 사용자 목록 조회 (getUsers)
    if (action === "getUsers") {
      const userSheet = ss.getSheetByName("user");
      if (!userSheet || userSheet.getLastRow() <= 1) {
        return jsonResponse({ success: true, data: [] });
      }

      const data = userSheet.getDataRange().getValues();
      const users = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        users.push({
          id: String(row[0]),
          name: String(row[1]),
          role: String(row[2] || "user"),
          dept: String(row[3] || "")
        });
      }
      return jsonResponse({ success: true, data: users });
    }

    return jsonResponse({ success: false, message: "지원하지 않는 action입니다: " + action });
  } catch (err) {
    return jsonResponse({ success: false, message: "서버 처리 중 오류 발생: " + err.toString() });
  }
}

/**
 * POST 요청 처리 (doPost) - 좌석 예약 및 반납
 */
function doPost(e) {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return jsonResponse({ success: false, message: "스프레드시트를 찾을 수 없습니다." });
    }

    autoReleaseExpiredSeats(ss);

    let body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        body = e.parameter || {};
      }
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    const action = body.action;

    // 1. 좌석 예약 (reserveSeat)
    if (action === "reserveSeat") {
      const userId = String(body.userId || "").trim();
      const seatId = String(body.seatId || "").trim();
      const durationHours = Number(body.durationHours) || 2;
      const startTime = String(body.startTime || "").trim();
      const endTime = String(body.endTime || "").trim();

      if (!userId || !seatId) {
        return jsonResponse({ success: false, message: "userId와 seatId는 필수입니다." });
      }

      // [보안/무결성 검증]: user 시트에 실제 존재하는 학생인지 확인! (유령 사용자 예약 원천 차단)
      const userSheet = ss.getSheetByName("user");
      let userName = userId;
      if (userSheet && userSheet.getLastRow() > 1) {
        const userData = userSheet.getDataRange().getValues();
        let userExists = false;
        for (let i = 1; i < userData.length; i++) {
          if (String(userData[i][0]).trim() === userId) {
            userExists = true;
            userName = String(userData[i][1]).trim();
            break;
          }
        }
        if (!userExists) {
          return jsonResponse({
            success: false,
            message: "등록되지 않은 학번(" + userId + ")입니다. user 시트에 등록된 사용자만 예약할 수 있습니다."
          });
        }
      }

      // seats 시트에서 해당 좌석 점유 여부 확인 및 업데이트
      const seatsSheet = ss.getSheetByName("seats");
      if (!seatsSheet) {
        return jsonResponse({ success: false, message: "seats 시트가 존재하지 않습니다." });
      }

      const seatsData = seatsSheet.getDataRange().getValues();
      let seatRowIndex = -1;
      let currentSeatStatus = "";

      for (let i = 1; i < seatsData.length; i++) {
        if (String(seatsData[i][0]).trim().toUpperCase() === seatId.toUpperCase()) {
          seatRowIndex = i + 1; // 1-based row index
          currentSeatStatus = String(seatsData[i][3]).trim();
          break;
        }
      }

      if (seatRowIndex === -1) {
        return jsonResponse({ success: false, message: "존재하지 않는 좌석입니다: " + seatId });
      }

      if (currentSeatStatus === "disabled") {
        return jsonResponse({ success: false, message: seatId + " 좌석은 현재 점검 중으로 이용할 수 없습니다." });
      }

      // 좌석 상태 occupied로 변경
      seatsSheet.getRange(seatRowIndex, 4).setValue("occupied");
      seatsSheet.getRange(seatRowIndex, 5).setValue(endTime);
      seatsSheet.getRange(seatRowIndex, 6).setValue(userId);

      // reservations 시트에 예약 기록 추가
      const resSheet = ss.getSheetByName("reservations");
      const resId = "R-" + Math.floor(1000 + Math.random() * 9000);
      const createdAt = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

      if (resSheet) {
        resSheet.appendRow([
          resId,
          seatId,
          userId,
          userName,
          startTime,
          endTime,
          durationHours,
          "active",
          createdAt
        ]);
      }

      return jsonResponse({
        success: true,
        message: userName + " (" + userId + ") 학생의 " + seatId + " 좌석 예약이 완료되었습니다. (~" + endTime + ")",
        reservationId: resId,
        seatId: seatId,
        endTime: endTime
      });
    }

    // 2. 예약 취소 / 퇴실 반납 (cancelReservation)
    if (action === "cancelReservation") {
      const seatId = String(body.seatId || "").trim();
      const reservationId = String(body.reservationId || "").trim();

      // seats 시트 상태 available로 복원
      const seatsSheet = ss.getSheetByName("seats");
      if (seatsSheet && seatId) {
        const seatsData = seatsSheet.getDataRange().getValues();
        for (let i = 1; i < seatsData.length; i++) {
          if (String(seatsData[i][0]).trim().toUpperCase() === seatId.toUpperCase()) {
            seatsSheet.getRange(i + 1, 4).setValue("available");
            seatsSheet.getRange(i + 1, 5).setValue("");
            seatsSheet.getRange(i + 1, 6).setValue("");
            break;
          }
        }
      }

      // reservations 시트의 상태를 cancelled로 변경
      const resSheet = ss.getSheetByName("reservations");
      if (resSheet) {
        const resData = resSheet.getDataRange().getValues();
        for (let i = 1; i < resData.length; i++) {
          const rowResId = String(resData[i][0]).trim();
          const rowSeatId = String(resData[i][1]).trim();
          if ((reservationId && rowResId === reservationId) || (seatId && rowSeatId === seatId && resData[i][7] === "active")) {
            resSheet.getRange(i + 1, 8).setValue("cancelled");
            break;
          }
        }
      }

      return jsonResponse({
        success: true,
        message: (seatId || "좌석") + " 퇴실 및 반납 처리가 완료되었습니다."
      });
    }

    return jsonResponse({ success: false, message: "지원하지 않는 POST action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, message: "POST 처리 오류: " + err.toString() });
  }
}

/**
 * JSON 응답 생성 헬퍼 함수
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
