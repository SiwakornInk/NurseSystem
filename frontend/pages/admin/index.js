import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../../lib/auth';
import Layout from '../../components/Layout';
import { db, WARDS } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import Head from 'next/head';

export default function AdminDashboard() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedWardFilter, setSelectedWardFilter] = useState('all');
  const [stats, setStats] = useState({
    totalNurses: 0,
    nursesByWard: {},
    pendingRequests: {
      hard: 0,
      swap: 0
    },
    monthlySchedules: {},
    recentActivities: []
  });

  useEffect(() => {
    if (userData) {
      loadDashboardData();
    }
  }, [userData, selectedWardFilter]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadNursesStats(),
        loadPendingRequests(),
        loadScheduleStats(),
        loadRecentActivities()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNursesStats = async () => {
    const nursesRef = collection(db, 'users');
    const querySnapshot = await getDocs(nursesRef);
    
    let total = 0;
    const byWard = {};
    const byType = {
      government: 0,
      regular: 0,
      admin: 0
    };

    WARDS.forEach(ward => {
      byWard[ward.name] = 0;
    });

    querySnapshot.forEach((doc) => {
      const nurse = doc.data();
      total++;
      
      if (nurse.ward && byWard[nurse.ward] !== undefined) {
        byWard[nurse.ward]++;
      }

      if (nurse.isGovernmentOfficial) {
        byType.government++;
      } else {
        byType.regular++;
      }

      if (nurse.isAdmin) {
        byType.admin++;
      }
    });

    setStats(prev => ({
      ...prev,
      totalNurses: total,
      nursesByWard: byWard,
      nursesByType: byType
    }));
  };

  const loadPendingRequests = async () => {
    // Hard requests และ swap requests เฉพาะวอร์ดตัวเอง
    const hardRequestsQuery = query(
      collection(db, 'hardRequests'),
      where('status', '==', 'pending'),
      where('ward', '==', userData.ward)
    );
    
    const swapRequestsQuery = query(
      collection(db, 'swapRequests'),
      where('status', '==', 'accepted'),
      where('ward', '==', userData.ward)
    );

    const [hardRequests, swapRequests] = await Promise.all([
      getDocs(hardRequestsQuery),
      getDocs(swapRequestsQuery)
    ]);

    setStats(prev => ({
      ...prev,
      pendingRequests: {
        hard: hardRequests.size,
        swap: swapRequests.size
      }
    }));
  };

  const loadScheduleStats = async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const schedulesRef = collection(db, 'schedules');
    const q = query(
      schedulesRef,
      where('year', '==', currentYear),
      where('month', '>=', currentMonth - 1),
      orderBy('month', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const schedulesByMonth = {};

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const monthKey = `${data.month}/${data.year}`;
      
      if (!schedulesByMonth[monthKey]) {
        schedulesByMonth[monthKey] = {
          wards: [],
          totalNurses: 0
        };
      }

      schedulesByMonth[monthKey].wards.push(data.ward);
      schedulesByMonth[monthKey].totalNurses += Object.keys(data.nurseSchedules || {}).length;
    });

    setStats(prev => ({
      ...prev,
      monthlySchedules: schedulesByMonth
    }));
  };

  const loadRecentActivities = async () => {
    const activities = [];

    // Query สำหรับกิจกรรมล่าสุด
    let schedulesQuery = query(
      collection(db, 'schedules'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    if (selectedWardFilter !== 'all') {
      schedulesQuery = query(
        collection(db, 'schedules'),
        where('ward', '==', selectedWardFilter),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
    }

    const recentSchedules = await getDocs(schedulesQuery);

    recentSchedules.forEach((doc) => {
      const data = doc.data();
      activities.push({
        type: 'schedule_created',
        ward: data.ward,
        month: data.month,
        year: data.year,
        createdAt: data.createdAt,
        createdBy: data.createdBy
      });
    });

    // Hard requests query
    let hardRequestsQuery = query(
      collection(db, 'hardRequests'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    if (selectedWardFilter !== 'all') {
      hardRequestsQuery = query(
        collection(db, 'hardRequests'),
        where('ward', '==', selectedWardFilter),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
    }

    const recentHardRequests = await getDocs(hardRequestsQuery);

    recentHardRequests.forEach((doc) => {
      const data = doc.data();
      activities.push({
        type: 'hard_request',
        nurseId: data.nurseId,
        date: data.date,
        status: data.status,
        createdAt: data.createdAt,
        ward: data.ward
      });
    });

    activities.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
    
    setStats(prev => ({
      ...prev,
      recentActivities: activities.slice(0, 10)
    }));
  };

  const getMonthName = (month) => {
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                   'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return months[month - 1];
  };

  const formatActivityDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ProtectedRoute adminOnly>
      <Layout>
        <Head>
          <title>Admin Dashboard - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="admin-dashboard">
          <div className="page-header">
            <h1>Admin Dashboard</h1>
            <p className="subtitle">ภาพรวมระบบจัดเวรพยาบาล</p>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              <div className="stats-overview">
                <div className="stat-card primary">
                  <div className="stat-icon">👥</div>
                  <div className="stat-content">
                    <h3>จำนวนพยาบาลทั้งหมด</h3>
                    <p className="stat-number">{stats.totalNurses}</p>
                    <p className="stat-label">ทุกวอร์ด</p>
                  </div>
                </div>

                <div className="stat-card warning">
                  <div className="stat-icon">📝</div>
                  <div className="stat-content">
                    <h3>ขอหยุดล่วงหน้า รออนุมัติ</h3>
                    <p className="stat-number">{stats.pendingRequests.hard}</p>
                    <p className="stat-label">วอร์ด{userData.ward}</p>
                  </div>
                </div>

                <div className="stat-card info">
                  <div className="stat-icon">🔄</div>
                  <div className="stat-content">
                    <h3>แลกเวร รออนุมัติ</h3>
                    <p className="stat-number">{stats.pendingRequests.swap}</p>
                    <p className="stat-label">วอร์ด{userData.ward}</p>
                  </div>
                </div>

                <div className="stat-card success">
                  <div className="stat-icon">📅</div>
                  <div className="stat-content">
                    <h3>ตารางเวรที่สร้างแล้ว</h3>
                    <p className="stat-number">{Object.keys(stats.monthlySchedules).length}</p>
                    <p className="stat-label">ทุกวอร์ด</p>
                  </div>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-section card">
                  <h2>จำนวนพยาบาลแต่ละวอร์ด</h2>
                  <div className="ward-stats">
                    {Object.entries(stats.nursesByWard).map(([ward, count]) => (
                      <div key={ward} className="ward-stat">
                        <div className="ward-info">
                          <h4>{ward}</h4>
                          <p>{count} คน</p>
                        </div>
                        <div className="ward-bar">
                          <div 
                            className="ward-progress"
                            style={{ width: `${(count / stats.totalNurses) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dashboard-section card">
                  <h2>ประเภทบุคลากร</h2>
                  <div className="type-stats">
                    <div className="type-stat">
                      <div className="type-icon gov">ข</div>
                      <div className="type-info">
                        <h4>ข้าราชการ</h4>
                        <p>{stats.nursesByType?.government || 0} คน</p>
                      </div>
                    </div>
                    <div className="type-stat">
                      <div className="type-icon regular">พ</div>
                      <div className="type-info">
                        <h4>พนักงานทั่วไป</h4>
                        <p>{stats.nursesByType?.regular || 0} คน</p>
                      </div>
                    </div>
                    <div className="type-stat">
                      <div className="type-icon admin">A</div>
                      <div className="type-info">
                        <h4>Admin</h4>
                        <p>{stats.nursesByType?.admin || 0} คน</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="dashboard-section card full-width">
                  <h2>ตารางเวรที่สร้างล่าสุด</h2>
                  <div className="schedules-grid">
                    {Object.entries(stats.monthlySchedules).map(([monthKey, data]) => {
                      const [month, year] = monthKey.split('/');
                      return (
                        <div key={monthKey} className="schedule-summary">
                          <h3>{getMonthName(parseInt(month))} {year}</h3>
                          <div className="schedule-details">
                            <p>วอร์ดที่สร้างแล้ว: {data.wards.length}</p>
                            <p>จำนวนพยาบาล: {data.totalNurses} คน</p>
                            <div className="wards-list">
                              {data.wards.map((ward, idx) => (
                                <span key={idx} className="ward-badge">{ward}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="dashboard-section card full-width">
                  <div className="section-header">
                    <h2>กิจกรรมล่าสุด</h2>
                    <select
                      className="ward-filter"
                      value={selectedWardFilter}
                      onChange={(e) => setSelectedWardFilter(e.target.value)}
                    >
                      <option value="all">ทุกวอร์ด</option>
                      {WARDS.map(ward => (
                        <option key={ward.id} value={ward.name}>{ward.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="activities-list">
                    {stats.recentActivities.map((activity, idx) => (
                      <div key={idx} className="activity-item">
                        <div className="activity-icon">
                          {activity.type === 'schedule_created' ? '📅' : '📝'}
                        </div>
                        <div className="activity-content">
                          {activity.type === 'schedule_created' ? (
                            <p>
                              สร้างตารางเวร{activity.ward} เดือน{getMonthName(activity.month)} {activity.year}
                            </p>
                          ) : (
                            <p>
                              Hard Request วอร์ด{activity.ward} วันที่ {new Date(activity.date).toLocaleDateString('th-TH')} 
                              <span className={`status ${activity.status}`}> ({activity.status})</span>
                            </p>
                          )}
                          <span className="activity-time">
                            {formatActivityDate(activity.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <style jsx>{`
          .admin-dashboard {
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

          .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
          }

          .stats-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .stat-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            display: flex;
            align-items: center;
            gap: 20px;
            transition: all 0.3s ease;
          }

          .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          }

          .stat-card.primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .stat-card.warning {
            background: linear-gradient(135deg, #f6d55c 0%, #ed8936 100%);
            color: white;
          }

          .stat-card.info {
            background: linear-gradient(135deg, #63b3ed 0%, #4299e1 100%);
            color: white;
          }

          .stat-card.success {
            background: linear-gradient(135deg, #68d391 0%, #48bb78 100%);
            color: white;
          }

          .stat-icon {
            font-size: 36px;
            opacity: 0.9;
          }

          .stat-content h3 {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
            opacity: 0.9;
          }

          .stat-number {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .stat-label {
            font-size: 12px;
            opacity: 0.8;
          }

          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }

          .dashboard-section {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }

          .dashboard-section.full-width {
            grid-column: span 2;
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .section-header h2 {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
          }

          .ward-filter {
            padding: 8px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            background: white;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .ward-filter:focus {
            outline: none;
            border-color: #667eea;
          }

          .dashboard-section h2 {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 20px;
          }

          .ward-stats {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .ward-stat {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .ward-info {
            min-width: 140px;
            display: flex;
            justify-content: space-between;
          }

          .ward-info h4 {
            font-size: 14px;
            font-weight: 500;
            color: #4a5568;
          }

          .ward-info p {
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
          }

          .ward-bar {
            flex: 1;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
          }

          .ward-progress {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            border-radius: 4px;
            transition: width 0.5s ease;
          }

          .type-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }

          .type-stat {
            text-align: center;
          }

          .type-icon {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 700;
            margin: 0 auto 12px;
          }

          .type-icon.gov {
            background: #e6fffa;
            color: #319795;
          }

          .type-icon.regular {
            background: #ebf4ff;
            color: #3182ce;
          }

          .type-icon.admin {
            background: #faf5ff;
            color: #9f7aea;
          }

          .type-info h4 {
            font-size: 14px;
            font-weight: 500;
            color: #4a5568;
            margin-bottom: 4px;
          }

          .type-info p {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
          }

          .schedules-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
          }

          .schedule-summary {
            background: #f7fafc;
            border-radius: 8px;
            padding: 16px;
          }

          .schedule-summary h3 {
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 12px;
          }

          .schedule-details p {
            font-size: 14px;
            color: #4a5568;
            margin-bottom: 8px;
          }

          .wards-list {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 8px;
          }

          .ward-badge {
            padding: 4px 10px;
            background: #ebf4ff;
            color: #3182ce;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }

          .activities-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .activity-item {
            display: flex;
            gap: 16px;
            padding: 12px;
            background: #f7fafc;
            border-radius: 8px;
            transition: all 0.3s ease;
          }

          .activity-item:hover {
            background: #edf2f7;
          }

          .activity-icon {
            font-size: 24px;
          }

          .activity-content {
            flex: 1;
          }

          .activity-content p {
            font-size: 14px;
            color: #2d3748;
            margin-bottom: 4px;
          }

          .activity-content .status {
            font-weight: 600;
          }

          .activity-content .status.pending {
            color: #d69e2e;
          }

          .activity-content .status.approved {
            color: #38a169;
          }

          .activity-content .status.rejected {
            color: #e53e3e;
          }

          .activity-time {
            font-size: 12px;
            color: #a0aec0;
          }

          @media (max-width: 1024px) {
            .stats-overview {
              grid-template-columns: repeat(2, 1fr);
            }

            .dashboard-grid {
              grid-template-columns: 1fr;
            }

            .dashboard-section.full-width {
              grid-column: span 1;
            }
          }

          @media (max-width: 768px) {
            .stats-overview {
              grid-template-columns: 1fr;
            }

            .type-stats {
              grid-template-columns: 1fr;
              gap: 16px;
            }

            .section-header {
              flex-direction: column;
              gap: 12px;
              align-items: stretch;
            }

            .ward-filter {
              width: 100%;
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}