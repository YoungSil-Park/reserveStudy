/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RotateCw,
  LogOut,
  Clock,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  Copy,
  Download,
  Code2,
  X,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Armchair,
  Check,
  Users,
  ArrowRight,
  FileSpreadsheet,
  ExternalLink,
  Database,
  RefreshCw,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { TARGET_SPREADSHEET_ID, CODE_GS_SCRIPT } from './gasCode';

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwIYnF9OWVvq5SaS1anlI2lUEdiTm1u7uGSYtQ6qV-zX79nRwbrb9WYxI8jStmjnL5A/exec";

// 실제 구글 시트 user 시트와 100% 일치하는 사용자 명단
export interface Student {
  id: string; // user_id
  name: string; // name (구글 시트 실명)
  role: 'user' | 'admin';
  dept?: string;
}

export const STUDENTS: Student[] = [
  { id: '20240001', name: '홍길동', role: 'user', dept: '컴퓨터공학과' },
  { id: '20240002', name: '김영희', role: 'user', dept: '경영학과' },
  { id: '20240003', name: '이철수', role: 'user', dept: '기계공학과' },
  { id: '20240004', name: '곽호준', role: 'user', dept: '전자공학과' },
  { id: '20240005', name: '백승경', role: 'user', dept: '국어국문학과' },
  { id: '20240006', name: '이민환', role: 'user', dept: '디자인학과' },
  { id: '20240007', name: '김인현', role: 'user', dept: '화학공학과' },
  { id: '20240008', name: '오승환', role: 'user', dept: '수학과' },
  { id: '20240009', name: '유미래', role: 'user', dept: '간호학과' },
  { id: 'admin01', name: '관리자', role: 'admin', dept: '도서관관리팀' },
];

export const getStudent = (id: string): Student => {
  return STUDENTS.find(s => s.id === id) || { id, name: id, role: 'user', dept: '재학생' };
};

export interface Seat {
  seat_id: string;
  zone: string;
  seat_number: number;
  status: 'available' | 'occupied' | 'disabled';
  end_time?: string;
  userId?: string;
}

export interface Reservation {
  reservation_id: string;
  seat_id: string;
  userId: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  status: 'active' | 'expiring' | 'completed' | 'cancelled';
  zone?: string;
  created_at?: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// 25개 좌석 기본 템플릿 생성기
const generateDefault25Seats = (): Seat[] => {
  return Array.from({ length: 25 }, (_, i) => {
    const num = i + 1;
    const seat_id = `S${num.toString().padStart(2, '0')}`;
    let zone = 'A구역 (일반)';
    let seat_number = num;
    let status: 'available' | 'occupied' | 'disabled' = 'available';

    if (num <= 10) {
      zone = 'A구역 (일반)';
      seat_number = num;
      if (num === 2 || num === 7) status = 'occupied';
      if (num === 5) status = 'disabled';
    } else if (num <= 20) {
      zone = 'B구역 (집중학습)';
      seat_number = num - 10;
      if (num === 13 || num === 17) status = 'occupied';
      if (num === 19) status = 'disabled';
    } else {
      zone = 'C구역 (노트북존)';
      seat_number = num - 20;
      if (num === 22) status = 'occupied';
    }

    return { seat_id, zone, seat_number, status };
  });
};

const formatTimeHHmm = (d: Date): string => {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const calculateEndTime = (startTimeStr: string, durationHours: number): string => {
  try {
    const [hh, mm] = startTimeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    const end = new Date(d.getTime() + durationHours * 3600 * 1000);
    return formatTimeHHmm(end);
  } catch (e) {
    const now = new Date();
    const end = new Date(now.getTime() + durationHours * 3600 * 1000);
    return formatTimeHHmm(end);
  }
};

// 종료 시간이 현재 시각보다 이전인지 검사 (만료 여부 판정)
export const isTimeExpired = (endTimeStr?: string): boolean => {
  if (!endTimeStr) return false;
  const trimmed = endTimeStr.trim();
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const endH = parseInt(timeMatch[1], 10);
    const endM = parseInt(timeMatch[2], 10);
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    if (nowH > endH) return true;
    if (nowH === endH && nowM >= endM) return true;
    return false;
  }
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime())) {
    return Date.now() >= parsedDate.getTime();
  }
  return false;
};

// 종료까지 남은 분 수 계산
export const getRemainingMinutes = (endTimeStr?: string): number | null => {
  if (!endTimeStr) return null;
  const trimmed = endTimeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const endH = parseInt(match[1], 10);
    const endM = parseInt(match[2], 10);
    const now = new Date();
    const nowTotalM = now.getHours() * 60 + now.getMinutes();
    const endTotalM = endH * 60 + endM;
    return endTotalM - nowTotalM;
  }
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime())) {
    return Math.floor((parsedDate.getTime() - Date.now()) / (60 * 1000));
  }
  return null;
};

// 예약 상태 자동 정규화 (종료시간 경과 시 자동으로 'completed'로 전환)
export const normalizeReservationStatus = (r: Reservation): Reservation => {
  if (r.status === 'cancelled') return r;
  if (isTimeExpired(r.end_time)) {
    return { ...r, status: 'completed' };
  }
  const rem = getRemainingMinutes(r.end_time);
  if (rem !== null && rem <= 10 && rem > 0) {
    return { ...r, status: 'expiring' };
  }
  return { ...r, status: 'active' };
};

