import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../../lib/auth';
import Layout from '../../components/Layout';
import { db, SHIFT_CODES } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import Head from 'next/head';

export default function SoftRequest() {
  const { userData } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [requests, setRequests] = useState([]);
  const [existingRequest, setExistingRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [highPriorityCount, setHighPriorityCount] = useState(0);
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    setSelectedMonth(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    if (selectedMonth && userData) {
      loadExistingRequest();
    }
  }, [selectedMonth, userData]);

  const loadExistingRequest = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const requestsRef = collection(db, 'softRequests');
      const q = query(
        requestsRef,
        where('nurseId', '==', userData.id),
        where('year', '==', parseInt(year)),
        where('month', '==', parseInt(month))
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        setExistingRequest({
          id: querySnapshot.docs[0].id,
          ...docData
        });
        setRequests(docData.requests || []);
        setHighPriorityCount(
          (docData.requests || []).filter(r => r.is_high_priority).length
        );
      } else {
        setExistingRequest(null);
        setRequests([]);
        setHighPriorityCount(0);
      }
    } catch (error) {
      console.error('Error loading existing request:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRequest = () => {
    if (requests.length >= 2) {
      alert('คุณสามารถส่งคำขอได้สูงสุด 2 รายการต่อเดือน');
      return;
    }

    setRequests([...requests, {
      type: 'no_specific_days',
      value: [],
      is_high_priority: false
    }]);
  };

  const updateRequest = (index, field, value) => {
    const updatedRequests = [...requests];
    
    if (field === 'is_high_priority' && value === true) {
      if (highPriorityCount >= 1 && !updatedRequests[index].is_high_priority) {
        alert('คุณสามารถเลือก "สำคัญมาก" ได้เพียง 1 รายการต่อเดือน');
        return;
      }
    }

    if (field === 'type' && value === 'request_specific_shifts_on_days') {
      updatedRequests[index] = {
        type: value,
        value: [{ day: 1, shift_type: SHIFT_CODES.M_REQUEST }],
        is_high_priority: updatedRequests[index].is_high_priority
      };
    } else {
      updatedRequests[index][field] = value;
    }

    setRequests(updatedRequests);
    setHighPriorityCount(
      updatedRequests.filter(r => r.is_high_priority).length
    );
  };

  const removeRequest = async (index) => {
    if (!confirm('ต้องการลบคำขอนี้หรือไม่?')) {
      return;
    }

    const updatedRequests = requests.filter((_, i) => i !== index);
    
    // บันทึกทันทีหลังจากลบ
    setSaving(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const requestData = {
        nurseId: userData.id,
        ward: userData.ward,
        year: parseInt(year),
        month: parseInt(month),
        requests: updatedRequests,
        createdAt: existingRequest?.createdAt || new Date(),
        updatedAt: new Date()
      };

      if (existingRequest) {
        await setDoc(doc(db, 'softRequests', existingRequest.id), requestData);
      } else {
        const docId = `${userData.id}_${year}_${month}`;
        await setDoc(doc(db, 'softRequests', docId), requestData);
      }

      // อัพเดท state หลังบันทึกสำเร็จ
      setRequests(updatedRequests);
      setHighPriorityCount(
        updatedRequests.filter(r => r.is_high_priority).length
      );
      
      alert('ลบคำขอสำเร็จ');
    } catch (error) {
      console.error('Error removing request:', error);
      alert('เกิดข้อผิดพลาดในการลบคำขอ');
    } finally {
      setSaving(false);
    }
  };

  const addSpecificShift = (requestIndex) => {
    const updatedRequests = [...requests];
    if (!updatedRequests[requestIndex].value) {
      updatedRequests[requestIndex].value = [];
    }
    
    if (updatedRequests[requestIndex].value.length >= 3) {
      alert('สามารถเลือกได้สูงสุด 3 วัน');
      return;
    }

    updatedRequests[requestIndex].value.push({
      day: 1,
      shift_type: SHIFT_CODES.M_REQUEST
    });
    
    setRequests(updatedRequests);
  };

  const updateSpecificShift = (requestIndex, shiftIndex, field, value) => {
    const updatedRequests = [...requests];
    updatedRequests[requestIndex].value[shiftIndex][field] = value;
    setRequests(updatedRequests);
  };

  const removeSpecificShift = (requestIndex, shiftIndex) => {
    const updatedRequests = [...requests];
    updatedRequests[requestIndex].value.splice(shiftIndex, 1);
    setRequests(updatedRequests);
  };

  const handleSubmit = async () => {
    // ตรวจสอบความถูกต้องของข้อมูลเฉพาะเมื่อมีคำขอ
    if (requests.length > 0) {
      const validRequests = requests.filter(req => {
        if (req.type === 'no_specific_days') {
          return req.value && req.value.length > 0;
        } else if (req.type === 'request_specific_shifts_on_days') {
          return req.value && req.value.length > 0;
        }
        return true;
      });

      if (validRequests.length !== requests.length) {
        alert('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
      }
    }

    setSaving(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const requestData = {
        nurseId: userData.id,
        ward: userData.ward,
        year: parseInt(year),
        month: parseInt(month),
        requests: requests,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (existingRequest) {
        await setDoc(doc(db, 'softRequests', existingRequest.id), requestData);
      } else {
        const docId = `${userData.id}_${year}_${month}`;
        await setDoc(doc(db, 'softRequests', docId), requestData);
      }

      alert('บันทึกคำขอสำเร็จ');
      
      // รีโหลดข้อมูลหลังบันทึกสำเร็จ
      await loadExistingRequest();
    } catch (error) {
      console.error('Error saving request:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const getMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                   'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  const getDaysInMonth = () => {
    if (!selectedMonth) return 31;
    const [year, month] = selectedMonth.split('-');
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  };

  const getAvailableMonths = () => {
    const months = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(currentYear, currentMonth + i - 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      months.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: getMonthName(`${year}-${String(month).padStart(2, '0')}`)
      });
    }
    return months;
  };

  const requestTypeOptions = [
    { value: 'no_mondays', label: 'ไม่เข้าเวรวันจันทร์' },
    { value: 'no_tuesdays', label: 'ไม่เข้าเวรวันอังคาร' },
    { value: 'no_wednesdays', label: 'ไม่เข้าเวรวันพุธ' },
    { value: 'no_thursdays', label: 'ไม่เข้าเวรวันพฤหัสบดี' },
    { value: 'no_fridays', label: 'ไม่เข้าเวรวันศุกร์' },
    { value: 'no_saturdays', label: 'ไม่เข้าเวรวันเสาร์' },
    { value: 'no_sundays', label: 'ไม่เข้าเวรวันอาทิตย์' },
    { value: 'no_morning_shifts', label: 'ไม่เข้าเวรเช้า' },
    { value: 'no_afternoon_shifts', label: 'ไม่เข้าเวรบ่าย' },
    { value: 'no_night_shifts', label: 'ไม่เข้าเวรดึก' },
    { value: 'no_night_afternoon_double', label: 'ไม่เข้าเวรดึก+บ่าย' },
    { value: 'no_specific_days', label: 'ไม่เข้าเวรวันที่ระบุ' },
    { value: 'request_specific_shifts_on_days', label: 'ขอเวรที่ต้องการ' }
  ];

  return (
    <ProtectedRoute>
      <Layout>
        <Head>
          <title>Soft Request - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="soft-request-container">
          <div className="page-header">
            <h1>Soft Request</h1>
            <p className="subtitle">ส่งคำขอการจัดเวรรายเดือน</p>
          </div>

          <div className="info-section card">
            <h2>ข้อกำหนดการส่งคำขอ</h2>
            <ul>
              <li>สามารถส่งคำขอได้สูงสุด 2 รายการต่อเดือน</li>
              <li>เลือก "สำคัญมาก" ได้เพียง 1 รายการ</li>
              <li>หากคำขอที่ระบุว่า "สำคัญมาก" ไม่ได้รับการตอบสนอง จะได้รับสิทธิพิเศษในเดือนถัดไป</li>
              <li>ระบบจะพยายามจัดเวรตามคำขอ แต่ไม่รับประกันว่าจะได้ 100%</li>
            </ul>
          </div>

          <div className="request-form card">
            <div className="form-header">
              <h2>คำขอสำหรับเดือน</h2>
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

            {loading ? (
              <div className="loading-container">
                <div className="spinner"></div>
              </div>
            ) : (
              <>
                <div className="requests-list">
                  {requests.map((request, index) => (
                    <div key={index} className="request-item">
                      <div className="request-header">
                        <h3>คำขอที่ {index + 1}</h3>
                        <button
                          className="remove-button"
                          onClick={() => removeRequest(index)}
                          disabled={saving}
                          title="ลบคำขอ"
                        >
                          {saving ? '...' : '✕'}
                        </button>
                      </div>

                      <div className="request-content">
                        <div className="form-group">
                          <label className="form-label">ประเภทคำขอ</label>
                          <select
                            className="form-select"
                            value={request.type}
                            onChange={(e) => updateRequest(index, 'type', e.target.value)}
                          >
                            {requestTypeOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {request.type === 'no_specific_days' && (
                          <div className="form-group">
                            <label className="form-label">เลือกวันที่ (สูงสุด 2 วัน)</label>
                            <div className="days-grid">
                              {Array.from({ length: getDaysInMonth() }, (_, i) => i + 1).map(day => (
                                <label key={day} className="day-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={request.value?.includes(day.toString())}
                                    onChange={(e) => {
                                      const currentDays = request.value || [];
                                      if (e.target.checked) {
                                        if (currentDays.length >= 2) {
                                          alert('เลือกได้สูงสุด 2 วัน');
                                          return;
                                        }
                                        updateRequest(index, 'value', [...currentDays, day.toString()]);
                                      } else {
                                        updateRequest(index, 'value', currentDays.filter(d => d !== day.toString()));
                                      }
                                    }}
                                  />
                                  <span>{day}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {request.type === 'request_specific_shifts_on_days' && (
                          <div className="form-group">
                            <label className="form-label">ระบุวันและเวรที่ต้องการ</label>
                            <div className="specific-shifts-list">
                              {(request.value || []).map((shift, shiftIndex) => (
                                <div key={shiftIndex} className="specific-shift-item">
                                  <select
                                    className="day-select"
                                    value={shift.day}
                                    onChange={(e) => updateSpecificShift(index, shiftIndex, 'day', parseInt(e.target.value))}
                                  >
                                    {Array.from({ length: getDaysInMonth() }, (_, i) => i + 1).map(day => (
                                      <option key={day} value={day}>วันที่ {day}</option>
                                    ))}
                                  </select>
                                  
                                  <select
                                    className="shift-select"
                                    value={shift.shift_type}
                                    onChange={(e) => updateSpecificShift(index, shiftIndex, 'shift_type', parseInt(e.target.value))}
                                  >
                                    <option value={SHIFT_CODES.M_REQUEST}>เวรเช้า</option>
                                    <option value={SHIFT_CODES.A_REQUEST}>เวรบ่าย</option>
                                    <option value={SHIFT_CODES.N_REQUEST}>เวรดึก</option>
                                    <option value={SHIFT_CODES.NA_DOUBLE_REQUEST}>เวรดึก+บ่าย</option>
                                  </select>
                                  
                                  <button
                                    className="remove-shift-button"
                                    onClick={() => removeSpecificShift(index, shiftIndex)}
                                  >
                                    ลบ
                                  </button>
                                </div>
                              ))}
                              
                              {(request.value || []).length < 3 && (
                                <button
                                  className="add-shift-button"
                                  onClick={() => addSpecificShift(index)}
                                >
                                  + เพิ่มวัน
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="priority-section">
                          <label className="priority-checkbox">
                            <input
                              type="checkbox"
                              checked={request.is_high_priority}
                              onChange={(e) => updateRequest(index, 'is_high_priority', e.target.checked)}
                            />
                            <span>สำคัญมาก</span>
                          </label>
                          {request.is_high_priority && (
                            <p className="priority-note">
                              หากคำขอนี้ไม่ได้รับการตอบสนอง คุณจะได้รับสิทธิพิเศษในเดือนถัดไป
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="actions-section">
                  {requests.length < 2 && (
                    <button className="btn btn-secondary" onClick={addRequest}>
                      + เพิ่มคำขอ
                    </button>
                  )}
                  
                  {(requests.length > 0 || existingRequest) && (
                    <button
                      className="btn btn-primary"
                      onClick={handleSubmit}
                      disabled={saving}
                    >
                      {saving ? 'กำลังบันทึก...' : 'บันทึกคำขอ'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <style jsx>{`
          .soft-request-container {
            max-width: 1000px;
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

          .info-section {
            margin-bottom: 24px;
            background: #f0f9ff;
            border: 1px solid #90cdf4;
          }

          .info-section h2 {
            font-size: 18px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 16px;
          }

          .info-section ul {
            list-style: none;
            padding: 0;
          }

          .info-section li {
            position: relative;
            padding-left: 24px;
            margin-bottom: 8px;
            font-size: 14px;
            color: #4a5568;
          }

          .info-section li:before {
            content: "•";
            position: absolute;
            left: 8px;
            color: #3182ce;
          }

          .request-form {
            margin-bottom: 24px;
          }

          .form-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
          }

          .form-header h2 {
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
          }

          .month-selector {
            padding: 10px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            background: white;
            cursor: pointer;
          }

          .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 200px;
          }

          .requests-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-bottom: 24px;
          }

          .request-item {
            background: #f7fafc;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #e2e8f0;
          }

          .request-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .request-header h3 {
            font-size: 16px;
            font-weight: 600;
            color: #4a5568;
          }

          .remove-button {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: none;
            background: #fed7d7;
            color: #c53030;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 16px;
          }

          .remove-button:hover {
            background: #fc8181;
          }

          .remove-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .request-content {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .days-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
            gap: 8px;
          }

          .day-checkbox {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid #e2e8f0;
          }

          .day-checkbox:hover {
            background: #ebf4ff;
            border-color: #90cdf4;
          }

          .day-checkbox input[type="checkbox"] {
            cursor: pointer;
          }

          .specific-shifts-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .specific-shift-item {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .day-select,
          .shift-select {
            padding: 8px 12px;
            border: 2px solid #e2e8f0;
            border-radius: 6px;
            font-size: 14px;
            background: white;
            cursor: pointer;
          }

          .day-select {
            flex: 1;
          }

          .shift-select {
            flex: 1.5;
          }

          .remove-shift-button {
            padding: 8px 16px;
            background: #fed7d7;
            color: #c53030;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
          }

          .remove-shift-button:hover {
            background: #fc8181;
          }

          .add-shift-button {
            padding: 10px 16px;
            background: #e6fffa;
            color: #319795;
            border: 1px dashed #38b2ac;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
          }

          .add-shift-button:hover {
            background: #b2f5ea;
          }

          .priority-section {
            background: white;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }

          .priority-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #2d3748;
          }

          .priority-checkbox input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .priority-note {
            margin-top: 8px;
            font-size: 13px;
            color: #d69e2e;
            background: #fffaf0;
            padding: 8px 12px;
            border-radius: 6px;
          }

          .actions-section {
            display: flex;
            gap: 12px;
            justify-content: center;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }

          @media (max-width: 768px) {
            .form-header {
              flex-direction: column;
              gap: 16px;
              align-items: stretch;
            }

            .month-selector {
              width: 100%;
            }

            .specific-shift-item {
              flex-wrap: wrap;
            }

            .day-select,
            .shift-select {
              width: 100%;
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}