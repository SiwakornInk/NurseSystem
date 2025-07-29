import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../lib/auth';
import Layout from '../components/Layout';
import { db, storage, SHIFT_TYPES } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Head from 'next/head';

export default function Dashboard() {
  const { userData, user } = useAuth();
  const [todayShifts, setTodayShifts] = useState([]);
  const [tomorrowShifts, setTomorrowShifts] = useState([]);
  const [weekShifts, setWeekShifts] = useState([]);
  const [monthStats, setMonthStats] = useState({ morning: 0, afternoon: 0, night: 0, total: 0, daysOff: 0 });
  const [threeMonthStats, setThreeMonthStats] = useState({ morning: 0, afternoon: 0, night: 0, total: 0 });
  const [sixMonthStats, setSixMonthStats] = useState({ morning: 0, afternoon: 0, night: 0, total: 0 });
  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (userData) {
      setProfileData({
        prefix: userData.prefix || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        position: userData.position || '',
        phone: userData.phone || '',
        profileImage: userData.profileImage || ''
      });
      loadScheduleData();
    }
  }, [userData]);

  const loadScheduleData = async () => {
    if (!userData?.ward || !userData?.id) return;

    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

      const schedulesRef = collection(db, 'schedules');
      const q = query(
        schedulesRef,
        where('ward', '==', userData.ward),
        where('year', '==', currentYear),
        where('month', '==', currentMonth),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const scheduleData = querySnapshot.docs[0].data();
        const nurseSchedule = scheduleData.nurseSchedules?.[userData.id];
        
        if (nurseSchedule) {
          const todayStr = today.toISOString().split('T')[0];
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          
          const todayShiftIds = nurseSchedule.shifts?.[todayStr] || [];
          setTodayShifts(todayShiftIds.map(id => Object.values(SHIFT_TYPES).find(s => s.id === id)));
          
          const tomorrowShiftIds = nurseSchedule.shifts?.[tomorrowStr] || [];
          setTomorrowShifts(tomorrowShiftIds.map(id => Object.values(SHIFT_TYPES).find(s => s.id === id)));

          const last7Days = [];
          for (let i = 1; i <= 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const shiftIds = nurseSchedule.shifts?.[dateStr] || [];
            if (shiftIds.length > 0) {
              last7Days.push({
                date: dateStr,
                shifts: shiftIds.map(id => Object.values(SHIFT_TYPES).find(s => s.id === id))
              });
            }
          }
          setWeekShifts(last7Days);

          const shiftsCount = scheduleData.shiftsCount?.[userData.id];
          if (shiftsCount) {
            setMonthStats({
              morning: shiftsCount.morning || 0,
              afternoon: shiftsCount.afternoon || 0,
              night: shiftsCount.night || 0,
              total: shiftsCount.total || 0,
              daysOff: shiftsCount.daysOff || 0
            });
          }
        }
      }

      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const statsQuery = query(
        schedulesRef,
        where('ward', '==', userData.ward),
        where('createdAt', '>=', threeMonthsAgo),
        orderBy('createdAt', 'desc')
      );

      const statsSnapshot = await getDocs(statsQuery);
      
      let threeMonthTotals = { morning: 0, afternoon: 0, night: 0, total: 0 };
      let sixMonthTotals = { morning: 0, afternoon: 0, night: 0, total: 0 };
      
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      statsSnapshot.forEach((doc) => {
        const data = doc.data();
        const counts = data.shiftsCount?.[userData.id];
        if (counts) {
          threeMonthTotals.morning += counts.morning || 0;
          threeMonthTotals.afternoon += counts.afternoon || 0;
          threeMonthTotals.night += counts.night || 0;
          threeMonthTotals.total += counts.total || 0;
          
          if (data.createdAt.toDate() >= sixMonthsAgo) {
            sixMonthTotals.morning += counts.morning || 0;
            sixMonthTotals.afternoon += counts.afternoon || 0;
            sixMonthTotals.night += counts.night || 0;
            sixMonthTotals.total += counts.total || 0;
          }
        }
      });

      setThreeMonthStats(threeMonthTotals);
      setSixMonthStats(sixMonthTotals);

    } catch (error) {
      console.error('Error loading schedule data:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: new Date()
      });
      setEditMode(false);
      alert('อัพเดทข้อมูลสำเร็จ');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดทข้อมูล');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `profile-images/${user.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setProfileData({ ...profileData, profileImage: downloadURL });
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        profileImage: downloadURL,
        updatedAt: new Date()
      });
      
      alert('อัพโหลดรูปภาพสำเร็จ');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <ProtectedRoute>
      <Layout>
        <Head>
          <title>Dashboard - ระบบจัดเวรพยาบาล</title>
        </Head>
        
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h1>สวัสดี คุณ{userData?.firstName}</h1>
            <p className="subtitle">วันนี้ {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="dashboard-grid">
            <div className="today-section card">
              <h2>เวรของคุณวันนี้</h2>
              <div className="shifts-display">
                {todayShifts.length > 0 ? (
                  todayShifts.map((shift, idx) => (
                    <div key={idx} className="shift-badge" style={{ backgroundColor: shift.color }}>
                      {shift.nameTH}
                    </div>
                  ))
                ) : (
                  <div className="shift-badge off">วันหยุด</div>
                )}
              </div>
            </div>

            <div className="tomorrow-section card">
              <h2>เวรพรุ่งนี้</h2>
              <div className="shifts-display">
                {tomorrowShifts.length > 0 ? (
                  tomorrowShifts.map((shift, idx) => (
                    <div key={idx} className="shift-badge" style={{ backgroundColor: shift.color }}>
                      {shift.nameTH}
                    </div>
                  ))
                ) : (
                  <div className="shift-badge off">วันหยุด</div>
                )}
              </div>
            </div>

            <div className="week-history card">
              <h2>เวรย้อนหลัง 7 วัน</h2>
              <div className="history-list">
                {weekShifts.length > 0 ? (
                  weekShifts.map((day, idx) => (
                    <div key={idx} className="history-item">
                      <span className="history-date">{formatDate(day.date)}</span>
                      <div className="history-shifts">
                        {day.shifts.map((shift, sIdx) => (
                          <span key={sIdx} className="mini-badge" style={{ backgroundColor: shift.color }}>
                            {shift.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-data">ไม่มีข้อมูล</p>
                )}
              </div>
            </div>

            <div className="stats-section card">
              <h2>สถิติการเข้าเวร</h2>
              <div className="stats-tabs">
                <div className="stat-group">
                  <h3>เดือนนี้</h3>
                  <div className="stat-grid">
                    <div className="stat-item">
                      <span className="stat-label">เช้า</span>
                      <span className="stat-value">{monthStats.morning}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">บ่าย</span>
                      <span className="stat-value">{monthStats.afternoon}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">ดึก</span>
                      <span className="stat-value">{monthStats.night}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">รวม</span>
                      <span className="stat-value primary">{monthStats.total}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">หยุด</span>
                      <span className="stat-value success">{monthStats.daysOff}</span>
                    </div>
                  </div>
                </div>

                <div className="stat-group">
                  <h3>3 เดือนย้อนหลัง</h3>
                  <div className="stat-grid">
                    <div className="stat-item">
                      <span className="stat-label">เช้า</span>
                      <span className="stat-value">{threeMonthStats.morning}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">บ่าย</span>
                      <span className="stat-value">{threeMonthStats.afternoon}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">ดึก</span>
                      <span className="stat-value">{threeMonthStats.night}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">รวม</span>
                      <span className="stat-value primary">{threeMonthStats.total}</span>
                    </div>
                  </div>
                </div>

                <div className="stat-group">
                  <h3>6 เดือนย้อนหลัง</h3>
                  <div className="stat-grid">
                    <div className="stat-item">
                      <span className="stat-label">เช้า</span>
                      <span className="stat-value">{sixMonthStats.morning}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">บ่าย</span>
                      <span className="stat-value">{sixMonthStats.afternoon}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">ดึก</span>
                      <span className="stat-value">{sixMonthStats.night}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">รวม</span>
                      <span className="stat-value primary">{sixMonthStats.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-section card">
              <div className="profile-header">
                <h2>ข้อมูลส่วนตัว</h2>
                {!editMode && (
                  <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                    แก้ไขข้อมูล
                  </button>
                )}
              </div>

              <div className="profile-content">
                <div className="profile-image-section">
                  <div className="profile-image">
                    {profileData.profileImage ? (
                      <img src={profileData.profileImage} alt="Profile" />
                    ) : (
                      <div className="profile-placeholder">
                        {userData?.firstName?.[0]}
                      </div>
                    )}
                  </div>
                  {editMode && (
                    <label className="upload-btn">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                      {uploading ? 'กำลังอัพโหลด...' : 'เปลี่ยนรูปภาพ'}
                    </label>
                  )}
                </div>

                {editMode ? (
                  <form onSubmit={handleProfileUpdate} className="profile-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">คำนำหน้า</label>
                        <input
                          type="text"
                          className="form-input"
                          value={profileData.prefix}
                          onChange={(e) => setProfileData({...profileData, prefix: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">ชื่อ</label>
                        <input
                          type="text"
                          className="form-input"
                          value={profileData.firstName}
                          onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">นามสกุล</label>
                        <input
                          type="text"
                          className="form-input"
                          value={profileData.lastName}
                          onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">ตำแหน่ง</label>
                        <input
                          type="text"
                          className="form-input"
                          value={profileData.position}
                          onChange={(e) => setProfileData({...profileData, position: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">เบอร์โทรศัพท์</label>
                        <input
                          type="tel"
                          className="form-input"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary">
                        บันทึกข้อมูล
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)}>
                        ยกเลิก
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="profile-info">
                    <div className="info-item">
                      <span className="info-label">ชื่อ-นามสกุล</span>
                      <span className="info-value">{userData?.prefix}{userData?.firstName} {userData?.lastName}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">ตำแหน่ง</span>
                      <span className="info-value">{userData?.position}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">วอร์ด</span>
                      <span className="info-value">{userData?.ward}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">อีเมล</span>
                      <span className="info-value">{userData?.email}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">เบอร์โทรศัพท์</span>
                      <span className="info-value">{userData?.phone}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">วันที่เริ่มงาน</span>
                      <span className="info-value">
                        {userData?.startDate ? new Date(userData.startDate).toLocaleDateString('th-TH') : '-'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">ประเภท</span>
                      <span className="info-value">
                        {userData?.isGovernmentOfficial ? 'ข้าราชการ' : 'พนักงานทั่วไป'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          .dashboard-container {
            max-width: 1400px;
            margin: 0 auto;
          }

          .dashboard-header {
            margin-bottom: 40px;
          }

          .dashboard-header h1 {
            font-size: 32px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 8px;
          }

          .subtitle {
            font-size: 16px;
            color: #718096;
          }

          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
          }

          .today-section, .tomorrow-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .today-section h2, .tomorrow-section h2 {
            color: white;
            font-size: 18px;
            margin-bottom: 20px;
          }

          .shifts-display {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }

          .shift-badge {
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            background: rgba(255, 255, 255, 0.9);
            color: #2d3748;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .shift-badge.off {
            background: rgba(255, 255, 255, 0.3);
            color: white;
          }

          .week-history h2 {
            font-size: 18px;
            margin-bottom: 20px;
          }

          .history-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .history-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
          }

          .history-item:last-child {
            border-bottom: none;
          }

          .history-date {
            font-size: 14px;
            color: #4a5568;
          }

          .history-shifts {
            display: flex;
            gap: 8px;
          }

          .mini-badge {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            color: white;
          }

          .stats-section {
            grid-column: span 2;
          }

          .stats-section h2 {
            font-size: 20px;
            margin-bottom: 24px;
          }

          .stats-tabs {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 24px;
          }

          .stat-group h3 {
            font-size: 16px;
            color: #4a5568;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e2e8f0;
          }

          .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 16px;
          }

          .stat-item {
            text-align: center;
          }

          .stat-label {
            display: block;
            font-size: 12px;
            color: #718096;
            margin-bottom: 4px;
          }

          .stat-value {
            display: block;
            font-size: 24px;
            font-weight: 700;
            color: #2d3748;
          }

          .stat-value.primary {
            color: #667eea;
          }

          .stat-value.success {
            color: #48bb78;
          }

          .profile-section {
            grid-column: span 2;
          }

          .profile-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }

          .profile-header h2 {
            font-size: 20px;
          }

          .profile-content {
            display: flex;
            gap: 40px;
          }

          .profile-image-section {
            flex-shrink: 0;
            text-align: center;
          }

          .profile-image {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            overflow: hidden;
            margin-bottom: 16px;
            border: 4px solid #e2e8f0;
          }

          .profile-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .profile-placeholder {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            font-weight: 700;
          }

          .upload-btn {
            display: inline-block;
            padding: 8px 16px;
            background: #667eea;
            color: white;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .upload-btn:hover {
            background: #5a67d8;
          }

          .upload-btn input {
            display: none;
          }

          .profile-form {
            flex: 1;
          }

          .form-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
          }

          .form-group {
            display: flex;
            flex-direction: column;
          }

          .form-actions {
            display: flex;
            gap: 12px;
            margin-top: 24px;
          }

          .profile-info {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
          }

          .info-item {
            display: flex;
            flex-direction: column;
          }

          .info-label {
            font-size: 12px;
            color: #718096;
            margin-bottom: 4px;
          }

          .info-value {
            font-size: 16px;
            font-weight: 500;
            color: #2d3748;
          }

          .no-data {
            color: #718096;
            font-style: italic;
            text-align: center;
            padding: 20px 0;
          }

          @media (max-width: 1024px) {
            .stats-section, .profile-section {
              grid-column: span 1;
            }
            
            .profile-content {
              flex-direction: column;
            }
          }

          @media (max-width: 768px) {
            .dashboard-header h1 {
              font-size: 24px;
            }

            .stats-tabs {
              grid-template-columns: 1fr;
            }

            .form-row {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}