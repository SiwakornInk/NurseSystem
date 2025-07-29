import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../../lib/auth';
import Layout from '../../components/Layout';
import { db, SHIFT_TYPES, SHIFT_CODES } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function AdminApprovals() {
  const { userData } = useAuth();
  const [hardRequests, setHardRequests] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [softRequests, setSoftRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('hard');
  
  // สำหรับเลือกเดือนในแท็บคำขอรายเดือน
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (userData) {
      loadRequests();
    }
  }, [userData, selectedMonth]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadHardRequests(),
        loadSwapRequests(),
        loadSoftRequests()
      ]);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHardRequests = async () => {
    const requestsRef = collection(db, 'hardRequests');
    const q = query(requestsRef, where('status', '==', 'pending'));
    
    const querySnapshot = await getDocs(q);
    const requests = [];

    for (const docSnapshot of querySnapshot.docs) {
      const requestData = docSnapshot.data();
      
      const userDoc = await getDoc(doc(db, 'users', requestData.nurseId));
      const userData = userDoc.exists() ? userDoc.data() : null;

      requests.push({
        id: docSnapshot.id,
        ...requestData,
        nurseInfo: userData
      });
    }

    requests.sort((a, b) => a.createdAt.toDate() - b.createdAt.toDate());
    setHardRequests(requests);
  };

  const loadSwapRequests = async () => {
    const requestsRef = collection(db, 'swapRequests');
    const q = query(requestsRef, where('status', '==', 'accepted'));
    
    const querySnapshot = await getDocs(q);
    const requests = [];

    for (const docSnapshot of querySnapshot.docs) {
      const requestData = docSnapshot.data();
      
      const [requesterDoc, targetDoc] = await Promise.all([
        getDoc(doc(db, 'users', requestData.requesterId)),
        getDoc(doc(db, 'users', requestData.targetId))
      ]);

      requests.push({
        id: docSnapshot.id,
        ...requestData,
        requesterInfo: requesterDoc.exists() ? requesterDoc.data() : null,
        targetInfo: targetDoc.exists() ? targetDoc.data() : null
      });
    }

    requests.sort((a, b) => a.createdAt.toDate() - b.createdAt.toDate());
    setSwapRequests(requests);
  };

  const loadSoftRequests = async () => {
    const [year, month] = selectedMonth.split('-');
    const requestsRef = collection(db, 'softRequests');
    const q = query(
      requestsRef,
      where('year', '==', parseInt(year)),
      where('month', '==', parseInt(month))
    );
    
    const querySnapshot = await getDocs(q);
    const requests = [];

    for (const docSnapshot of querySnapshot.docs) {
      const requestData = docSnapshot.data();
      
      const userDoc = await getDoc(doc(db, 'users', requestData.nurseId));
      const userData = userDoc.exists() ? userDoc.data() : null;

      requests.push({
        id: docSnapshot.id,
        ...requestData,
        nurseInfo: userData
      });
    }

    setSoftRequests(requests);
  };

  const handleApproveHardRequest = async (requestId, requestData) => {
    if (!confirm('อนุมัติคำขอนี้หรือไม่?')) return;

    setProcessing(true);
    try {
      await updateDoc(doc(db, 'hardRequests', requestId), {
        status: 'approved',
        approvedBy: userData.id,
        approvedAt: new Date()
      });

      await addDoc(collection(db, 'approvedHardRequests'), {
        nurseId: requestData.nurseId,
        date: requestData.date,
        approvedAt: new Date()
      });

      alert('อนุมัติคำขอสำเร็จ');
      loadHardRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      alert('เกิดข้อผิดพลาดในการอนุมัติ');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectHardRequest = async (requestId) => {
    const reason = prompt('เหตุผลในการปฏิเสธ:');
    if (!reason) return;

    setProcessing(true);
    try {
      await updateDoc(doc(db, 'hardRequests', requestId), {
        status: 'rejected',
        rejectedBy: userData.id,
        rejectedAt: new Date(),
        rejectionReason: reason
      });

      alert('ปฏิเสธคำขอแล้ว');
      loadHardRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('เกิดข้อผิดพลาดในการปฏิเสธ');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveSwapRequest = async (requestId) => {
    if (!confirm('อนุมัติการแลกเวรนี้หรือไม่?')) return;

    setProcessing(true);
    try {
      await updateDoc(doc(db, 'swapRequests', requestId), {
        status: 'approved',
        approvedBy: userData.id,
        approvedAt: new Date()
      });

      alert('อนุมัติการแลกเวรสำเร็จ');
      loadSwapRequests();
    } catch (error) {
      console.error('Error approving swap:', error);
      alert('เกิดข้อผิดพลาดในการอนุมัติ');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectSwapRequest = async (requestId) => {
    const reason = prompt('เหตุผลในการปฏิเสธ:');
    if (!reason) return;

    setProcessing(true);
    try {
      await updateDoc(doc(db, 'swapRequests', requestId), {
        status: 'rejected',
        rejectedBy: userData.id,
        rejectedAt: new Date(),
        rejectionReason: reason
      });

      alert('ปฏิเสธการแลกเวรแล้ว');
      loadSwapRequests();
    } catch (error) {
      console.error('Error rejecting swap:', error);
      alert('เกิดข้อผิดพลาดในการปฏิเสธ');
    } finally {
      setProcessing(false);
    }
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

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = timestamp.toDate();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return `${diffDays} วันที่แล้ว`;
    if (diffHours > 0) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffMinutes > 0) return `${diffMinutes} นาทีที่แล้ว`;
    return 'เมื่อสักครู่';
  };

  const getMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                   'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  const getAvailableMonths = () => {
    const months = [];
    const currentDate = new Date();
    
    // แสดง 6 เดือนย้อนหลัง + เดือนปัจจุบัน + 3 เดือนข้างหน้า
    for (let i = -6; i <= 3; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      months.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: getMonthName(`${year}-${String(month).padStart(2, '0')}`)
      });
    }
    
    return months;
  };

  const getRequestTypeLabel = (type, value) => {
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
      'no_specific_days': `ไม่เข้าเวรวันที่ ${Array.isArray(value) ? value.join(', ') : value}`,
      'request_specific_shifts_on_days': 'ขอเวรที่ต้องการ'
    };
    
    return labels[type] || type;
  };

  const getShiftTypeLabel = (shiftCode) => {
    const labels = {
      [SHIFT_CODES.M_REQUEST]: 'เวรเช้า',
      [SHIFT_CODES.A_REQUEST]: 'เวรบ่าย',
      [SHIFT_CODES.N_REQUEST]: 'เวรดึก',
      [SHIFT_CODES.NA_DOUBLE_REQUEST]: 'เวรดึก+บ่าย'
    };
    return labels[shiftCode] || '';
  };

  return (
    <ProtectedRoute adminOnly>
      <Layout>
        <Head>
          <title>อนุมัติคำขอ - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="approvals-container">
          <div className="page-header">
            <h1>อนุมัติคำขอ</h1>
            <p className="subtitle">จัดการคำขอที่รอการอนุมัติ</p>
          </div>

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'hard' ? 'active' : ''}`}
              onClick={() => setActiveTab('hard')}
            >
              ขอหยุดล่วงหน้า ({hardRequests.length})
            </button>
            <button
              className={`tab ${activeTab === 'swap' ? 'active' : ''}`}
              onClick={() => setActiveTab('swap')}
            >
              แลกเวร ({swapRequests.length})
            </button>
            <button
              className={`tab ${activeTab === 'soft' ? 'active' : ''}`}
              onClick={() => setActiveTab('soft')}
            >
              คำขอรายเดือน
            </button>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              {activeTab === 'hard' && (
                <div className="requests-section">
                  {hardRequests.length === 0 ? (
                    <div className="empty-state">
                      <p>ไม่มีคำขอหยุดล่วงหน้าที่รอการอนุมัติ</p>
                    </div>
                  ) : (
                    <div className="requests-list">
                      {hardRequests.map(request => (
                        <div key={request.id} className="request-card card">
                          <div className="request-header">
                            <div className="requester-info">
                              <div className="requester-avatar">
                                {request.nurseInfo?.firstName?.[0] || 'N'}
                              </div>
                              <div>
                                <h3>
                                  {request.nurseInfo?.prefix}{request.nurseInfo?.firstName} {request.nurseInfo?.lastName}
                                </h3>
                                <p className="requester-detail">
                                  {request.nurseInfo?.position} - วอร์ด{request.nurseInfo?.ward}
                                </p>
                              </div>
                            </div>
                            <span className="time-ago">{getTimeAgo(request.createdAt)}</span>
                          </div>

                          <div className="request-content">
                            <div className="request-detail">
                              <span className="label">วันที่ขอหยุด:</span>
                              <span className="value">{formatDate(request.date)}</span>
                            </div>
                            <div className="request-detail">
                              <span className="label">เหตุผล:</span>
                              <p className="reason">{request.reason}</p>
                            </div>
                          </div>

                          <div className="request-actions">
                            <button
                              className="btn btn-success"
                              onClick={() => handleApproveHardRequest(request.id, request)}
                              disabled={processing}
                            >
                              อนุมัติ
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => handleRejectHardRequest(request.id)}
                              disabled={processing}
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

              {activeTab === 'swap' && (
                <div className="requests-section">
                  {swapRequests.length === 0 ? (
                    <div className="empty-state">
                      <p>ไม่มีคำขอแลกเวรที่รอการอนุมัติ</p>
                    </div>
                  ) : (
                    <div className="requests-list">
                      {swapRequests.map(request => (
                        <div key={request.id} className="request-card card">
                          <div className="swap-header">
                            <div className="swap-parties">
                              <div className="party">
                                <div className="party-avatar">
                                  {request.requesterInfo?.firstName?.[0] || 'N'}
                                </div>
                                <div>
                                  <h4>{request.requesterName}</h4>
                                  <p>{request.requesterInfo?.position}</p>
                                </div>
                              </div>
                              
                              <div className="swap-icon">⇄</div>
                              
                              <div className="party">
                                <div className="party-avatar">
                                  {request.targetInfo?.firstName?.[0] || 'N'}
                                </div>
                                <div>
                                  <h4>{request.targetName}</h4>
                                  <p>{request.targetInfo?.position}</p>
                                </div>
                              </div>
                            </div>
                            <span className="time-ago">{getTimeAgo(request.createdAt)}</span>
                          </div>

                          <div className="swap-details">
                            <div className="swap-side">
                              <h5>เวรของ {request.requesterName.split(' ')[0]}</h5>
                              <p className="swap-date">{formatDate(request.requesterDate)}</p>
                              <div className="shifts-display">
                                {getShiftDisplay(request.requesterShifts)}
                              </div>
                            </div>
                            
                            <div className="swap-arrow">⇄</div>
                            
                            <div className="swap-side">
                              <h5>เวรของ {request.targetName.split(' ')[0]}</h5>
                              <p className="swap-date">{formatDate(request.targetDate)}</p>
                              <div className="shifts-display">
                                {getShiftDisplay(request.targetShifts)}
                              </div>
                            </div>
                          </div>

                          {request.message && (
                            <div className="request-message">
                              <span className="label">ข้อความ:</span>
                              <p>{request.message}</p>
                            </div>
                          )}

                          <div className="approval-info">
                            <p>ทั้งสองฝ่ายตกลงแลกเวรกันแล้ว รอการอนุมัติจาก Admin</p>
                          </div>

                          <div className="request-actions">
                            <button
                              className="btn btn-success"
                              onClick={() => handleApproveSwapRequest(request.id)}
                              disabled={processing}
                            >
                              อนุมัติ
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => handleRejectSwapRequest(request.id)}
                              disabled={processing}
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

              {activeTab === 'soft' && (
                <div className="requests-section">
                  <div className="month-selector-container">
                    <label>เลือกเดือน:</label>
                    <select
                      className="month-selector"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                      {getAvailableMonths().map(month => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {softRequests.length === 0 ? (
                    <div className="empty-state">
                      <p>ไม่มีคำขอรายเดือนสำหรับ {getMonthName(selectedMonth)}</p>
                    </div>
                  ) : (
                    <div className="soft-requests-list">
                      {softRequests.map(request => (
                        <div key={request.id} className="soft-request-card card">
                          <div className="soft-request-header">
                            <div className="requester-info">
                              <div className="requester-avatar">
                                {request.nurseInfo?.firstName?.[0] || 'N'}
                              </div>
                              <div>
                                <h3>
                                  {request.nurseInfo?.prefix}{request.nurseInfo?.firstName} {request.nurseInfo?.lastName}
                                </h3>
                                <p className="requester-detail">
                                  {request.nurseInfo?.position} - วอร์ด{request.nurseInfo?.ward}
                                </p>
                              </div>
                            </div>
                            <div className="request-count">
                              {request.requests?.length || 0} คำขอ
                            </div>
                          </div>

                          <div className="soft-requests-content">
                            {request.requests?.map((req, idx) => (
                              <div key={idx} className="soft-request-item">
                                <div className="request-type">
                                  <span className="request-number">คำขอที่ {idx + 1}</span>
                                  {req.is_high_priority && (
                                    <span className="priority-badge">สำคัญมาก</span>
                                  )}
                                </div>
                                
                                {req.type === 'request_specific_shifts_on_days' && req.value ? (
                                  <div className="specific-shifts">
                                    <p className="request-label">{getRequestTypeLabel(req.type, req.value)}</p>
                                    <div className="shift-requests">
                                      {req.value.map((shift, shiftIdx) => (
                                        <span key={shiftIdx} className="shift-request-item">
                                          วันที่ {shift.day} - {getShiftTypeLabel(shift.shift_type)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="request-label">
                                    {getRequestTypeLabel(req.type, req.value)}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <style jsx>{`
          .approvals-container {
            max-width: 1200px;
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
            min-height: 400px;
          }

          .empty-state {
            text-align: center;
            padding: 80px 20px;
            color: #718096;
          }

          .requests-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .request-card {
            padding: 24px;
            transition: all 0.3s ease;
          }

          .request-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          }

          .request-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
          }

          .requester-info {
            display: flex;
            gap: 16px;
            align-items: center;
          }

          .requester-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 600;
          }

          .requester-info h3 {
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 4px;
          }

          .requester-detail {
            font-size: 14px;
            color: #718096;
          }

          .time-ago {
            font-size: 12px;
            color: #a0aec0;
          }

          .request-content {
            background: #f7fafc;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
          }

          .request-detail {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
          }

          .request-detail:last-child {
            margin-bottom: 0;
          }

          .label {
            font-size: 14px;
            font-weight: 500;
            color: #4a5568;
            min-width: 120px;
          }

          .value {
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
          }

          .reason {
            font-size: 14px;
            color: #2d3748;
            line-height: 1.6;
            margin: 0;
          }

          .swap-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
          }

          .swap-parties {
            display: flex;
            align-items: center;
            gap: 24px;
          }

          .party {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .party-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 600;
          }

          .party h4 {
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 2px;
          }

          .party p {
            font-size: 12px;
            color: #718096;
          }

          .swap-icon {
            font-size: 24px;
            color: #cbd5e0;
          }

          .swap-details {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 20px;
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
          }

          .swap-side {
            flex: 1;
            text-align: center;
          }

          .swap-side h5 {
            font-size: 14px;
            font-weight: 500;
            color: #4a5568;
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
            background: #f0f9ff;
            border: 1px solid #90cdf4;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
          }

          .request-message p {
            font-size: 14px;
            color: #2d3748;
            margin: 0;
          }

          .approval-info {
            background: #f0fff4;
            border: 1px solid #9ae6b4;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
          }

          .approval-info p {
            font-size: 14px;
            color: #2f855a;
            margin: 0;
            text-align: center;
          }

          .request-actions {
            display: flex;
            gap: 12px;
          }

          .request-actions button {
            flex: 1;
          }

          .month-selector-container {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
            padding: 16px;
            background: #f7fafc;
            border-radius: 8px;
          }

          .month-selector-container label {
            font-size: 14px;
            font-weight: 500;
            color: #4a5568;
          }

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

          .month-selector:focus {
            outline: none;
            border-color: #667eea;
          }

          .soft-requests-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .soft-request-card {
            padding: 24px;
          }

          .soft-request-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
          }

          .request-count {
            background: #ebf4ff;
            color: #3182ce;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
          }

          .soft-requests-content {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .soft-request-item {
            background: #f7fafc;
            border-radius: 8px;
            padding: 16px;
          }

          .request-type {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }

          .request-number {
            font-size: 14px;
            font-weight: 600;
            color: #4a5568;
          }

          .priority-badge {
            background: #fef3c7;
            color: #d97706;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }

          .request-label {
            font-size: 14px;
            color: #2d3748;
            margin: 0;
          }

          .specific-shifts {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .shift-requests {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
          }

          .shift-request-item {
            background: white;
            border: 1px solid #e2e8f0;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 13px;
            color: #4a5568;
          }

          @media (max-width: 768px) {
            .swap-parties {
              flex-direction: column;
              gap: 16px;
            }

            .swap-details {
              flex-direction: column;
            }

            .swap-arrow {
              transform: rotate(90deg);
            }

            .request-actions {
              flex-direction: column;
            }

            .month-selector-container {
              flex-direction: column;
              align-items: stretch;
            }

            .month-selector {
              width: 100%;
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}