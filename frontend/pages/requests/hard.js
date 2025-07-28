import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../../lib/auth';
import Layout from '../../components/Layout';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function HardRequest() {
  const { userData } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [yearlyCount, setYearlyCount] = useState(0);
  
  const [formData, setFormData] = useState({
    date: '',
    reason: ''
  });

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (userData) {
      loadRequests();
    }
  }, [userData]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const requestsRef = collection(db, 'hardRequests');
      const q = query(
        requestsRef,
        where('nurseId', '==', userData.id),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const requestsData = [];
      let yearCount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        requestsData.push({
          id: doc.id,
          ...data
        });

        const requestDate = new Date(data.date);
        if (requestDate.getFullYear() === currentYear) {
          yearCount++;
        }
      });

      setRequests(requestsData);
      setYearlyCount(yearCount);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (yearlyCount >= 5) {
      alert('คุณใช้สิทธิ์ Hard Request ครบ 5 ครั้งในปีนี้แล้ว');
      return;
    }

    const selectedDate = new Date(formData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      alert('ต้องขอล่วงหน้าอย่างน้อย 1 วัน');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'hardRequests'), {
        nurseId: userData.id,
        ward: userData.ward,
        date: formData.date,
        reason: formData.reason,
        status: 'pending',
        approvedBy: null,
        createdAt: new Date()
      });

      alert('ส่งคำขอสำเร็จ รอการอนุมัติจาก Admin');
      setShowCreateModal(false);
      setFormData({ date: '', reason: '' });
      loadRequests();
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('เกิดข้อผิดพลาดในการส่งคำขอ');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { text: 'รออนุมัติ', color: 'warning' },
      approved: { text: 'อนุมัติแล้ว', color: 'success' },
      rejected: { text: 'ไม่อนุมัติ', color: 'danger' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`status-badge ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const currentYearRequests = requests.filter(req => {
    const date = new Date(req.date);
    return date.getFullYear() === currentYear;
  });

  const pastRequests = requests.filter(req => {
    const date = new Date(req.date);
    return date.getFullYear() < currentYear;
  });

  return (
    <ProtectedRoute>
      <Layout>
        <Head>
          <title>Hard Request - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="hard-request-container">
          <div className="page-header">
            <div>
              <h1>Hard Request</h1>
              <p className="subtitle">ขอล็อกวันหยุดล่วงหน้า</p>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={yearlyCount >= 5}
            >
              {yearlyCount >= 5 ? 'ใช้สิทธิ์ครบแล้ว' : '+ สร้างคำขอใหม่'}
            </button>
          </div>

          <div className="quota-card card">
            <h2>สิทธิ์การขอในปี {currentYear}</h2>
            <div className="quota-display">
              <div className="quota-used">
                <span className="number">{yearlyCount}</span>
                <span className="label">ใช้ไปแล้ว</span>
              </div>
              <div className="quota-divider">/</div>
              <div className="quota-total">
                <span className="number">5</span>
                <span className="label">ครั้งต่อปี</span>
              </div>
            </div>
            <div className="quota-bar">
              <div 
                className="quota-progress"
                style={{ width: `${(yearlyCount / 5) * 100}%` }}
              ></div>
            </div>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              {currentYearRequests.length > 0 && (
                <div className="requests-section">
                  <h2>คำขอในปี {currentYear}</h2>
                  <div className="requests-grid">
                    {currentYearRequests.map(request => (
                      <div key={request.id} className="request-card card">
                        <div className="request-header">
                          <h3>{formatDate(request.date)}</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="request-body">
                          <div className="request-reason">
                            <span className="label">เหตุผล:</span>
                            <p>{request.reason}</p>
                          </div>
                          <div className="request-meta">
                            <span className="meta-item">
                              ส่งเมื่อ: {new Date(request.createdAt.toDate()).toLocaleDateString('th-TH')}
                            </span>
                            {request.status === 'approved' && request.approvedBy && (
                              <span className="meta-item approved">
                                อนุมัติโดย: Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pastRequests.length > 0 && (
                <div className="requests-section">
                  <h2>ประวัติคำขอในอดีต</h2>
                  <div className="requests-grid past">
                    {pastRequests.map(request => (
                      <div key={request.id} className="request-card card past">
                        <div className="request-header">
                          <h3>{formatDate(request.date)}</h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="request-body">
                          <div className="request-reason">
                            <p>{request.reason}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {requests.length === 0 && (
                <div className="empty-state">
                  <p>ยังไม่มีประวัติการขอ Hard Request</p>
                </div>
              )}
            </>
          )}

          {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>สร้าง Hard Request</h2>
                <p className="modal-subtitle">ขอล็อกวันหยุดล่วงหน้า (ต้องผ่านการอนุมัติ)</p>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">วันที่ต้องการหยุด</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">เหตุผล</label>
                    <textarea
                      className="form-textarea"
                      rows="4"
                      placeholder="กรุณาระบุเหตุผลในการขอหยุด..."
                      value={formData.reason}
                      onChange={(e) => setFormData({...formData, reason: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-note">
                    <p>หมายเหตุ:</p>
                    <ul>
                      <li>ต้องขอล่วงหน้าอย่างน้อย 1 วัน</li>
                      <li>รอการอนุมัติจาก Admin ก่อนจึงจะมีผล</li>
                      <li>หากได้รับการอนุมัติ จะไม่ถูกจัดเวรในวันดังกล่าว</li>
                    </ul>
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'กำลังส่ง...' : 'ส่งคำขอ'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowCreateModal(false);
                        setFormData({ date: '', reason: '' });
                      }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
          .hard-request-container {
            max-width: 1200px;
            margin: 0 auto;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 20px;
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

          .quota-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin-bottom: 30px;
          }

          .quota-card h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
          }

          .quota-display {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-bottom: 20px;
          }

          .quota-used,
          .quota-total {
            text-align: center;
          }

          .quota-used .number,
          .quota-total .number {
            display: block;
            font-size: 36px;
            font-weight: 700;
          }

          .quota-used .label,
          .quota-total .label {
            display: block;
            font-size: 14px;
            opacity: 0.9;
          }

          .quota-divider {
            font-size: 36px;
            font-weight: 300;
            opacity: 0.7;
          }

          .quota-bar {
            width: 100%;
            height: 8px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            overflow: hidden;
          }

          .quota-progress {
            height: 100%;
            background: white;
            border-radius: 4px;
            transition: width 0.5s ease;
          }

          .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 300px;
          }

          .requests-section {
            margin-bottom: 40px;
          }

          .requests-section h2 {
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 20px;
          }

          .requests-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
          }

          .request-card {
            transition: all 0.3s ease;
          }

          .request-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          }

          .request-card.past {
            opacity: 0.7;
          }

          .request-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
          }

          .request-header h3 {
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
          }

          .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }

          .status-badge.warning {
            background: #fefcbf;
            color: #d69e2e;
          }

          .status-badge.success {
            background: #c6f6d5;
            color: #2f855a;
          }

          .status-badge.danger {
            background: #fed7d7;
            color: #c53030;
          }

          .request-body {
            font-size: 14px;
          }

          .request-reason {
            margin-bottom: 16px;
          }

          .request-reason .label {
            font-weight: 600;
            color: #4a5568;
            display: block;
            margin-bottom: 4px;
          }

          .request-reason p {
            color: #2d3748;
            line-height: 1.6;
          }

          .request-meta {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: #718096;
          }

          .meta-item.approved {
            color: #2f855a;
          }

          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #718096;
          }

          .modal-content h2 {
            font-size: 24px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 8px;
          }

          .modal-subtitle {
            font-size: 14px;
            color: #718096;
            margin-bottom: 24px;
          }

          .form-textarea {
            width: 100%;
            padding: 10px 16px;
            font-size: 14px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            resize: vertical;
            font-family: inherit;
            transition: all 0.3s ease;
          }

          .form-textarea:focus {
            outline: none;
            border-color: #667eea;
            background: white;
          }

          .form-note {
            background: #f0f9ff;
            border: 1px solid #90cdf4;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
          }

          .form-note p {
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 8px;
          }

          .form-note ul {
            list-style: none;
            padding: 0;
          }

          .form-note li {
            position: relative;
            padding-left: 20px;
            font-size: 13px;
            color: #4a5568;
            margin-bottom: 4px;
          }

          .form-note li:before {
            content: "•";
            position: absolute;
            left: 8px;
            color: #3182ce;
          }

          .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }

          @media (max-width: 768px) {
            .page-header {
              flex-direction: column;
            }

            .requests-grid {
              grid-template-columns: 1fr;
            }

            .quota-display {
              gap: 16px;
            }

            .quota-used .number,
            .quota-total .number {
              font-size: 28px;
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}