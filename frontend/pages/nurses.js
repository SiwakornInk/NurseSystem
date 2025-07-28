import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../lib/auth';
import Layout from '../components/Layout';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import Head from 'next/head';

export default function Nurses() {
  const { userData } = useAuth();
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (userData?.ward) {
      loadNurses();
    }
  }, [userData]);

  const loadNurses = async () => {
    setLoading(true);
    try {
      const nursesRef = collection(db, 'users');
      const q = query(
        nursesRef,
        where('ward', '==', userData.ward),
        orderBy('firstName')
      );
      
      const querySnapshot = await getDocs(q);
      const nursesData = [];
      
      querySnapshot.forEach((doc) => {
        nursesData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setNurses(nursesData);
    } catch (error) {
      console.error('Error loading nurses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (nurse) => {
    setSelectedNurse(nurse);
    setShowProfileModal(true);
  };

  const filteredNurses = nurses.filter(nurse => {
    const searchLower = searchTerm.toLowerCase();
    return (
      nurse.firstName?.toLowerCase().includes(searchLower) ||
      nurse.lastName?.toLowerCase().includes(searchLower) ||
      nurse.position?.toLowerCase().includes(searchLower) ||
      nurse.email?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getExperienceYears = (startDate) => {
    if (!startDate) return '-';
    const start = new Date(startDate);
    const now = new Date();
    const years = Math.floor((now - start) / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor(((now - start) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    
    if (years === 0) {
      return `${months} เดือน`;
    } else if (months === 0) {
      return `${years} ปี`;
    } else {
      return `${years} ปี ${months} เดือน`;
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <Head>
          <title>รายชื่อพยาบาล - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="nurses-container">
          <div className="page-header">
            <div>
              <h1>รายชื่อพยาบาล</h1>
              <p className="subtitle">วอร์ด{userData?.ward} - ทั้งหมด {nurses.length} คน</p>
            </div>
            <div className="search-box">
              <input
                type="text"
                placeholder="ค้นหาด้วยชื่อ, ตำแหน่ง หรืออีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : filteredNurses.length === 0 ? (
            <div className="empty-state">
              <p>{searchTerm ? 'ไม่พบพยาบาลที่ค้นหา' : 'ไม่มีพยาบาลในวอร์ดนี้'}</p>
            </div>
          ) : (
            <div className="nurses-grid">
              {filteredNurses.map(nurse => (
                <div key={nurse.id} className="nurse-card" onClick={() => handleViewProfile(nurse)}>
                  <div className="nurse-header">
                    <div className="nurse-avatar">
                      {nurse.profileImage ? (
                        <img src={nurse.profileImage} alt={nurse.firstName} />
                      ) : (
                        <span>{nurse.firstName?.[0] || 'N'}</span>
                      )}
                    </div>
                    <div className="nurse-badges">
                      {nurse.isGovernmentOfficial && (
                        <span className="badge gov">ข้าราชการ</span>
                      )}
                      {nurse.isAdmin && (
                        <span className="badge admin">Admin</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="nurse-info">
                    <h3>{nurse.prefix}{nurse.firstName} {nurse.lastName}</h3>
                    <p className="position">{nurse.position || 'ไม่ระบุตำแหน่ง'}</p>
                    
                    <div className="nurse-details">
                      <div className="detail-item">
                        <span className="icon">📧</span>
                        <span className="text">{nurse.email}</span>
                      </div>
                      <div className="detail-item">
                        <span className="icon">📱</span>
                        <span className="text">{nurse.phone || 'ไม่ระบุ'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="icon">📅</span>
                        <span className="text">{getExperienceYears(nurse.startDate)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="view-profile-hint">
                    คลิกเพื่อดูโปรไฟล์
                  </div>
                </div>
              ))}
            </div>
          )}

          {showProfileModal && selectedNurse && (
            <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
              <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={() => setShowProfileModal(false)}>✕</button>
                
                <div className="profile-header">
                  <div className="profile-avatar">
                    {selectedNurse.profileImage ? (
                      <img src={selectedNurse.profileImage} alt={selectedNurse.firstName} />
                    ) : (
                      <span>{selectedNurse.firstName?.[0] || 'N'}</span>
                    )}
                  </div>
                  <div className="profile-title">
                    <h2>{selectedNurse.prefix}{selectedNurse.firstName} {selectedNurse.lastName}</h2>
                    <p>{selectedNurse.position || 'ไม่ระบุตำแหน่ง'}</p>
                    <div className="profile-badges">
                      {selectedNurse.isGovernmentOfficial && (
                        <span className="badge gov">ข้าราชการ</span>
                      )}
                      {selectedNurse.isAdmin && (
                        <span className="badge admin">Admin</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="profile-content">
                  <div className="profile-section">
                    <h3>ข้อมูลติดต่อ</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="label">อีเมล</span>
                        <span className="value">{selectedNurse.email}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">เบอร์โทรศัพท์</span>
                        <span className="value">{selectedNurse.phone || 'ไม่ระบุ'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="profile-section">
                    <h3>ข้อมูลการทำงาน</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="label">วอร์ด</span>
                        <span className="value">{selectedNurse.ward}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">วันที่เริ่มงาน</span>
                        <span className="value">{formatDate(selectedNurse.startDate)}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">อายุงาน</span>
                        <span className="value">{getExperienceYears(selectedNurse.startDate)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedNurse.constraints && selectedNurse.constraints.length > 0 && (
                    <div className="profile-section">
                      <h3>ข้อจำกัดการเข้าเวร</h3>
                      <div className="constraints-list">
                        {selectedNurse.constraints.map((constraint, idx) => (
                          <div key={idx} className="constraint-item">
                            <span className={`constraint-badge ${constraint.strength}`}>
                              {constraint.strength === 'hard' ? 'บังคับ' : 'ขอความร่วมมือ'}
                            </span>
                            <span>{getConstraintLabel(constraint.type, constraint.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
          .nurses-container {
            max-width: 1400px;
            margin: 0 auto;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            gap: 20px;
            flex-wrap: wrap;
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

          .search-box {
            width: 100%;
            max-width: 400px;
          }

          .search-box input {
            width: 100%;
            padding: 12px 20px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s ease;
          }

          .search-box input:focus {
            outline: none;
            border-color: #667eea;
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

          .nurses-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 24px;
          }

          .nurse-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            transition: all 0.3s ease;
            cursor: pointer;
            position: relative;
            overflow: hidden;
          }

          .nurse-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
          }

          .nurse-card:hover .view-profile-hint {
            opacity: 1;
            transform: translateY(0);
          }

          .nurse-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
          }

          .nurse-avatar {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 600;
            overflow: hidden;
          }

          .nurse-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .nurse-badges {
            display: flex;
            gap: 8px;
          }

          .badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }

          .badge.gov {
            background: #e6fffa;
            color: #319795;
          }

          .badge.admin {
            background: #faf5ff;
            color: #9f7aea;
          }

          .nurse-info h3 {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 4px;
          }

          .position {
            font-size: 14px;
            color: #718096;
            margin-bottom: 16px;
          }

          .nurse-details {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .detail-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #4a5568;
          }

          .detail-item .icon {
            font-size: 14px;
          }

          .detail-item .text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .view-profile-hint {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px;
            text-align: center;
            font-size: 14px;
            font-weight: 500;
            opacity: 0;
            transform: translateY(100%);
            transition: all 0.3s ease;
          }

          .profile-modal {
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
          }

          .close-button {
            position: absolute;
            top: 20px;
            right: 20px;
            background: #f7fafc;
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            transition: all 0.3s ease;
            z-index: 10;
          }

          .close-button:hover {
            background: #e2e8f0;
          }

          .profile-header {
            display: flex;
            gap: 24px;
            align-items: center;
            margin-bottom: 32px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e2e8f0;
          }

          .profile-avatar {
            width: 96px;
            height: 96px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            font-weight: 600;
            overflow: hidden;
            flex-shrink: 0;
          }

          .profile-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .profile-title h2 {
            font-size: 24px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 4px;
          }

          .profile-title p {
            font-size: 16px;
            color: #718096;
            margin-bottom: 12px;
          }

          .profile-badges {
            display: flex;
            gap: 8px;
          }

          .profile-content {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .profile-section {
            background: #f7fafc;
            border-radius: 12px;
            padding: 20px;
          }

          .profile-section h3 {
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 16px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
          }

          .info-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .info-item .label {
            font-size: 12px;
            color: #718096;
          }

          .info-item .value {
            font-size: 14px;
            font-weight: 500;
            color: #2d3748;
          }

          .constraints-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .constraint-item {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .constraint-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }

          .constraint-badge.hard {
            background: #fed7d7;
            color: #c53030;
          }

          .constraint-badge.soft {
            background: #fefcbf;
            color: #d69e2e;
          }

          @media (max-width: 768px) {
            .page-header {
              flex-direction: column;
              align-items: stretch;
            }

            .search-box {
              max-width: none;
            }

            .nurses-grid {
              grid-template-columns: 1fr;
            }

            .profile-header {
              flex-direction: column;
              text-align: center;
            }

            .profile-badges {
              justify-content: center;
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}

function getConstraintLabel(type, value) {
  const labels = {
    'no_mondays': 'ไม่เข้าเวรวันจันทร์',
    'no_tuesdays': 'ไม่เข้าเวรวันอังคาร',
    'no_wednesdays': 'ไม่เข้าเวรวันพุธ',
    'no_thursdays': 'ไม่เข้าเวรวันพฤหัสบดี',
    'no_fridays': 'ไม่เข้าเวรวันศุกร์',
    'no_saturdays': 'ไม่เข้าเวรวันเสาร์',
    'no_sundays': 'ไม่เข้าเวรวันอาทิตย์',
    'no_morning_shifts': 'ไม่เข้าเวรเช้า',
    'no_afternoon_shifts': 'ไม่เข้าเวรบ่าย',
    'no_night_shifts': 'ไม่เข้าเวรดึก',
    'no_night_afternoon_double': 'ไม่เข้าเวรดึก+บ่าย',
    'no_specific_days': `ไม่เข้าเวรวันที่ ${Array.isArray(value) ? value.join(', ') : value}`
  };
  
  return labels[type] || type;
}