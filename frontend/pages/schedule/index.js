import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../../lib/auth';
import Layout from '../../components/Layout';
import { db, SHIFT_TYPES, WARDS } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import Head from 'next/head';

export default function Schedule() {
  const { userData } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedWard, setSelectedWard] = useState('');
  const [viewMode, setViewMode] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData) {
      setSelectedWard(userData.ward);
    }
  }, [userData]);

  useEffect(() => {
    if (selectedWard) {
      loadSchedules();
    }
  }, [selectedWard]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const schedulesRef = collection(db, 'schedules');
      const q = query(
        schedulesRef,
        where('ward', '==', selectedWard),
        orderBy('year', 'desc'),
        orderBy('month', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const schedulesData = [];
      
      querySnapshot.forEach((doc) => {
        schedulesData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setSchedules(schedulesData);
      if (schedulesData.length > 0) {
        setSelectedSchedule(schedulesData[0]);
      } else {
        setSelectedSchedule(null);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month) => {
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                   'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return months[month - 1];
  };

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    return days[date.getDay()];
  };

  const isWeekend = (dateStr) => {
    const date = new Date(dateStr);
    return date.getDay() === 0 || date.getDay() === 6;
  };

  const renderCalendarView = () => {
    if (!selectedSchedule) return null;

    const { nurseSchedules, days, year, month } = selectedSchedule;
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push(i);
    }

    const mySchedule = nurseSchedules?.[userData.id];
    if (!mySchedule) return <p className="no-data">ไม่พบข้อมูลตารางเวรของคุณในวอร์ดนี้</p>;

    return (
      <div className="calendar-container">
        <div className="calendar-header">
          <div className="weekday-headers">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
              <div key={day} className={`weekday ${day === 'อา' || day === 'ส' ? 'weekend' : ''}`}>
                {day}
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-grid">
          {calendarDays.map((day, index) => {
            if (!day) return <div key={index} className="calendar-cell empty"></div>;
            
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shifts = mySchedule.shifts?.[dateStr] || [];
            const isToday = new Date().toDateString() === new Date(dateStr).toDateString();
            
            return (
              <div key={index} className={`calendar-cell ${isWeekend(dateStr) ? 'weekend' : ''} ${isToday ? 'today' : ''}`}>
                <div className="day-number">{day}</div>
                <div className="day-shifts">
                  {shifts.length > 0 ? (
                    shifts.map((shiftId, idx) => {
                      const shift = Object.values(SHIFT_TYPES).find(s => s.id === shiftId);
                      return shift ? (
                        <div key={idx} className="shift-tag" style={{ backgroundColor: shift.color }}>
                          {shift.code}
                        </div>
                      ) : null;
                    })
                  ) : (
                    <div className="shift-tag off">OFF</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    if (!selectedSchedule) return null;

    const { nurseSchedules, days } = selectedSchedule;
    const mySchedule = nurseSchedules?.[userData.id];
    if (!mySchedule) return <p className="no-data">ไม่พบข้อมูลตารางเวรของคุณในวอร์ดนี้</p>;

    return (
      <div className="list-container">
        {days.map((dateStr) => {
          const shifts = mySchedule.shifts?.[dateStr] || [];
          const date = new Date(dateStr);
          const isToday = new Date().toDateString() === date.toDateString();
          
          return (
            <div key={dateStr} className={`list-item ${isWeekend(dateStr) ? 'weekend' : ''} ${isToday ? 'today' : ''}`}>
              <div className="date-info">
                <span className="date-day">{date.getDate()}</span>
                <span className="date-weekday">{getDayName(dateStr)}</span>
              </div>
              <div className="shifts-info">
                {shifts.length > 0 ? (
                  shifts.map((shiftId, idx) => {
                    const shift = Object.values(SHIFT_TYPES).find(s => s.id === shiftId);
                    return shift ? (
                      <span key={idx} className="shift-badge" style={{ backgroundColor: shift.color }}>
                        {shift.nameTH}
                      </span>
                    ) : null;
                  })
                ) : (
                  <span className="shift-badge off">วันหยุด</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderStatsView = () => {
    if (!selectedSchedule) return null;

    const { shiftsCount, nurseSchedules } = selectedSchedule;
    const myStats = shiftsCount?.[userData.id];
    const allNurses = Object.keys(nurseSchedules || {});

    if (!myStats) return <p className="no-data">ไม่พบข้อมูลสถิติของคุณในวอร์ดนี้</p>;

    const avgStats = {
      morning: 0,
      afternoon: 0,
      night: 0,
      total: 0,
      daysOff: 0
    };

    Object.keys(shiftsCount || {}).forEach(nurseId => {
      const stats = shiftsCount[nurseId];
      avgStats.morning += stats.morning || 0;
      avgStats.afternoon += stats.afternoon || 0;
      avgStats.night += stats.night || 0;
      avgStats.total += stats.total || 0;
      avgStats.daysOff += stats.daysOff || 0;
    });

    const nurseCount = allNurses.length || 1;
    Object.keys(avgStats).forEach(key => {
      avgStats[key] = Math.round(avgStats[key] / nurseCount);
    });

    return (
      <div className="stats-container">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>เวรเช้า</h3>
            <div className="stat-value">{myStats.morning}</div>
            <div className="stat-compare">เฉลี่ย: {avgStats.morning}</div>
          </div>
          <div className="stat-card">
            <h3>เวรบ่าย</h3>
            <div className="stat-value">{myStats.afternoon}</div>
            <div className="stat-compare">เฉลี่ย: {avgStats.afternoon}</div>
          </div>
          <div className="stat-card">
            <h3>เวรดึก</h3>
            <div className="stat-value">{myStats.night}</div>
            <div className="stat-compare">เฉลี่ย: {avgStats.night}</div>
          </div>
          <div className="stat-card">
            <h3>เวรทั้งหมด</h3>
            <div className="stat-value primary">{myStats.total}</div>
            <div className="stat-compare">เฉลี่ย: {avgStats.total}</div>
          </div>
          <div className="stat-card">
            <h3>วันหยุด</h3>
            <div className="stat-value success">{myStats.daysOff}</div>
            <div className="stat-compare">เฉลี่ย: {avgStats.daysOff}</div>
          </div>
          <div className="stat-card">
            <h3>เวรดึก+บ่าย</h3>
            <div className="stat-value warning">{myStats.nightAfternoonDouble || 0}</div>
            <div className="stat-compare">รวมวอร์ด: {Object.values(shiftsCount || {}).reduce((sum, s) => sum + (s.nightAfternoonDouble || 0), 0)}</div>
          </div>
        </div>

        <div className="chart-section">
          <h3>สัดส่วนการเข้าเวร</h3>
          <div className="pie-chart">
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: SHIFT_TYPES.MORNING.color }}></span>
                <span>เช้า: {((myStats.morning / myStats.total) * 100).toFixed(1)}%</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: SHIFT_TYPES.AFTERNOON.color }}></span>
                <span>บ่าย: {((myStats.afternoon / myStats.total) * 100).toFixed(1)}%</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: SHIFT_TYPES.NIGHT.color }}></span>
                <span>ดึก: {((myStats.night / myStats.total) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <Layout>
        <Head>
          <title>ตารางเวร - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="schedule-container">
          <div className="page-header">
            <h1>ตารางเวร</h1>
            <div className="header-controls">
              <select
                className="ward-selector"
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
              >
                {WARDS.map(ward => (
                  <option key={ward.id} value={ward.name}>{ward.name}</option>
                ))}
              </select>

              <select
                className="month-selector"
                value={selectedSchedule?.id || ''}
                onChange={(e) => {
                  const schedule = schedules.find(s => s.id === e.target.value);
                  setSelectedSchedule(schedule);
                }}
                disabled={schedules.length === 0}
              >
                {schedules.length === 0 ? (
                  <option value="">ไม่มีตารางเวร</option>
                ) : (
                  schedules.map(schedule => (
                    <option key={schedule.id} value={schedule.id}>
                      {getMonthName(schedule.month)} {schedule.year}
                    </option>
                  ))
                )}
              </select>

              <div className="view-toggle">
                <button
                  className={viewMode === 'month' ? 'active' : ''}
                  onClick={() => setViewMode('month')}
                >
                  ปฏิทิน
                </button>
                <button
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => setViewMode('list')}
                >
                  รายการ
                </button>
                <button
                  className={viewMode === 'stats' ? 'active' : ''}
                  onClick={() => setViewMode('stats')}
                >
                  สถิติ
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : schedules.length === 0 ? (
            <div className="empty-state">
              <p>ยังไม่มีตารางเวรสำหรับวอร์ด{selectedWard}</p>
            </div>
          ) : (
            <div className="schedule-content">
              {viewMode === 'month' && renderCalendarView()}
              {viewMode === 'list' && renderListView()}
              {viewMode === 'stats' && renderStatsView()}
            </div>
          )}
        </div>

        <style jsx>{`
          .schedule-container {
            max-width: 1400px;
            margin: 0 auto;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 20px;
          }

          .page-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #2d3748;
          }

          .header-controls {
            display: flex;
            gap: 20px;
            align-items: center;
            flex-wrap: wrap;
          }

          .ward-selector,
          .month-selector {
            padding: 10px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            background: white;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .ward-selector:hover,
          .month-selector:hover {
            border-color: #667eea;
          }

          .ward-selector:focus,
          .month-selector:focus {
            outline: none;
            border-color: #667eea;
          }

          .view-toggle {
            display: flex;
            background: #f7fafc;
            border-radius: 8px;
            padding: 4px;
            gap: 4px;
          }

          .view-toggle button {
            padding: 8px 16px;
            border: none;
            background: transparent;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            color: #4a5568;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .view-toggle button:hover {
            color: #667eea;
          }

          .view-toggle button.active {
            background: white;
            color: #667eea;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
          }

          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #718096;
          }

          .calendar-container {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }

          .calendar-header {
            margin-bottom: 20px;
          }

          .weekday-headers {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
            margin-bottom: 8px;
          }

          .weekday {
            text-align: center;
            font-weight: 600;
            font-size: 14px;
            color: #4a5568;
            padding: 10px 0;
          }

          .weekday.weekend {
            color: #e53e3e;
          }

          .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
          }

          .calendar-cell {
            aspect-ratio: 1;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            position: relative;
            transition: all 0.3s ease;
          }

          .calendar-cell:hover {
            border-color: #cbd5e0;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          }

          .calendar-cell.empty {
            background: transparent;
            border: none;
          }

          .calendar-cell.weekend {
            background: #fff5f5;
          }

          .calendar-cell.today {
            border-color: #667eea;
            border-width: 2px;
          }

          .day-number {
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 4px;
          }

          .day-shifts {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            flex: 1;
          }

          .shift-tag {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            color: white;
          }

          .shift-tag.off {
            background: #cbd5e0;
            color: #4a5568;
          }

          .list-container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }

          .list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            border-bottom: 1px solid #e2e8f0;
            transition: all 0.3s ease;
          }

          .list-item:last-child {
            border-bottom: none;
          }

          .list-item:hover {
            background: #f7fafc;
          }

          .list-item.weekend {
            background: #fff5f5;
          }

          .list-item.weekend:hover {
            background: #fed7d7;
          }

          .list-item.today {
            background: #ebf4ff;
          }

          .date-info {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .date-day {
            font-size: 24px;
            font-weight: 700;
            color: #2d3748;
            min-width: 40px;
          }

          .date-weekday {
            font-size: 16px;
            color: #718096;
          }

          .shifts-info {
            display: flex;
            gap: 8px;
          }

          .shift-badge {
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            color: white;
          }

          .shift-badge.off {
            background: #e2e8f0;
            color: #718096;
          }

          .stats-container {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .stat-card {
            background: #f7fafc;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
          }

          .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
          }

          .stat-card h3 {
            font-size: 14px;
            color: #718096;
            margin-bottom: 12px;
            font-weight: 500;
          }

          .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 8px;
          }

          .stat-value.primary {
            color: #667eea;
          }

          .stat-value.success {
            color: #48bb78;
          }

          .stat-value.warning {
            color: #ed8936;
          }

          .stat-compare {
            font-size: 12px;
            color: #a0aec0;
          }

          .chart-section {
            border-top: 1px solid #e2e8f0;
            padding-top: 24px;
          }

          .chart-section h3 {
            font-size: 18px;
            margin-bottom: 20px;
            color: #2d3748;
          }

          .chart-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
          }

          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 4px;
          }

          .no-data {
            text-align: center;
            color: #718096;
            padding: 40px;
          }

          @media (max-width: 768px) {
            .page-header {
              flex-direction: column;
              align-items: stretch;
            }

            .header-controls {
              flex-direction: column;
              width: 100%;
            }

            .ward-selector,
            .month-selector {
              width: 100%;
            }

            .calendar-cell {
              padding: 4px;
            }

            .day-number {
              font-size: 12px;
            }

            .shift-tag {
              font-size: 10px;
              padding: 1px 4px;
            }

            .stats-grid {
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}