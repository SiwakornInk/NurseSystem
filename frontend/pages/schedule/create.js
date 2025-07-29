import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../../lib/auth';
import Layout from '../../components/Layout';
import { db, SHIFT_TYPES } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function CreateSchedule() {
  const { userData } = useAuth();
  const [nurses, setNurses] = useState([]);
  const [softRequests, setSoftRequests] = useState({});
  const [hardRequests, setHardRequests] = useState([]);
  const [carryOverFlags, setCarryOverFlags] = useState({});
  const [previousSchedule, setPreviousSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [scheduleResult, setScheduleResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    requiredNursesMorning: 2,
    requiredNursesAfternoon: 3,
    requiredNursesNight: 2,
    targetOffDays: 8,
    maxConsecutiveShiftsWorked: 6,
    solverTimeLimit: 60.0
  });

  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    if (userData?.ward) {
      loadInitialData();
    }
  }, [userData, formData.year, formData.month]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadNurses(),
        loadSoftRequests(),
        loadHardRequests(),
        loadPreviousSchedule()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNurses = async () => {
    const nursesRef = collection(db, 'users');
    const q = query(nursesRef, where('ward', '==', userData.ward));
    const querySnapshot = await getDocs(q);
    
    const nursesData = [];
    querySnapshot.forEach((doc) => {
      nursesData.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    setNurses(nursesData);
  };

  const loadSoftRequests = async () => {
    const requestsRef = collection(db, 'softRequests');
    const q = query(
      requestsRef,
      where('ward', '==', userData.ward),
      where('year', '==', formData.year),
      where('month', '==', formData.month)
    );
    
    const querySnapshot = await getDocs(q);
    const requestsMap = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      requestsMap[data.nurseId] = data.requests || [];
    });
    
    setSoftRequests(requestsMap);
  };

  const loadHardRequests = async () => {
    const startDate = `${formData.year}-${String(formData.month).padStart(2, '0')}-01`;
    const endDate = `${formData.year}-${String(formData.month).padStart(2, '0')}-31`;
    
    const requestsRef = collection(db, 'approvedHardRequests');
    const q = query(
      requestsRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const querySnapshot = await getDocs(q);
    const requestsList = [];
    
    querySnapshot.forEach((doc) => {
      requestsList.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    setHardRequests(requestsList);
  };

  const loadPreviousSchedule = async () => {
    const prevMonth = formData.month === 1 ? 12 : formData.month - 1;
    const prevYear = formData.month === 1 ? formData.year - 1 : formData.year;
    
    const schedulesRef = collection(db, 'schedules');
    const q = query(
      schedulesRef,
      where('ward', '==', userData.ward),
      where('year', '==', prevYear),
      where('month', '==', prevMonth)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const prevScheduleData = querySnapshot.docs[0].data();
      setPreviousSchedule(prevScheduleData);
      
      if (prevScheduleData.nextCarryOverFlags) {
        setCarryOverFlags(prevScheduleData.nextCarryOverFlags);
      }
    } else {
      setPreviousSchedule(null);
      setCarryOverFlags({});
    }
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const getMonthDays = () => {
    const daysInMonth = getDaysInMonth(formData.year, formData.month);
    const days = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(formData.year, formData.month - 1, day);
      days.push({
        day,
        date: date.toISOString().split('T')[0],
        weekday: date.getDay(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        weekdayName: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][date.getDay()]
      });
    }
    
    return days;
  };

  const toggleHoliday = (day) => {
    if (holidays.includes(day)) {
      setHolidays(holidays.filter(d => d !== day));
    } else {
      setHolidays([...holidays, day]);
    }
  };

  const handleGenerateSchedule = async () => {
    if (nurses.length === 0) {
      alert('ไม่พบพยาบาลในวอร์ดนี้');
      return;
    }

    const maxRequired = Math.max(
      formData.requiredNursesMorning,
      formData.requiredNursesAfternoon,
      formData.requiredNursesNight
    );

    if (nurses.length < maxRequired) {
      alert(`จำนวนพยาบาลไม่เพียงพอ ต้องการอย่างน้อย ${maxRequired} คน แต่มีเพียง ${nurses.length} คน`);
      return;
    }

    setGenerating(true);
    try {
      const days = getMonthDays();
      const startDate = days[0].date;
      const endDate = days[days.length - 1].date;

      const requestBody = {
        nurses: nurses.map(n => ({
          id: n.id,
          isGovernmentOfficial: n.isGovernmentOfficial || false,
          constraints: n.constraints || []
        })),
        schedule: {
          startDate,
          endDate
        },
        requiredNursesMorning: formData.requiredNursesMorning,
        requiredNursesAfternoon: formData.requiredNursesAfternoon,
        requiredNursesNight: formData.requiredNursesNight,
        maxConsecutiveShiftsWorked: formData.maxConsecutiveShiftsWorked,
        targetOffDays: formData.targetOffDays,
        solverTimeLimit: formData.solverTimeLimit,
        monthly_soft_requests: softRequests,
        carry_over_flags: carryOverFlags,
        holidays: holidays,
        previousMonthSchedule: previousSchedule
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate-schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate schedule');
      }

      setScheduleResult(data);
      setShowResult(true);
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleResult) return;

    setSaving(true);
    try {
      const scheduleId = `${userData.ward}_${formData.year}_${formData.month}`;
      
      await setDoc(doc(db, 'schedules', scheduleId), {
        ward: userData.ward,
        year: formData.year,
        month: formData.month,
        startDate: scheduleResult.startDate,
        endDate: scheduleResult.endDate,
        nurseSchedules: scheduleResult.nurseSchedules,
        shiftsCount: scheduleResult.shiftsCount,
        days: scheduleResult.days,
        fairnessReport: scheduleResult.fairnessReport,
        nextCarryOverFlags: scheduleResult.nextCarryOverFlags,
        createdBy: userData.id,
        createdAt: new Date(),
        parameters: {
          requiredNursesMorning: formData.requiredNursesMorning,
          requiredNursesAfternoon: formData.requiredNursesAfternoon,
          requiredNursesNight: formData.requiredNursesNight,
          targetOffDays: formData.targetOffDays,
          maxConsecutiveShiftsWorked: formData.maxConsecutiveShiftsWorked
        }
      });

      alert('บันทึกตารางเวรสำเร็จ');
      setShowResult(false);
      setScheduleResult(null);
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    alert('ฟีเจอร์ Export Excel จะเพิ่มในเวอร์ชันถัดไป');
  };

  const renderSchedulePreview = () => {
    if (!scheduleResult) return null;

    const { nurseSchedules, shiftsCount, fairnessReport } = scheduleResult;
    const days = getMonthDays();

    return (
      <div className="schedule-preview">
        <div className="preview-header">
          <h2>ตารางเวรที่สร้างเสร็จแล้ว</h2>
          <div className="preview-actions">
            <button className="btn btn-secondary" onClick={handleExportExcel}>
              Export Excel
            </button>
            <button className="btn btn-primary" onClick={handleSaveSchedule} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกตารางเวร'}
            </button>
          </div>
        </div>

        <div className="fairness-report">
          <h3>รายงานความเป็นธรรม</h3>
          <div className="fairness-grid">
            <div className="fairness-item">
              <span>วันหยุด</span>
              <span>{fairnessReport.offDaysMin} - {fairnessReport.offDaysMax} วัน</span>
            </div>
            <div className="fairness-item">
              <span>เวรทั้งหมด</span>
              <span>{fairnessReport.totalShiftsMin} - {fairnessReport.totalShiftsMax} เวร</span>
            </div>
            <div className="fairness-item">
              <span>เวรเช้า</span>
              <span>{fairnessReport.morningMin} - {fairnessReport.morningMax} เวร</span>
            </div>
            <div className="fairness-item">
              <span>เวรบ่าย</span>
              <span>{fairnessReport.afternoonMin} - {fairnessReport.afternoonMax} เวร</span>
            </div>
            <div className="fairness-item">
              <span>เวรดึก</span>
              <span>{fairnessReport.nightMin} - {fairnessReport.nightMax} เวร</span>
            </div>
            <div className="fairness-item">
              <span>เวรดึก+บ่าย</span>
              <span>{fairnessReport.totalNADoubles} เวร</span>
            </div>
          </div>
        </div>

        <div className="schedule-table-container">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>พยาบาล</th>
                {days.map(day => (
                  <th key={day.day} className={day.isWeekend ? 'weekend' : ''}>
                    {day.day}
                  </th>
                ))}
                <th>รวม</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(nurseSchedules).map(([nurseId, schedule]) => {
                const nurse = nurses.find(n => n.id === nurseId);
                const stats = shiftsCount[nurseId];
                
                return (
                  <tr key={nurseId}>
                    <td className="nurse-name">
                      {nurse?.firstName} {nurse?.lastName}
                    </td>
                    {days.map(day => {
                      const shifts = schedule.shifts[day.date] || [];
                      
                      return (
                        <td key={day.day} className={day.isWeekend ? 'weekend' : ''}>
                          {shifts.length > 0 ? (
                            shifts.map(shiftId => {
                              const shift = Object.values(SHIFT_TYPES).find(s => s.id === shiftId);
                              return shift?.code || '';
                            }).join('+')
                          ) : (
                            <span className="off">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="total">{stats?.total || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <ProtectedRoute adminOnly>
      <Layout>
        <Head>
          <title>สร้างตารางเวร - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="create-schedule-container">
          <div className="page-header">
            <h1>สร้างตารางเวร</h1>
            <p className="subtitle">วอร์ด{userData?.ward}</p>
          </div>

          {!showResult ? (
            <>
              <div className="form-section card">
                <h2>ตั้งค่าการสร้างตารางเวร</h2>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">ปี</label>
                    <select
                      className="form-select"
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                    >
                      {[0, 1, 2].map(offset => {
                        const year = new Date().getFullYear() + offset;
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">เดือน</label>
                    <select
                      className="form-select"
                      value={formData.month}
                      onChange={(e) => setFormData({...formData, month: parseInt(e.target.value)})}
                    >
                      {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].map((month, idx) => (
                        <option key={idx} value={idx + 1}>{month}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <h3>จำนวนพยาบาลที่ต้องการในแต่ละเวร</h3>
                <div className="form-grid three-columns">
                  <div className="form-group">
                    <label className="form-label">เวรเช้า</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      value={formData.requiredNursesMorning}
                      onChange={(e) => setFormData({...formData, requiredNursesMorning: parseInt(e.target.value)})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">เวรบ่าย</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      value={formData.requiredNursesAfternoon}
                      onChange={(e) => setFormData({...formData, requiredNursesAfternoon: parseInt(e.target.value)})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">เวรดึก</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      value={formData.requiredNursesNight}
                      onChange={(e) => setFormData({...formData, requiredNursesNight: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <h3>ข้อกำหนดอื่นๆ</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">เป้าหมายวันหยุดต่อเดือน</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={formData.targetOffDays}
                      onChange={(e) => setFormData({...formData, targetOffDays: parseInt(e.target.value)})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">เวรติดต่อกันสูงสุด</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      value={formData.maxConsecutiveShiftsWorked}
                      onChange={(e) => setFormData({...formData, maxConsecutiveShiftsWorked: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <h3>วันหยุดราชการ</h3>
                <div className="holidays-section">
                  <p className="hint">เลือกวันที่เป็นวันหยุดราชการในเดือนนี้ (นอกเหนือจากเสาร์-อาทิตย์)</p>
                  <div className="calendar-grid">
                    {getMonthDays().map(day => (
                      <div 
                        key={day.day} 
                        className={`calendar-day ${day.isWeekend ? 'weekend' : ''} ${holidays.includes(day.day) ? 'selected' : ''}`}
                        onClick={() => toggleHoliday(day.day)}
                      >
                        <div className="day-header">
                          <span className="weekday-name">{day.weekdayName}</span>
                        </div>
                        <div className="day-number">{day.day}</div>
                        {holidays.includes(day.day) && (
                          <div className="holiday-badge">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="selected-holidays">
                    {holidays.length > 0 && (
                      <>
                        <p className="selected-label">วันหยุดที่เลือก: {holidays.length} วัน</p>
                        <div className="holiday-tags">
                          {holidays.sort((a, b) => a - b).map(day => {
                            const dayInfo = getMonthDays().find(d => d.day === day);
                            return (
                              <span key={day} className="holiday-tag">
                                {dayInfo.weekdayName} ที่ {day}
                                <button 
                                  className="remove-tag"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleHoliday(day);
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="summary-section card">
                <h2>สรุปข้อมูลก่อนสร้างตารางเวร</h2>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="label">จำนวนพยาบาล</span>
                    <span className="value">{nurses.length} คน</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">ข้าราชการ</span>
                    <span className="value">{nurses.filter(n => n.isGovernmentOfficial).length} คน</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">พนักงานทั่วไป</span>
                    <span className="value">{nurses.filter(n => !n.isGovernmentOfficial).length} คน</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">คำขอรายเดือน</span>
                    <span className="value">{Object.keys(softRequests).length} คน</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">ขอหยุดล่วงหน้า</span>
                    <span className="value">{hardRequests.length} รายการ</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">สิทธิพิเศษ</span>
                    <span className="value">{Object.values(carryOverFlags).filter(v => v).length} คน</span>
                  </div>
                </div>

                <div className="action-buttons">
                  <button 
                    className="btn btn-primary large"
                    onClick={handleGenerateSchedule}
                    disabled={generating || loading}
                  >
                    {generating ? 'กำลังสร้างตารางเวร...' : 'สร้างตารางเวร'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            renderSchedulePreview()
          )}
        </div>

        <style jsx>{`
          .create-schedule-container {
            max-width: 1400px;
            margin: 0 auto;
          }
                
          .page-header {
            margin-bottom: 30px;
          }
                
          .page-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 8px;
          }
                
          .subtitle {
            font-size: 16px;
            color: #718096;
          }
                
          .form-section {
            margin-bottom: 24px;
          }
                
          .form-section h2 {
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 24px;
          }
                
          .form-section h3 {
            font-size: 16px;
            font-weight: 600;
            color: #4a5568;
            margin-top: 32px;
            margin-bottom: 16px;
          }
                
          .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
          }
                
          .form-grid.three-columns {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }
                
          .holidays-section {
            margin-top: 16px;
          }
                
          .hint {
            font-size: 14px;
            color: #718096;
            margin-bottom: 20px;
          }
                
          .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 6px;
            margin-bottom: 24px;
          }
                
          .calendar-day {
            aspect-ratio: 1;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            background: white;
            min-height: 60px;
          }
                
          .calendar-day:hover {
            border-color: #cbd5e0;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          }
                
          .calendar-day.weekend {
            background: #fef2f2;
            border-color: #fecaca;
          }
                
          .calendar-day.selected {
            background: #dbeafe;
            border-color: #3b82f6;
          }
                
          .calendar-day.weekend.selected {
            background: #ddd6fe;
            border-color: #8b5cf6;
          }
                
          .day-header {
            position: absolute;
            top: 4px;
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
          }
                
          .calendar-day.weekend .day-header {
            color: #dc2626;
          }
                
          .calendar-day.selected .day-header {
            color: #2563eb;
          }
                
          .day-number {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
          }
                
          .calendar-day.selected .day-number {
            color: #1d4ed8;
          }
                
          .holiday-badge {
            position: absolute;
            bottom: 4px;
            color: #10b981;
          }
                
          .selected-holidays {
            background: #f3f4f6;
            border-radius: 12px;
            padding: 16px;
          }
                
          .selected-label {
            font-size: 14px;
            font-weight: 600;
            color: #4b5563;
            margin-bottom: 12px;
          }
                
          .holiday-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
                
          .holiday-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: white;
            border: 1px solid #e5e7eb;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            color: #374151;
          }
                
          .remove-tag {
            background: none;
            border: none;
            color: #6b7280;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s ease;
          }
                
          .remove-tag:hover {
            background: #f3f4f6;
            color: #dc2626;
          }
                
          .summary-section {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
          }
                
          .summary-section h2 {
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 24px;
          }
                
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
          }
                
          .summary-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            gap: 12px;
          }
                
          .summary-item .label {
            font-size: 14px;
            color: #718096;
            flex: 1;
            min-width: 0;
          }
                
          .summary-item .value {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            white-space: nowrap;
          }
                
          .action-buttons {
            display: flex;
            justify-content: center;
          }
                
          .btn.large {
            padding: 16px 40px;
            font-size: 16px;
          }
                
          .schedule-preview {
            animation: fadeIn 0.5s ease-out;
          }
                
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
                
          .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }
                
          .preview-header h2 {
            font-size: 24px;
            font-weight: 600;
            color: #2d3748;
          }
                
          .preview-actions {
            display: flex;
            gap: 12px;
          }
                
          .fairness-report {
            background: #f7fafc;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          }
                
          .fairness-report h3 {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 16px;
          }
                
          .fairness-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
          }
                
          .fairness-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: white;
            border-radius: 8px;
            font-size: 14px;
          }
                
          .fairness-item span:first-child {
            color: #718096;
          }
                
          .fairness-item span:last-child {
            font-weight: 600;
            color: #2d3748;
          }
                
          .schedule-table-container {
            overflow-x: auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }
                
          .schedule-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
                
          .schedule-table th {
            background: #f7fafc;
            padding: 12px 8px;
            text-align: center;
            font-weight: 600;
            color: #4a5568;
            border-bottom: 2px solid #e2e8f0;
            position: sticky;
            top: 0;
            z-index: 10;
          }
                
          .schedule-table th.weekend {
            background: #fed7d7;
            color: #c53030;
          }
                
          .schedule-table td {
            padding: 8px;
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
          }
                
          .schedule-table td.nurse-name {
            text-align: left;
            font-weight: 500;
            position: sticky;
            left: 0;
            background: white;
            z-index: 5;
          }
                
          .schedule-table td.weekend {
            background: #fff5f5;
          }
                
          .schedule-table td.total {
            font-weight: 600;
            background: #f7fafc;
          }
                
          .schedule-table .off {
            color: #cbd5e0;
          }
                
          @media (max-width: 768px) {
            .preview-header {
              flex-direction: column;
              gap: 16px;
              align-items: stretch;
            }
                
            .preview-actions {
              flex-direction: column;
            }
                
            .calendar-grid {
              grid-template-columns: repeat(4, 1fr);
            }
                
            .calendar-day {
              min-height: 50px;
            }
                
            .day-number {
              font-size: 16px;
            }
                
            .schedule-table {
              font-size: 11px;
            }
                
            .schedule-table th,
            .schedule-table td {
              padding: 4px;
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}