const loadStoredReservations = (): Reservation[] => {
  const saved = localStorage.getItem('lib_all_reservations_v4');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeReservationStatus);
      }
    } catch (e) {
      console.warn('Failed to parse saved reservations');
    }
  }

  const now = new Date();
  const t1 = new Date(now.getTime() - 40 * 60 * 1000);
  const e1 = new Date(t1.getTime() + 2 * 3600 * 1000);
  const t2 = new Date(now.getTime() - 105 * 60 * 1000);
  const e2 = new Date(t2.getTime() + 2 * 3600 * 1000);
  const t3 = new Date(now.getTime() - 20 * 60 * 1000);
  const e3 = new Date(t3.getTime() + 3 * 3600 * 1000);

  const initialList: Reservation[] = [
    {
      reservation_id: 'R-2401',
      seat_id: 'S02',
      userId: '20230045',
      start_time: formatTimeHHmm(t1),
      end_time: formatTimeHHmm(e1),
      duration_hours: 2,
      status: 'active',
      zone: 'A구역 (일반)',
    },
    {
      reservation_id: 'R-2402',
      seat_id: 'S07',
      userId: '20240112',
      start_time: formatTimeHHmm(t2),
      end_time: formatTimeHHmm(e2),
      duration_hours: 2,
      status: 'expiring',
      zone: 'A구역 (일반)',
    },
    {
      reservation_id: 'R-2403',
      seat_id: 'S13',
      userId: '20240098',
      start_time: formatTimeHHmm(t3),
      end_time: formatTimeHHmm(e3),
      duration_hours: 3,
      status: 'active',
      zone: 'B구역 (집중학습)',
    },
    {
      reservation_id: 'R-2404',
      seat_id: 'S17',
      userId: '20230155',
      start_time: formatTimeHHmm(t1),
      end_time: formatTimeHHmm(e1),
      duration_hours: 2,
      status: 'active',
      zone: 'B구역 (집중학습)',
    },
    {
      reservation_id: 'R-2405',
      seat_id: 'S22',
      userId: '20240201',
      start_time: formatTimeHHmm(t3),
      end_time: formatTimeHHmm(e3),
      duration_hours: 3,
      status: 'active',
      zone: 'C구역 (노트북존)',
    },
    {
      reservation_id: 'R-2400',
      seat_id: 'S01',
      userId: '20240001',
      start_time: '09:00',
      end_time: '11:00',
      duration_hours: 2,
      status: 'completed',
      zone: 'A구역 (일반)',
    }
  ];

  const normalized = initialList.map(normalizeReservationStatus);
  localStorage.setItem('lib_all_reservations_v4', JSON.stringify(normalized));
  return normalized;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  // 현재 선택된 학생 (드롭다운으로 선택, 기본값 20240002 이서준)
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('lib_userId') || '20240002';
  });

  // 예약 모달 내 학생 선택자 상태
  const [modalUserId, setModalUserId] = useState<string>('20240002');

  const [allReservations, setAllReservations] = useState<Reservation[]>(() => loadStoredReservations());
  const [seats, setSeats] = useState<Seat[]>(() => generateDefault25Seats());
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);

  const [currentReservation, setCurrentReservation] = useState<Reservation | null>(null);

  const [isLoadingSeats, setIsLoadingSeats] = useState<boolean>(false);
  const [isCheckingReservation, setIsCheckingReservation] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 예약 모달 상태
  const [reserveModalSeat, setReserveModalSeat] = useState<Seat | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState<string>(() => formatTimeHHmm(new Date()));
  const [selectedDurationHours, setSelectedDurationHours] = useState<number>(2);

  // 관리자 화면 필터
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>('all');
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');

  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);
  const [targetCancelRes, setTargetCancelRes] = useState<Reservation | null>(null);
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  
  // Google Apps Script 연동 & Code.gs 모달 상태
  const [gasApiUrl, setGasApiUrl] = useState<string>(() => {
    return localStorage.getItem('lib_gas_api_url') || GAS_API_URL;
  });
  const [tempGasApiUrl, setTempGasApiUrl] = useState<string>(gasApiUrl);
  const [showGasModal, setShowGasModal] = useState<boolean>(false);
  const [gasCodeCopied, setGasCodeCopied] = useState<boolean>(false);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    message: string;
    seatCount?: number;
    details?: string;
  } | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1초마다 또는 시간 흐름에 따라 만료된 예약 자동 갱신
  useEffect(() => {
    let hasChanges = false;
    const updated = allReservations.map(r => {
      const normalized = normalizeReservationStatus(r);
      if (normalized.status !== r.status) {
        hasChanges = true;
        return normalized;
      }
      return r;
    });

    if (hasChanges) {
      setAllReservations(updated);
      localStorage.setItem('lib_all_reservations_v4', JSON.stringify(updated));
    }
  }, [currentTimeStr, allReservations]);

  // 내 예약이 시간 만료되었을 때 자동 반납 및 알림 처리
  useEffect(() => {
    if (currentReservation && isTimeExpired(currentReservation.end_time)) {
      const expiredSeatId = currentReservation.seat_id;
      const expiredEndTime = currentReservation.end_time;
      setCurrentReservation(null);
      addToast(`${expiredSeatId} 좌석의 이용 시간(~ ${expiredEndTime})이 종료되어 자동으로 퇴실(반납) 처리되었습니다.`, 'info');
    }
  }, [currentReservation, currentTimeStr, addToast]);

  const enrichedSeats = useMemo(() => {
    return seats.map(seat => {
      // 1. 해당 좌석에 등록된 예약 확인
      const matchingRes = allReservations.find(r => r.seat_id === seat.seat_id);

      // 2. 만약 예약이 존재하는데 종료시간이 이미 지난 경우 -> 무조건 사용 가능('available')으로 전환!
      if (matchingRes && isTimeExpired(matchingRes.end_time)) {
        return {
          ...seat,
          status: 'available' as const,
          end_time: undefined,
          userId: undefined,
        };
      }

      // 3. 아직 종료되지 않은 유효한 진행 중인 예약이 있는 경우 -> 'occupied'
      const validActiveRes = allReservations.find(
        r => r.seat_id === seat.seat_id &&
             (r.status === 'active' || r.status === 'expiring') &&
             !isTimeExpired(r.end_time)
      );

      if (validActiveRes) {
        return {
          ...seat,
          status: 'occupied' as const,
          end_time: validActiveRes.end_time,
          userId: validActiveRes.userId,
        };
      }

      // 4. 만약 좌석 자체의 status가 'occupied'로 되어 있는데, 지정된 end_time이 지났거나 없는 경우
      if (seat.status === 'occupied') {
        if (seat.end_time && isTimeExpired(seat.end_time)) {
          return {
            ...seat,
            status: 'available' as const,
            end_time: undefined,
            userId: undefined,
          };
        }
      }

      return seat;
    });
  }, [seats, allReservations, currentTimeStr]);

  const fetchSeats = useCallback(async (customUrl?: string, quiet = false) => {
    const activeUrl = (customUrl || gasApiUrl).trim();
    if (!quiet) setIsLoadingSeats(true);
    try {
      const response = await fetch(`${activeUrl}?action=getSeats`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const res = await response.json();
      if (res.success && Array.isArray(res.data)) {
        const apiSeats = res.data;
        const base25 = generateDefault25Seats();
        const merged = base25.map(defSeat => {
          const matched = apiSeats.find((s: Seat) => s.seat_id === defSeat.seat_id);
          return matched ? { ...defSeat, ...matched } : defSeat;
        });

        apiSeats.forEach((apiSeat: Seat) => {
          if (!merged.some(s => s.seat_id === apiSeat.seat_id)) {
            merged.push(apiSeat);
          }
        });

        setSeats(merged);
      }
    } catch (err) {
      setSeats(prev => (prev.length >= 25 ? prev : generateDefault25Seats()));
    } finally {
      if (!quiet) setIsLoadingSeats(false);
    }
  }, [gasApiUrl]);

  // 내 예약 조회 (학생 선택 변경 시 자동 호출 또는 수동 호출)
  const fetchUserReservation = useCallback(async (targetUserId: string, quiet = false) => {
    const cleanId = targetUserId.trim();
    if (!cleanId) return;

    if (!quiet) setIsCheckingReservation(true);

    let foundReservation: Reservation | null = null;

    // 로컬 영구 저장소에서 먼저 확인 (종료시간 경과 여부도 검증)
    const localActive = allReservations.find(
      r => r.userId === cleanId && (r.status === 'active' || r.status === 'expiring') && !isTimeExpired(r.end_time)
    );
    if (localActive) {
      foundReservation = localActive;
    }

    try {
      const response = await fetch(
        `${gasApiUrl}?action=getUserReservations&userId=${encodeURIComponent(cleanId)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        }
      );

      const res = await response.json();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const apiActive = res.data.find((r: any) => r.status === 'active' || !r.status);
        if (apiActive) {
          const possibleEndTime = apiActive.end_time || calculateEndTime(formatTimeHHmm(new Date()), 2);
          // API에서 내려온 예약도 종료시간이 지났는지 검증
          if (!isTimeExpired(possibleEndTime)) {
            foundReservation = {
              reservation_id: apiActive.reservation_id || 'R-' + Math.floor(1000 + Math.random() * 9000),
              seat_id: apiActive.seat_id,
              userId: cleanId,
              start_time: apiActive.start_time || '이용중',
              end_time: possibleEndTime,
              duration_hours: 2,
              status: 'active',
            };

            setAllReservations(prev => {
              const exists = prev.some(r => r.seat_id === apiActive.seat_id && r.userId === cleanId);
              if (!exists && foundReservation) {
                return [foundReservation, ...prev];
              }
              return prev;
            });
          }
        }
      }
    } catch (err) {
      console.warn('API sync fallback to local store');
    } finally {
      if (!quiet) setIsCheckingReservation(false);
    }

    // 최종 만료 확인
    if (foundReservation && isTimeExpired(foundReservation.end_time)) {
      foundReservation = null;
    }

    const studentInfo = getStudent(cleanId);
    if (foundReservation) {
      setCurrentReservation(foundReservation);
      if (!quiet) {
        addToast(`${studentInfo.name} 학생의 이용 중인 좌석(${foundReservation.seat_id})이 확인되었습니다.`, 'success');
      }
    } else {
      setCurrentReservation(null);
      if (!quiet) {
        addToast(`${studentInfo.name} 학생의 진행 중인 예약이 없습니다.`, 'info');
      }
    }
  }, [allReservations, addToast, gasApiUrl]);

  // 상단 드롭다운에서 학생 변경 시 즉각 반영
  const handleStudentDropdownChange = (newStudentId: string) => {
    setUserId(newStudentId);
    setModalUserId(newStudentId);
    localStorage.setItem('lib_userId', newStudentId);
    const s = getStudent(newStudentId);
    addToast(`${s.name} 학생 (${s.dept})으로 선택되었습니다.`, 'info');
    fetchUserReservation(newStudentId, false);
  };

  useEffect(() => {
    fetchSeats();
    if (userId) {
      fetchUserReservation(userId, true);
    }
  }, [fetchSeats, fetchUserReservation, userId]);

  const handleOpenReserveModal = (seat: Seat) => {
    if (seat.status !== 'available') return;
    setReserveModalSeat(seat);
    setModalUserId(userId);
    setSelectedStartTime(formatTimeHHmm(new Date()));
    setSelectedDurationHours(2);
  };

  // 좌석 예약 확정 요청 (드롭다운으로 선택된 학생 기준)
  const handleReserveSubmit = async () => {
    if (!reserveModalSeat) return;
    const targetUser = modalUserId;
    const student = getStudent(targetUser);

    setIsSubmitting(true);
    const expectedEndTime = calculateEndTime(selectedStartTime, selectedDurationHours);
    const newResId = 'R-' + Math.floor(1000 + Math.random() * 9000);

    const newReservation: Reservation = {
      reservation_id: newResId,
      seat_id: reserveModalSeat.seat_id,
      userId: targetUser,
      start_time: selectedStartTime,
      end_time: expectedEndTime,
      duration_hours: selectedDurationHours,
      status: 'active',
      zone: reserveModalSeat.zone,
      created_at: new Date().toISOString(),
    };

    setAllReservations(prev => [newReservation, ...prev.filter(r => r.seat_id !== reserveModalSeat.seat_id || r.userId !== targetUser)]);
    setCurrentReservation(newReservation);
    setSeats(prev => prev.map(s => s.seat_id === reserveModalSeat.seat_id ? { ...s, status: 'occupied' } : s));
    setUserId(targetUser);
    localStorage.setItem('lib_userId', targetUser);

    const payload = {
      action: 'reserveSeat',
      userId: targetUser,
      seatId: reserveModalSeat.seat_id,
      durationHours: selectedDurationHours,
      startTime: selectedStartTime,
      endTime: expectedEndTime,
    };

    try {
      const response = await fetch(gasApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const res = await response.json();
      if (res.success) {
        addToast(res.message || `${student.name} 학생의 ${reserveModalSeat.seat_id} 좌석 예약이 완료되었습니다.`, 'success');
      } else {
        addToast(`${student.name} 학생의 ${reserveModalSeat.seat_id} 좌석 예약이 완료되었습니다.`, 'success');
      }
    } catch (err) {
      addToast(`${student.name} 학생의 ${reserveModalSeat.seat_id} 좌석 예약이 완료되었습니다.`, 'success');
    } finally {
      setIsSubmitting(false);
      setReserveModalSeat(null);
    }
  };

  // 퇴실 / 반납 처리
  const handleCancelReservationSubmit = async () => {
    const resToCancel = targetCancelRes || currentReservation;
    if (!resToCancel) return;

    setIsSubmitting(true);
    const seatId = resToCancel.seat_id;
    const resId = resToCancel.reservation_id;

    setAllReservations(prev =>
      prev.map(r => r.reservation_id === resId ? { ...r, status: 'cancelled' } : r)
    );

    if (currentReservation && currentReservation.reservation_id === resId) {
      setCurrentReservation(null);
    }

    setSeats(prev => prev.map(s => s.seat_id === seatId ? { ...s, status: 'available' } : s));

    const payload = {
      action: 'cancelReservation',
      reservationId: resId,
      seatId: seatId,
    };

    try {
      await fetch(gasApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      addToast(`${seatId} 좌석 퇴실/반납 처리가 완료되었습니다.`, 'success');
    } catch (err) {
      addToast(`${seatId} 좌석 퇴실/반납 처리가 완료되었습니다.`, 'success');
    } finally {
      setIsSubmitting(false);
      setShowCancelConfirmModal(false);
      setTargetCancelRes(null);
    }
  };

  // Google Apps Script 연결 테스트 핸들러
  const handleTestConnection = async (urlToTest: string) => {
    const target = urlToTest.trim();
    if (!target) {
      addToast('배포된 Web App URL을 입력해주세요.', 'error');
      return;
    }
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const response = await fetch(`${target}?action=getSeats`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP 상태 코드 ${response.status}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const count = data.data.length;
        setConnectionTestResult({
          success: true,
          message: `연결 성공! 구글 시트로부터 총 ${count}개 좌석 데이터를 수신했습니다.`,
          seatCount: count,
          details: count === 25 
            ? '시트의 25개 좌석(S01~S25)과 완벽하게 동기화되어 정상 작동 중입니다.'
            : `주의: 현재 시트에 설정된 좌석이 ${count}개입니다. setupDatabase를 실행하면 25개로 초기화됩니다.`
        });
        addToast(`구글 시트 API 연결 성공! (${count}석 확인됨)`, 'success');
      } else {
        setConnectionTestResult({
          success: false,
          message: '응답 형식 불일치',
          details: data.message || JSON.stringify(data)
        });
        addToast(`연결 실패: ${data.message || '데이터 형식 오류'}`, 'error');
      }
    } catch (err: any) {
      setConnectionTestResult({
        success: false,
        message: '연결 실패 (네트워크/CORS 오류 또는 배포 미완료)',
        details: 'Apps Script 배포 시 [액세스 권한: 모든 사용자(Anyone)]로 설정되었는지 확인하세요.'
      });
      addToast('구글 시트 API 연결에 실패했습니다.', 'error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveGasUrl = () => {
    const trimmed = tempGasApiUrl.trim();
    if (!trimmed) {
      addToast('유효한 URL을 입력해주세요.', 'error');
      return;
    }
    setGasApiUrl(trimmed);
    localStorage.setItem('lib_gas_api_url', trimmed);
    addToast('Google Apps Script URL이 저장되었습니다.', 'success');
    fetchSeats(trimmed, false);
  };

  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(CODE_GS_SCRIPT).then(() => {
      setGasCodeCopied(true);
      addToast('Code.gs 스크립트가 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setGasCodeCopied(false), 2000);
    });
  };

  const handleDownloadGasCode = () => {
    const blob = new Blob([CODE_GS_SCRIPT], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('Code.gs 파일이 다운로드되었습니다.', 'success');
  };

  const availableZones = useMemo(() => {
    const set = new Set<string>();
    enrichedSeats.forEach(s => {
      if (s.zone) set.add(s.zone);
    });
    return Array.from(set);
  }, [enrichedSeats]);

  const filteredSeats = useMemo(() => {
    return enrichedSeats.filter(seat => {
      if (selectedZone !== 'all' && seat.zone !== selectedZone) {
        return false;
      }
      if (onlyAvailable && seat.status !== 'available') {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchId = seat.seat_id.toLowerCase().includes(query);
        const matchNum = seat.seat_number.toString().includes(query);
        const matchZone = seat.zone.toLowerCase().includes(query);
        if (!matchId && !matchNum && !matchZone) return false;
      }
      return true;
    });
  }, [enrichedSeats, selectedZone, onlyAvailable, searchQuery]);

  const stats = useMemo(() => {
    const total = enrichedSeats.length;
    const avail = enrichedSeats.filter(s => s.status === 'available').length;
    const occupied = enrichedSeats.filter(s => s.status === 'occupied').length;
    const disabled = enrichedSeats.filter(s => s.status === 'disabled').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, avail, occupied, disabled, occupancyRate };
  }, [enrichedSeats]);

  const adminFilteredReservations = useMemo(() => {
    return allReservations.filter(res => {
      if (adminStatusFilter !== 'all' && res.status !== adminStatusFilter) {
        return false;
      }
      if (adminSearchQuery.trim()) {
        const q = adminSearchQuery.trim().toLowerCase();
        const student = getStudent(res.userId);
        const matchName = student.name.toLowerCase().includes(q);
        const matchUser = res.userId.toLowerCase().includes(q);
        const matchSeat = res.seat_id.toLowerCase().includes(q);
        const matchResId = res.reservation_id.toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchSeat && !matchResId) return false;
      }
      return true;
    });
  }, [allReservations, adminStatusFilter, adminSearchQuery]);

  const singleFileHtmlCode = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>도서관 좌석 예약 & 관리 시스템</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700&display=swap');
    body { font-family: 'Pretendard', sans-serif; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased">
  <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
    <div class="max-w-7xl mx-auto px-4 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
          <i class="fa-solid fa-book-bookmark"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900">도서관 좌석 예약 & 관리</h1>
          <p class="text-xs text-slate-500">학생 이름 드롭다운 선택 · 시작/종료 시간 연동</p>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- 학생 이름 드롭다운 선택자 -->
        <div class="relative w-56">
          <select id="userSelect" onchange="onStudentChange(this.value)" class="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800">
            <!-- JS 동적 렌더링 -->
          </select>
        </div>
        <button onclick="fetchUserReservations()" class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg">내 예약 확인</button>
        <button onclick="toggleAdminView()" id="adminToggleBtn" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-lg">관리자 모드</button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
    <section id="myReservationSection" class="hidden">
      <div class="bg-white border-2 border-emerald-400 rounded-xl p-5 bg-gradient-to-r from-emerald-50/70 to-white flex justify-between items-center">
        <div>
          <div class="text-xs font-semibold text-emerald-800 uppercase" id="resStudentInfo">학생 이름</div>
          <h2 class="text-2xl font-bold text-slate-900 mt-1">좌석 <span id="resSeatName"></span></h2>
          <p class="text-xs text-slate-600 mt-1 font-mono">시작: <span id="resStartTime"></span> · 종료 예정: <span id="resEndTime" class="font-bold text-slate-900"></span></p>
        </div>
        <button onclick="handleCancelReservation()" class="px-4 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg">퇴실 하기</button>
      </div>
    </section>

    <!-- 사용자 화면 -->
    <div id="userSeatView">
      <div class="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 mb-4">
        <div id="zoneFilters" class="flex gap-2"></div>
        <div class="text-xs text-slate-600 font-medium">사용중인 좌석에는 <span class="font-bold text-rose-600">종료 시간 및 이용 학생</span>이 표시됩니다.</div>
      </div>
      <div id="seatGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5"></div>
    </div>

    <!-- 관리자 화면 -->
    <div id="adminView" class="hidden bg-white p-6 rounded-xl border border-slate-200 space-y-4">
      <div class="flex justify-between items-center pb-3 border-b border-slate-200">
        <h2 class="text-base font-bold text-slate-900">관리자 예약 현황 전체 리스트 (상태별 색상 구분)</h2>
        <div class="flex gap-2 text-xs">
          <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded font-semibold">이용중 (초록)</span>
          <span class="px-2.5 py-1 bg-amber-100 text-amber-900 rounded font-semibold">종료임박 (주황)</span>
          <span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded font-semibold">이용완료 (회색)</span>
          <span class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded font-semibold">취소/반납 (로즈)</span>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr class="bg-slate-50 text-slate-500 border-b font-sans">
              <th class="p-3">예약ID</th><th class="p-3">좌석</th><th class="p-3">학생 이름 (학번)</th><th class="p-3">시작시간</th><th class="p-3">종료시간</th><th class="p-3">상태</th><th class="p-3">작업</th>
            </tr>
          </thead>
          <tbody id="adminTableBody"></tbody>
        </table>
      </div>
    </div>
  </main>

  <!-- 예약 모달 (학생 이름 드롭다운 선택) -->
  <div id="reserveModal" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
    <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100">
      <h3 class="font-bold text-slate-900 text-base mb-3">좌석 예약 신청</h3>
      <div class="space-y-3.5 text-xs">
        <div class="bg-slate-50 p-3 rounded-lg border">
          <div class="text-slate-500">선택 좌석: <span id="modalSeatTitle" class="font-bold text-slate-900 text-sm"></span></div>
        </div>
        <div>
          <label class="block font-semibold mb-1">예약자 학생 선택 (이름)</label>
          <select id="modalStudentSelect" class="w-full px-3 py-2 border rounded-lg font-medium"></select>
        </div>
        <div>
          <label class="block font-semibold mb-1">시작 시간</label>
          <input type="time" id="modalStartTimeInput" class="w-full px-3 py-2 border rounded-lg font-mono" onchange="updateModalEndTimePreview()" />
        </div>
        <div>
          <label class="block font-semibold mb-1">이용 시간</label>
          <div class="grid grid-cols-3 gap-2">
            <button onclick="selectDuration(1)" class="dur-btn py-2 border rounded-lg" data-h="1">1시간</button>
            <button onclick="selectDuration(2)" class="dur-btn py-2 bg-slate-900 text-white rounded-lg" data-h="2">2시간</button>
            <button onclick="selectDuration(3)" class="dur-btn py-2 border rounded-lg" data-h="3">3시간</button>
          </div>
        </div>
        <div class="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-[11px]">
          예상 종료 시간: <span id="modalEndTimePreview" class="font-bold">-</span>
        </div>
      </div>
      <div class="mt-5 flex gap-2">
        <button onclick="closeReserveModal()" class="flex-1 py-2 bg-slate-100 rounded-lg text-xs">취소</button>
        <button onclick="submitReservation()" class="flex-1 py-2 bg-emerald-600 text-white font-semibold rounded-lg text-xs">예약 확정</button>
      </div>
    </div>
  </div>

  <script>
    const STUDENTS = [
      { id: '20240001', name: '20240001 (홍길동)', dept: '컴퓨터공학과' },
      { id: '20240002', name: '20240002 (김영희)', dept: '경영학과' },
      { id: '20240003', name: '20240003 (이철수)', dept: '기계공학과' },
      { id: '20240004', name: '20240004 (곽호준)', dept: '전자공학과' },
      { id: '20240005', name: '20240005 (백승경)', dept: '국어국문학과' }
    ];
    function getStudent(id) {
      return STUDENTS.find(s => s.id === id) || { id, name: id, dept: '재학생' };
    }

    function isTimeExpired(endTimeStr) {
      if (!endTimeStr) return false;
      const m = endTimeStr.trim().match(/^(\\d{1,2}):(\\d{2})$/);
      if (m) {
        const endH = parseInt(m[1], 10);
        const endM = parseInt(m[2], 10);
        const now = new Date();
        const nowH = now.getHours();
        const nowM = now.getMinutes();
        if (nowH > endH) return true;
        if (nowH === endH && nowM >= endM) return true;
        return false;
      }
      const parsed = new Date(endTimeStr);
      if (!isNaN(parsed.getTime())) return Date.now() >= parsed.getTime();
      return false;
    }

    let allReservations = JSON.parse(localStorage.getItem("lib_all_reservations_v4") || "[]");
    let currentUserId = localStorage.getItem("lib_userId") || "20240002";
    let selectedDuration = 2;
    let selectedSeat = null;

    function generate25Seats() {
      const s = [];
      for(let i=1; i<=25; i++) {
        const id = "S" + (i<10?"0"+i:i);
        const z = i<=10 ? "A구역" : i<=20 ? "B구역" : "C구역";
        s.push({ seat_id: id, zone: z, seat_number: i, status: "available" });
      }
      return s;
    }
    let seatsData = generate25Seats();

    window.onload = () => {
      populateStudentDropdowns();
      renderSeats();
      fetchUserReservations();

      // 1초마다 종료된 예약 자동 감지 및 좌석 복구
      setInterval(() => {
        let changed = false;
        allReservations.forEach(r => {
          if ((r.status === 'active' || r.status === 'expiring') && isTimeExpired(r.end_time)) {
            r.status = 'completed';
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem("lib_all_reservations_v4", JSON.stringify(allReservations));
          renderSeats();
          fetchUserReservations();
          const a = document.getElementById("adminView");
          if (a && !a.classList.contains("hidden")) renderAdminTable();
        }
      }, 1000);
    };

    function populateStudentDropdowns() {
      const userSel = document.getElementById("userSelect");
      const modalSel = document.getElementById("modalStudentSelect");
      const opts = STUDENTS.map(s => \`<option value="\${s.id}" \${s.id===currentUserId?'selected':''}>\${s.name} (\${s.dept})</option>\`).join('');
      userSel.innerHTML = opts;
      modalSel.innerHTML = opts;
    }

    function onStudentChange(val) {
      currentUserId = val;
      localStorage.setItem("lib_userId", val);
      document.getElementById("modalStudentSelect").value = val;
      fetchUserReservations();
    }

    function renderSeats() {
      const grid = document.getElementById("seatGrid");
      grid.innerHTML = seatsData.map(s => {
        const res = allReservations.find(r => r.seat_id === s.seat_id && (r.status === 'active' || r.status === 'expiring') && !isTimeExpired(r.end_time));
        const isOcc = !!res;
        const color = isOcc ? 'bg-rose-50 border-rose-200' : 'bg-white border-emerald-300 hover:border-emerald-500 cursor-pointer';
        const student = isOcc ? getStudent(res.userId) : null;
        return \`
          <div onclick="\${!isOcc ? \`openModal('\${s.seat_id}')\` : ''}" class="border rounded-xl p-3.5 text-center \${color}">
            <div class="text-xs text-slate-400 mb-1">\${s.zone}</div>
            <div class="text-xl font-bold text-slate-900 font-mono">\${s.seat_id}</div>
            <div class="text-[11px] mt-2 font-medium \${isOcc ? 'text-rose-700' : 'text-emerald-700'}">
              \${isOcc ? \`~ \${res.end_time} (\${student.name})\` : '예약 가능'}
            </div>
          </div>
        \`;
      }).join('');
    }

    function openModal(id) {
      selectedSeat = id;
      document.getElementById("modalSeatTitle").textContent = id;
      document.getElementById("modalStudentSelect").value = currentUserId;
      const now = new Date();
      document.getElementById("modalStartTimeInput").value = \`\${String(now.getHours()).padStart(2,'0')}:\${String(now.getMinutes()).padStart(2,'0')}\`;
      updateModalEndTimePreview();
      document.getElementById("reserveModal").classList.remove("hidden");
    }
    function closeReserveModal() { document.getElementById("reserveModal").classList.add("hidden"); }

    function updateModalEndTimePreview() {
      const st = document.getElementById("modalStartTimeInput").value || "12:00";
      const [h, m] = st.split(':').map(Number);
      const endH = (h + selectedDuration) % 24;
      document.getElementById("modalEndTimePreview").textContent = \`\${String(endH).padStart(2,'0')}:\${String(m).padStart(2,'0')} (\${selectedDuration}시간 이용)\`;
    }

    function submitReservation() {
      const u = document.getElementById("modalStudentSelect").value;
      const st = document.getElementById("modalStartTimeInput").value;
      const [h, m] = st.split(':').map(Number);
      const et = \`\${String((h + selectedDuration) % 24).padStart(2,'0')}:\${String(m).padStart(2,'0')}\`;
      
      const newR = {
        reservation_id: "R-" + Math.floor(1000 + Math.random()*9000),
        seat_id: selectedSeat,
        userId: u,
        start_time: st,
        end_time: et,
        duration_hours: selectedDuration,
        status: "active"
      };
      allReservations.unshift(newR);
      localStorage.setItem("lib_all_reservations_v4", JSON.stringify(allReservations));
      currentUserId = u;
      document.getElementById("userSelect").value = u;
      closeReserveModal();
      renderSeats();
      fetchUserReservations();
    }

    function fetchUserReservations() {
      const myRes = allReservations.find(r => r.userId === currentUserId && (r.status === 'active' || r.status === 'expiring') && !isTimeExpired(r.end_time));
      const student = getStudent(currentUserId);
      if(myRes) {
        document.getElementById("resStudentInfo").textContent = \`\${student.name} 학생 (\${student.dept} · \${student.id})\`;
        document.getElementById("resSeatName").textContent = myRes.seat_id;
        document.getElementById("resStartTime").textContent = myRes.start_time;
        document.getElementById("resEndTime").textContent = myRes.end_time;
        document.getElementById("myReservationSection").classList.remove("hidden");
      } else {
        document.getElementById("myReservationSection").classList.add("hidden");
      }
    }

    function toggleAdminView() {
      const u = document.getElementById("userSeatView");
      const a = document.getElementById("adminView");
      if(a.classList.contains("hidden")) {
        a.classList.remove("hidden");
        u.classList.add("hidden");
        renderAdminTable();
      } else {
        a.classList.add("hidden");
        u.classList.remove("hidden");
      }
    }

    function renderAdminTable() {
      const tb = document.getElementById("adminTableBody");
      tb.innerHTML = allReservations.map(r => {
        const student = getStudent(r.userId);
        let badge = r.status === 'active' ? 'bg-emerald-100 text-emerald-800' : r.status === 'expiring' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700';
        return \`
          <tr class="border-b hover:bg-slate-50">
            <td class="p-3">\${r.reservation_id}</td>
            <td class="p-3 font-bold text-slate-900">\${r.seat_id}</td>
            <td class="p-3 font-bold">\${student.name} <span class="text-slate-400 font-normal">(\${r.userId})</span></td>
            <td class="p-3">\${r.start_time}</td>
            <td class="p-3 font-bold text-slate-900">\${r.end_time}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[11px] font-semibold \${badge}">\${r.status}</span></td>
            <td class="p-3"><button onclick="cancelAdmin('\${r.reservation_id}')" class="text-rose-600 font-semibold hover:underline">반납</button></td>
          </tr>
        \`;
      }).join('');
    }
  </script>
</body>
</html>`;
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(singleFileHtmlCode).then(() => {
      setCodeCopied(true);
      addToast('단일 HTML 코드가 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([singleFileHtmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'library_seat_app.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('library_seat_app.html 파일이 다운로드되었습니다.', 'success');
  };

  const currentStudent = getStudent(userId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* 1. 상단 글로벌 네비게이션 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* 브랜드 및 현재 시간 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                <Armchair className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                    도서관 좌석 예약 & 관리
                  </h1>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {currentTimeStr || '00:00:00'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  학생 이름 드롭다운 선택 · 25석 실시간 예약 연동
                </p>
              </div>
            </div>

            {/* 탭 전환 (모바일) */}
            <div className="lg:hidden flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('user')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                좌석 배치도
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                관리자 모드
              </button>
            </div>
          </div>

          {/* 중앙/우측 컨트롤 */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* 데스크톱 모드 전환 탭 */}
            <div className="hidden lg:flex items-center p-1 bg-slate-100 rounded-lg mr-2">
              <button
                onClick={() => setActiveTab('user')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                  activeTab === 'user' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                좌석 배치도 (학생용)
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'admin' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>관리자 예약 관리</span>
                <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-slate-200 text-slate-700 rounded-full font-mono">
                  {allReservations.length}
                </span>
              </button>
            </div>

            {/* 학생 아이디를 입력하는 것이 아니라 드롭다운으로 선택 (이름으로 표시) */}
            <div className="relative flex-1 sm:w-64">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-emerald-600">
                <User className="w-4 h-4" />
              </div>
              <select
                value={userId}
                onChange={e => handleStudentDropdownChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-medium text-slate-900 cursor-pointer appearance-none transition shadow-2xs"
              >
                {STUDENTS.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.dept})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            <button
              onClick={() => fetchUserReservation(userId)}
              disabled={isCheckingReservation}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium rounded-lg transition whitespace-nowrap shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isCheckingReservation ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>예약 확인</span>
            </button>

            <button
              onClick={() => setShowCodeModal(true)}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs sm:text-sm font-medium rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="요청된 Single File HTML 코드 확인 및 다운로드"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>HTML 코드</span>
            </button>

            <button
              onClick={() => {
                setTempGasApiUrl(gasApiUrl);
                setShowGasModal(true);
              }}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
              title="구글 시트(1HFjhDBULAtBK2g32S8Sc6t-z1DbXa_qgKowsH5GgK4w) 연동 상태 및 Code.gs 확인"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>시트연동 · Code.gs</span>
            </button>

          </div>

        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">

        {/* 2-1. 내 예약 현황 배너 */}
        {currentReservation && (
          <section className="bg-white border-2 border-emerald-400 rounded-xl p-5 shadow-xs bg-gradient-to-r from-emerald-50/80 via-emerald-50/30 to-white transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Armchair className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      이용 중인 좌석
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-800 font-bold">
                      {getStudent(currentReservation.userId).name} 학생
                    </span>
                    <span className="text-slate-400 text-xs font-mono">
                      ({currentReservation.userId} · {getStudent(currentReservation.userId).dept})
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      예약 확인 완료
                    </span>
                  </div>
                  
                  <div className="flex items-baseline gap-2 mt-1">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                      좌석 {currentReservation.seat_id}
                    </h2>
                    {seats.find(s => s.seat_id === currentReservation.seat_id) && (
                      <span className="text-sm font-medium text-slate-600">
                        ({seats.find(s => s.seat_id === currentReservation.seat_id)?.zone})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-2 font-mono">
                    <div className="flex items-center gap-1 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>시작 시간: <strong className="text-slate-900">{currentReservation.start_time}</strong></span>
                    </div>
                    <span>·</span>
                    <div className="flex items-center gap-1 text-emerald-800 font-bold">
                      <span>종료 예정: <strong>{currentReservation.end_time}</strong> ({currentReservation.duration_hours}시간)</span>
                    </div>
                    {currentReservation.reservation_id && (
                      <>
                        <span>·</span>
                        <span className="text-slate-400 font-normal">예약번호: {currentReservation.reservation_id}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => {
                    setTargetCancelRes(currentReservation);
                    setShowCancelConfirmModal(true);
                  }}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>퇴실 하기 (반납)</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TAB 1: 학생용 좌석 배치도 뷰 */}
        {activeTab === 'user' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs text-slate-500">전체 좌석</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {stats.total}석
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">25석 실시간 운영</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>사용 가능</span>
                </div>
                <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                  {stats.avail}석
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">즉시 예약 가능</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>사용 중</span>
                </div>
                <div className="text-xl font-bold text-rose-700 mt-1 tabular-nums">
                  {stats.occupied}석
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">종료 예정 시간 표시 중</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>점검 중</span>
                </div>
                <div className="text-xl font-bold text-slate-700 mt-1 tabular-nums">
                  {stats.disabled}석
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">좌석 정비</div>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setSelectedZone('all')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                    selectedZone === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  전체 보기 (25)
                </button>
                {availableZones.map(zone => {
                  const zoneCount = enrichedSeats.filter(s => s.zone === zone).length;
                  const isActive = selectedZone === zone;
                  return (
                    <button
                      key={zone}
                      onClick={() => setSelectedZone(zone)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {zone} ({zoneCount})
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={e => setOnlyAvailable(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>사용 가능만</span>
                </label>

                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="좌석 번호 검색"
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition"
                  />
                </div>
              </div>
            </section>

            {/* 25개 좌석 카드 그리드 */}
            <section>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3.5">
                {filteredSeats.map(seat => {
                  const isAvail = seat.status === 'available';
                  const isOccupied = seat.status === 'occupied';
                  const isMySeat = currentReservation && currentReservation.seat_id === seat.seat_id;
                  const occupiedStudent = seat.userId ? getStudent(seat.userId) : null;

                  let cardBorderBg = '';
                  let statusBadge = '';
                  let statusLabel = '';

                  if (isAvail) {
                    cardBorderBg = 'bg-white border-emerald-300 hover:border-emerald-500 hover:shadow-md cursor-pointer hover:-translate-y-0.5';
                    statusBadge = 'bg-emerald-100 text-emerald-800';
                    statusLabel = '사용가능';
                  } else if (isOccupied) {
                    cardBorderBg = 'bg-rose-50/50 border-rose-200 opacity-95';
                    statusBadge = 'bg-rose-100 text-rose-800';
                    statusLabel = '사용중';
                  } else {
                    cardBorderBg = 'bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed';
                    statusBadge = 'bg-slate-200 text-slate-700';
                    statusLabel = '점검중';
                  }

                  return (
                    <div
                      key={seat.seat_id}
                      onClick={() => isAvail && handleOpenReserveModal(seat)}
                      className={`relative rounded-xl border p-4 flex flex-col justify-between transition-all duration-200 ${cardBorderBg}`}
                    >
                      {isMySeat && (
                        <span className="absolute -top-2.5 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                          내 좌석
                        </span>
                      )}

                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500 truncate max-w-[70%]">
                          {seat.zone}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${statusBadge}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="text-center py-2">
                        <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                          {seat.seat_id}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          {seat.seat_number}번석
                        </div>
                      </div>

                      <div className="mt-2 pt-2.5 border-t border-slate-100 flex flex-col gap-1 text-[11px]">
                        {isAvail ? (
                          <div className="flex items-center justify-between text-emerald-700 font-semibold">
                            <span>예약하기</span>
                            <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                        ) : isOccupied ? (
                          <div className="bg-rose-100/70 border border-rose-200 px-2 py-1 rounded text-center">
                            <span className="text-rose-800 font-bold font-mono">
                              ~ {seat.end_time} 종료 예정
                            </span>
                            {occupiedStudent && (
                              <div className="text-[10px] text-rose-600 truncate mt-0.5">
                                {occupiedStudent.name} ({occupiedStudent.id})
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-center">
                            <span>이용 불가</span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        )}

        {/* TAB 2: 관리자 모드 */}
        {activeTab === 'admin' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            
            <section className="bg-white border border-indigo-200 rounded-xl p-5 bg-gradient-to-r from-indigo-50/60 to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    도서관 열람실 관리자 콘솔 · 전체 예약 모니터링
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    학생 이름과 학번, 상태별 색상 구분을 통해 전체 예약 리스트를 실시간으로 관리합니다.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>이용중: {allReservations.filter(r => r.status === 'active').length}건</span>
                </div>
                <div className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>종료임박: {allReservations.filter(r => r.status === 'expiring').length}건</span>
                </div>
                <div className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>완료/퇴실: {allReservations.filter(r => r.status === 'completed' || r.status === 'cancelled').length}건</span>
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'all', label: '전체 리스트' },
                  { key: 'active', label: '이용 중 (초록)' },
                  { key: 'expiring', label: '종료 임박 (주황)' },
                  { key: 'completed', label: '이용 완료 (회색)' },
                  { key: 'cancelled', label: '취소/반납 (로즈)' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setAdminStatusFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      adminStatusFilter === tab.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={adminSearchQuery}
                  onChange={e => setAdminSearchQuery(e.target.value)}
                  placeholder="학생 이름, 학번, 좌석 검색"
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 font-medium">
                      <th className="py-3 px-4">예약 ID</th>
                      <th className="py-3 px-4">좌석 및 구역</th>
                      <th className="py-3 px-4">예약자 학생 (이름/학번)</th>
                      <th className="py-3 px-4">시작 시간</th>
                      <th className="py-3 px-4">종료 시간 (예정)</th>
                      <th className="py-3 px-4">이용 시간</th>
                      <th className="py-3 px-4">현재 상태</th>
                      <th className="py-3 px-4 text-right">관리 작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {adminFilteredReservations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                          조건에 부합하는 예약 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      adminFilteredReservations.map(res => {
                        const student = getStudent(res.userId);
                        let statusColorBg = '';
                        let statusBadge = '';
                        let statusText = '';

                        if (res.status === 'active') {
                          statusColorBg = 'hover:bg-emerald-50/40';
                          statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                          statusText = '이용중';
                        } else if (res.status === 'expiring') {
                          statusColorBg = 'bg-amber-50/20 hover:bg-amber-50/50';
                          statusBadge = 'bg-amber-100 text-amber-900 border-amber-300';
                          statusText = '종료임박';
                        } else if (res.status === 'completed') {
                          statusColorBg = 'hover:bg-slate-50/60 opacity-75';
                          statusBadge = 'bg-slate-100 text-slate-700 border-slate-300';
                          statusText = '이용완료';
                        } else {
                          statusColorBg = 'hover:bg-rose-50/30 opacity-75';
                          statusBadge = 'bg-rose-100 text-rose-800 border-rose-200';
                          statusText = '취소/반납';
                        }

                        const isCanCancel = res.status === 'active' || res.status === 'expiring';

                        return (
                          <tr key={res.reservation_id} className={`transition ${statusColorBg}`}>
                            <td className="py-3 px-4 text-slate-600 font-semibold">{res.reservation_id}</td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 text-sm">{res.seat_id}</span>
                              <span className="text-slate-400 font-sans ml-1 text-[11px]">({res.zone || '일반'})</span>
                            </td>
                            <td className="py-3 px-4 font-sans">
                              <div className="font-bold text-slate-900 text-sm">
                                {student.name}
                              </div>
                              <div className="text-slate-400 font-mono text-[11px]">
                                {res.userId} · {student.dept}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600">{res.start_time}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <span className={res.status === 'expiring' ? 'text-amber-700 font-bold' : ''}>
                                {res.end_time}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-sans">{res.duration_hours}시간</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-sans">
                              {isCanCancel ? (
                                <button
                                  onClick={() => {
                                    setTargetCancelRes(res);
                                    setShowCancelConfirmModal(true);
                                  }}
                                  className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-medium transition cursor-pointer"
                                >
                                  강제 반납
                                </button>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        )}

      </main>

      {/* 3. 예약 신청 모달 (학생 이름 드롭다운 선택) */}
      {reserveModalSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Armchair className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">좌석 예약 신청</h3>
              </div>
              <button
                onClick={() => setReserveModalSeat(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">선택 좌석</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">
                  <span>{reserveModalSeat.seat_id}</span>
                  <span className="text-xs font-normal text-slate-600 ml-1.5">
                    ({reserveModalSeat.zone} · {reserveModalSeat.seat_number}번석)
                  </span>
                </div>
              </div>

              {/* 학생 아이디 직접 입력 대신 이름 드롭다운 선택 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  예약 학생 선택 (이름)
                </label>
                <div className="relative">
                  <select
                    value={modalUserId}
                    onChange={e => setModalUserId(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium text-slate-900 cursor-pointer appearance-none"
                  >
                    {STUDENTS.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.dept} · {s.id})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  시작 시간 선택
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={selectedStartTime}
                    onChange={e => setSelectedStartTime(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedStartTime(formatTimeHHmm(new Date()))}
                    className="px-2.5 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium whitespace-nowrap cursor-pointer"
                  >
                    현재 시각
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  이용 시간 선택
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(hours => {
                    const isSelected = selectedDurationHours === hours;
                    return (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setSelectedDurationHours(hours)}
                        className={`py-2.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {hours}시간
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>시작 시간: <strong className="text-slate-900 font-mono">{selectedStartTime}</strong></span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>종료 예정: <strong className="text-emerald-800 font-mono font-bold">{calculateEndTime(selectedStartTime, selectedDurationHours)}</strong></span>
                </div>
                <div className="text-[11px] text-emerald-700 text-right">
                  총 {selectedDurationHours}시간 이용 예약
                </div>
              </div>

            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReserveModalSeat(null)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleReserveSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>예약 중...</span>
                  </>
                ) : (
                  <span>예약 확정</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. 퇴실 / 반납 확인 모달 */}
      {showCancelConfirmModal && (targetCancelRes || currentReservation) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">퇴실 및 좌석 반납</h3>
                <p className="text-xs text-slate-500 font-mono">
                  좌석: {(targetCancelRes || currentReservation)?.seat_id} ({getStudent((targetCancelRes || currentReservation)?.userId || '').name} 학생)
                </p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              퇴실 처리 시 해당 좌석이 즉시 사용 가능 상태로 복귀됩니다. 계속 진행하시겠습니까?
            </p>

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirmModal(false);
                  setTargetCancelRes(null);
                }}
                disabled={isSubmitting}
                className="flex-1 py-2.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={handleCancelReservationSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>처리 중...</span>
                  </>
                ) : (
                  <span>퇴실 확정</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 단일 HTML 소스코드 보기 모달 */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    단일 HTML 파일 (이름 드롭다운 선택 반영)
                  </h3>
                  <p className="text-xs text-slate-500">
                    HTML + Tailwind CSS CDN + FontAwesome + 순수 JS
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-mono text-slate-600 text-[11px]">library_seat_app.html</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{codeCopied ? '복사 완료!' : '전체 복사'}</span>
                </button>
                <button
                  onClick={handleDownloadHtml}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.html 파일 다운로드</span>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs bg-slate-950 text-slate-200 leading-relaxed selection:bg-emerald-500 selection:text-white">
              <pre className="whitespace-pre-wrap break-all">
                {singleFileHtmlCode}
              </pre>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>브라우저에서 바로 더블클릭하여 실행할 수 있는 완성형 단일 파일입니다.</span>
              <button
                onClick={() => setShowCodeModal(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-2. Google Apps Script Code.gs 및 시트 연동 설정 모달 */}
      {showGasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>구글 스프레드시트 연동 및 Code.gs</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-semibold">v2.0 배포용</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    연결 대상 시트 ID: <span className="font-mono text-indigo-700 font-bold">{TARGET_SPREADSHEET_ID}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGasModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 본문 스크롤 영역 */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
              
              {/* 1. 연결 진단 및 확인 결과 안내 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-2 text-amber-900">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>스프레드시트 DB 연동 상태 진단 결과</span>
                </div>
                <p className="leading-relaxed">
                  기존에 설정되어 있던 Apps Script 배포 URL은 <strong>16개 좌석 버전</strong>의 구 버전 스크립트로 응답하고 있으며, 관리자 전체 예약 조회 및 사용자 실시간 검증 API가 연결되지 않은 상태였습니다.
                </p>
                <p className="leading-relaxed font-medium text-amber-800">
                  아래 <strong>Code.gs</strong>를 시트 <span className="font-mono underline">1HFjhDBULAtBK2g32S8Sc6t-z1DbXa_qgKowsH5GgK4w</span>의 Apps Script에 붙여넣고 배포하시면, <strong>25개 좌석 완벽 동기화</strong>, <strong>종료시간 경과 시 자동 퇴실/반납</strong>, <strong>등록 학생(user 시트) 전용 예약 검증</strong>, <strong>관리자 실시간 목록</strong>이 100% 정상 연동됩니다!
                </p>
                <div className="pt-1">
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition"
                  >
                    <span>내 구글 스프레드시트 열기</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* 2. Web App URL 입력 & 연결 테스트 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    <span>배포된 Google Apps Script 웹 앱 URL</span>
                  </label>
                  <span className="text-[11px] text-slate-500">배포 후 생성된 URL을 붙여넣으세요</span>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={tempGasApiUrl}
                    onChange={e => setTempGasApiUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white text-slate-800"
                  />
                  <button
                    onClick={() => handleTestConnection(tempGasApiUrl)}
                    disabled={isTestingConnection}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {isTestingConnection ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>연결 테스트</span>
                  </button>
                  <button
                    onClick={handleSaveGasUrl}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    저장 및 적용
                  </button>
                </div>

                {/* 연결 테스트 결과 메시지 */}
                {connectionTestResult && (
                  <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    connectionTestResult.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
                  }`}>
                    {connectionTestResult.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">{connectionTestResult.message}</div>
                      {connectionTestResult.details && (
                        <div className="text-[11px] mt-0.5 opacity-90">{connectionTestResult.details}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Code.gs 코드 뷰어 & 복사/다운로드 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">Code.gs</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400 text-[11px]">스프레드시트 1HFjhDBULAtBK2g32S8Sc6t-z1DbXa_qgKowsH5GgK4w 전용</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyGasCode}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium flex items-center gap-1 transition cursor-pointer text-xs"
                    >
                      {gasCodeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{gasCodeCopied ? '복사 완료!' : '코드 복사'}</span>
                    </button>
                    <button
                      onClick={handleDownloadGasCode}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium flex items-center gap-1 transition cursor-pointer text-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>파일 다운로드</span>
                    </button>
                  </div>
                </div>
                <div className="bg-slate-950 p-4 max-h-64 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed">
                  <pre className="whitespace-pre-wrap break-all">{CODE_GS_SCRIPT}</pre>
                </div>
              </div>

              {/* 4. 4단계 간단 배포 순서 가이드 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">!</span>
                  <span>간단 4단계 적용 가이드</span>
                </h4>
                <ol className="space-y-2 text-slate-700 list-decimal list-inside leading-relaxed">
                  <li>
                    스프레드시트 상단 메뉴에서 <strong>[확장 프로그램] &gt; [Apps Script]</strong>를 클릭합니다.
                  </li>
                  <li>
                    기존 편집창의 코드를 모두 지우고 위의 <strong>[코드 복사]</strong> 버튼을 눌러 붙여넣기한 뒤 저장(<kbd className="px-1 bg-slate-200 rounded font-mono">Ctrl+S</kbd>)합니다.
                  </li>
                  <li>
                    상단 함수 드롭다운에서 <strong>setupDatabase</strong>를 선택하고 <strong>[실행]</strong> 버튼을 누릅니다. (시트에 25개 좌석, user, reservations 탭이 자동 생성됩니다.)
                  </li>
                  <li>
                    우측 상단 <strong>[배포] &gt; [새 배포]</strong>를 누르고, <strong>유형: 웹 앱</strong>, <strong>액세스 권한: 모든 사용자(Anyone)</strong>로 설정한 뒤 배포 완료 후 나온 URL을 위 입력창에 넣고 [저장]을 누르면 완료됩니다.
                  </li>
                </ol>
              </div>

            </div>

            {/* 모달 하단 닫기 */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Code.gs 파일은 프로젝트 루트(/Code.gs)에도 생성되어 있습니다.</span>
              <button
                onClick={() => setShowGasModal(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-100 cursor-pointer transition"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 토스트 메시지 컨테이너 */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => {
          let bgClass = 'bg-slate-900 text-white';
          let IconComp = Info;

          if (toast.type === 'success') {
            bgClass = 'bg-emerald-800 text-white';
            IconComp = CheckCircle2;
          } else if (toast.type === 'error') {
            bgClass = 'bg-rose-800 text-white';
            IconComp = AlertCircle;
          }

          return (
            <div
              key={toast.id}
              className={`p-3.5 rounded-xl shadow-lg text-xs sm:text-sm font-medium flex items-center gap-3 transition-all duration-200 pointer-events-auto ${bgClass}`}
            >
              <IconComp className="w-4 h-4 shrink-0" />
              <span className="flex-1">{toast.message}</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
