import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../../lib/auth';
import Layout from '../../components/Layout';
import { db, SHIFT_TYPES } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function SwapRequest() {
  const { userData } = useAuth();
  const [myRequests, setMyRequests] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('my-requests');

  const [formData, setFormData] = useState({
    targetNurseId: '',
    requesterDate: '',
    targetDate: '',
    message: ''
  });

  const [mySchedule, setMySchedule] = useState({});
  const [targetSchedule, setTargetSchedule] = useState({});

  useEffect(() => {
    if (userData) {
      loadData();
    }
  }, [userData]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSchedules(),
        loadNurses(),
        loadSwapRequests()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const schedulesRef = collection(db, 'schedules');
    const q = query(
      schedulesRef,
      where('ward', '==', userData.ward),
      where('year', '==', currentYear),
      where('month', '==', currentMonth)
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
      const currentSchedule = schedulesData[0];
      const myNurseSchedule = currentSchedule.nurseSchedules?.[userData.id];
      if (myNurseSchedule) {
        setMySchedule(myNurseSchedule.shifts || {});
      }
    }
  };

  const loadNurses = async () => {
    const nursesRef = collection(db, 'users');
    const q = query(
      nursesRef,
      where('ward', '==', userData.ward),
      orderBy('firstName')
    );

    const querySnapshot = await getDocs(q);
    const nursesData = [];

    querySnapshot.forEach((doc) => {
      if (doc.id !== userData.id) {
        nursesData.push({
          id: doc.id,
          ...doc.data()
        });
      }
    });

    setNurses(nursesData);
  };

  const loadSwapRequests = async () => {
    const swapRef = collection(db, 'swapRequests');
    
    const myRequestsQuery = query(
      swapRef,
      where('requesterId', '==', userData.id),
      orderBy('createdAt', 'desc')
    );

    const incomingQuery = query(
      swapRef,
      where('targetId', '==', userData.id),
      where('status', '==', 'pending')
    );

    const [mySnapshot, incomingSnapshot] = await Promise.all([
      getDocs(myRequestsQuery),
      getDocs(incomingQuery)
    ]);

    const myRequestsData = [];
    mySnapshot.forEach((doc) => {
      myRequestsData.push({
        id: doc.id,
        ...doc.data()
      });
    });

    const incomingData = [];
    incomingSnapshot.forEach((doc) => {
      incomingData.push({
        id: doc.id,
        ...doc.data()
      });
    });

    setMyRequests(myRequestsData);
    setIncomingRequests(incomingData);
  };

  const handleTargetNurseChange = (nurseId) => {
    setFormData({ ...formData, targetNurseId: nurseId });
    
    if (schedules.length > 0 && nurseId) {
      const currentSchedule = schedules[0];
      const nurseSchedule = currentSchedule.nurseSchedules?.[nurseId];
      if (nurseSchedule) {
        setTargetSchedule(nurseSchedule.shifts || {});
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.targetNurseId || !formData.requesterDate || !formData.targetDate) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const requesterShifts = mySchedule[formData.requesterDate] || [];
    const targetShifts = targetSchedule[formData.targetDate] || [];

    if (requesterShifts.length === 0 && targetShifts.length === 0) {
      alert('ทั้งสองวันเป็นวันหยุด ไม่สามารถแลกเวรได้');
      return;
    }

    setSubmitting(true);
    try {
      const targetNurse = nurses.find(n => n.id === formData.targetNurseId);

      await addDoc(collection(db, 'swapRequests'), {
        requesterId: userData.id,
        requesterName: `${userData.firstName} ${userData.lastName}`,
        targetId: formData.targetNurseId,
        targetName: `${targetNurse.firstName} ${targetNurse.lastName}`,
        ward: userData.ward,
        requesterDate: formData.requesterDate,
        requesterShifts: requesterShifts,
        targetDate: formData.targetDate,
        targetShifts: targetShifts,
        message: formData.message,
        status: 'pending',
        approvedBy: null,
        createdAt: new Date()
      });

      alert('ส่งคำขอแลกเวรสำเร็จ');
      setShowCreateModal(false);
      setFormData({
        targetNurseId: '',
        requesterDate: '',
        targetDate: '',
        message: ''
      });
      loadSwapRequests();
    } catch (error) {
      console.error('Error submitting swap request:', error);
      alert('เกิดข้อผิดพลาดในการส่งคำขอ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    if (!confirm('ยอมรับการแลกเวรนี้หรือไม่?')) return;

    try {
      await updateDoc(doc(db, 'swapRequests', requestId), {
        status: 'accepted',
        acceptedAt: new Date()
      });

      alert('ยอมรับคำขอแลกเวรแล้ว รอการอนุมัติจาก Admin');
      loadSwapRequests();
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('เกิดข้อผิดพลาดในการยอมรับคำขอ');
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!confirm('ปฏิเสธการแลกเวรนี้หรือไม่?')) return;

    try {
      await updateDoc(doc(db, 'swapRequests', requestId), {
        status: 'rejected',
        rejectedAt: new Date()
      });

      alert('ปฏิเสธคำขอแลกเวรแล้ว');
      loadSwapRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('เกิดข้อผิดพลาดในการปฏิเสธคำขอ');
    }
  };

  const getShiftDisplay = (shifts) => {
    if (!shifts || shifts.length === 0) {
      return <span className="shift-off">วันหยุด</span>;
    }
    
    return shifts.map(shiftId => {
      const shift = Object.values(SHIFT_TYPES).find(s => s.id === shiftId);
      return shift ? (
        <span key={shiftId} className="shift-badge" style={{ backgroundColor: shift.color }}>
          {shift.nameTH}
        </span>
      ) : null;
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { text: 'รอตอบรับ', color: 'warning' },
      accepted: { text: 'รออนุมัติ', color: 'info' },
      approved: { text: 'อนุมัติแล้ว', color: 'success' },
      rejected: { text: 'ปฏิเสธ', color: 'danger' }
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
      day: 'numeric',
      month: 'short',
      weekday: 'short'
    });
  };

  const getAvailableDates = () => {
    const dates = Object.keys(mySchedule).sort();
    const today = new Date().toISOString().split('T')[0];
    return dates.filter(date => date > today);
  };

  const getTargetDates = () => {
    const dates = Object.keys(targetSchedule).sort();
    const today = new Date().toISOString().split('T')[0];
    return dates.filter(date => date > today);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <Head>
          <title>แลกเวร - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="swap-container">
          <div className="page-header">
            <h1>แลกเวร</h1>
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              + สร้างคำขอแลกเวร
            </button>
          </div>

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'my-requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-requests')}
            >
              คำขอของฉัน ({myRequests.length})
            </button>
            <button
              className={`tab ${activeTab === 'incoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('incoming')}
            >
              รอการตอบรับ ({incomingRequests.length})
            </button>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              {activeTab === 'my-requests' && (
                <div className="requests-section">
                  {myRequests.length === 0 ? (
                    <div className="empty-state">
                      <p>ยังไม่มีคำขอแลกเวร</p>
                    </div>
                  ) : (
                    <div className="requests-grid">
                      {myRequests.map(request => (
                        <div key={request.id} className="request-card card">
                          <div className="request-header">
                            <h3>แลกเวรกับ {request.targetName}</h3>
                            {getStatusBadge(request.status)}
                          </div>
                          
                          <div className="swap-details">
                            <div className="swap-side">
                              <h4>เวรของคุณ</h4>
                              <p className="swap-date">{formatDate(request.requesterDate)}</p>
                              <div className="shifts-display">
                                {getShiftDisplay(request.requesterShifts)}
                              </div>
                            </div>
                            
                            <div className="swap-arrow">⇄</div>
                            
                            <div className="swap-side">
                              <h4>เวรที่ขอแลก</h4>
                              <p className="swap-date">{formatDate(request.targetDate)}</p>
                              <div className="shifts-display">
                                {getShiftDisplay(request.targetShifts)}
                              </div>
                            </div>
                          </div>

                          {request.message && (
                            <div className="request-message">
                              <p>ข้อความ: {request.message}</p>
                            </div>
                          )}

                          <div className="request-meta">
                            <span>ส่งเมื่อ: {new Date(request.createdAt.toDate()).toLocaleDateString('th-TH')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'incoming' && (
                <div className="requests-section">
                  {incomingRequests.length === 0 ? (
                    <div className="empty-state">
                      <p>ไม่มีคำขอแลกเวรที่รอการตอบรับ</p>
                    </div>
                  ) : (
                    <div className="requests-grid">
                      {incomingRequests.map(request => (
                        <div key={request.id} className="request-card card">
                          <div className="request-header">
                            <h3>{request.requesterName} ขอแลกเวร</h3>
                            {getStatusBadge(request.status)}
                          </div>
                          
                          <div className="swap-details">
                            <div className="swap-side">
                              <h4>เวรของเขา</h4>
                              <p className="swap-date">{formatDate(request.requesterDate)}</p>
                              <div className="shifts-display">
                                {getShiftDisplay(request.requesterShifts)}
                              </div>
                            </div>
                            
                            <div className="swap-arrow">⇄</div>
                            
                            <div className="swap-side">
                              <h4>เวรของคุณ</h4>
                              <p className="swap-date">{formatDate(request.targetDate)}</p>
                              <div className="shifts-display">
                                {getShiftDisplay(request.targetShifts)}
                              </div>
                            </div>
                          </div>

                          {request.message && (
                            <div className="request-message">
                              <p>ข้อความ: {request.message}</p>
                            </div>
                          )}

                          <div className="request-actions">
                            <button
                              className="btn btn-success"
                              onClick={() => handleAcceptRequest(request.id)}
                            >
                              ยอมรับ
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => handleRejectRequest(request.id)}
                            >
                              ปฏิเสธ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>สร้างคำขอแลกเวร</h2>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">เลือกพยาบาลที่ต้องการแลกเวร</label>
                    <select
                      className="form-select"
                      value={formData.targetNurseId}
                      onChange={(e) => handleTargetNurseChange(e.target.value)}
                      required
                    >
                      <option value="">-- เลือกพยาบาล --</option>
                      {nurses.map(nurse => (
                        <option key={nurse.id} value={nurse.id}>
                          {nurse.firstName} {nurse.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">เวรของคุณที่ต้องการแลก</label>
                      <select
                        className="form-select"
                        value={formData.requesterDate}
                        onChange={(e) => setFormData({...formData, requesterDate: e.target.value})}
                        required
                      >
                        <option value="">-- เลือกวัน --</option>
                        {getAvailableDates().map(date => (
                          <option key={date} value={date}>
                            {formatDate(date)} - {getShiftDisplay(mySchedule[date])}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">เวรที่ต้องการได้</label>
                      <select
                        className="form-select"
                        value={formData.targetDate}
                        onChange={(e) => setFormData({...formData, targetDate: e.target.value})}
                        required
                        disabled={!formData.targetNurseId}
                      >
                        <option value="">-- เลือกวัน --</option>
                        {getTargetDates().map(date => (
                          <option key={date} value={date}>
                            {formatDate(date)} - {getShiftDisplay(targetSchedule[date])}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">ข้อความถึงผู้รับ (ถ้ามี)</label>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      placeholder="เช่น ต้องไปธุระส่วนตัว..."
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                    />
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
                        setFormData({
                          targetNurseId: '',
                          requesterDate: '',
                          targetDate: '',
                          message: ''
                        });
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
          .swap-container {
            max-width: 1200px;
            margin: 0 auto;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
          }

          .page-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #2d3748;
          }

          .tabs {
            display: flex;
            gap: 4px;
            background: #f7fafc;
            padding: 4px;
            border-radius: 8px;
            margin-bottom: 24px;
          }

          .tab {
            flex: 1;
            padding: 12px 24px;
            border: none;
            background: transparent;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            color: #4a5568;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .tab:hover {
            color: #2d3748;
          }

          .tab.active {
            background: white;
            color: #667eea;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 300px;
          }

          .requests-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 24px;
          }

          .request-card {
            transition: all 0.3s ease;
          }

          .request-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          }

          .request-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
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

          .status-badge.info {
            background: #bee3f8;
            color: #2b6cb0;
          }

          .status-badge.success {
            background: #c6f6d5;
            color: #2f855a;
          }

          .status-badge.danger {
            background: #fed7d7;
            color: #c53030;
          }

          .swap-details {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 20px;
          }

          .swap-side {
            flex: 1;
            text-align: center;
          }

          .swap-side h4 {
            font-size: 14px;
            font-weight: 600;
            color: #718096;
            margin-bottom: 8px;
          }

          .swap-date {
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 8px;
          }

          .swap-arrow {
            font-size: 24px;
            color: #cbd5e0;
          }

          .shifts-display {
            display: flex;
            gap: 8px;
            justify-content: center;
            flex-wrap: wrap;
          }

          .shift-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            color: white;
          }

          .shift-off {
            color: #718096;
            font-size: 14px;
          }

          .request-message {
            background: #f7fafc;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .request-message p {
            font-size: 14px;
            color: #4a5568;
            margin: 0;
          }

          .request-meta {
            font-size: 12px;
            color: #a0aec0;
          }

          .request-actions {
            display: flex;
            gap: 12px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }

          .request-actions button {
            flex: 1;
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
            margin-bottom: 24px;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
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
          }

          .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
          }

          @media (max-width: 768px) {
            .page-header {
              flex-direction: column;
              gap: 16px;
              align-items: stretch;
            }

            .requests-grid {
              grid-template-columns: 1fr;
            }

            .swap-details {
              flex-direction: column;
            }

            .swap-arrow {
              transform: rotate(90deg);
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