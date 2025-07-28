import { useState, useEffect } from 'react';
import { useAuth, ProtectedRoute } from '../../lib/auth';
import Layout from '../../components/Layout';
import { db, auth as firebaseAuth, WARDS } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import Head from 'next/head';

export default function AdminAccounts() {
  const { userData } = useAuth();
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWard, setFilterWard] = useState('all');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    prefix: '',
    firstName: '',
    lastName: '',
    position: '',
    ward: '',
    phone: '',
    startDate: '',
    isGovernmentOfficial: false,
    isAdmin: false
  });

  useEffect(() => {
    loadNurses();
  }, []);

  const loadNurses = async () => {
    setLoading(true);
    try {
      const nursesRef = collection(db, 'users');
      const q = query(nursesRef, orderBy('createdAt', 'desc'));
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

  const handleCreateNurse = async (e) => {
    e.preventDefault();
    if (!formData.email.endsWith('@gmail.com')) {
      alert('กรุณาใช้อีเมล @gmail.com เท่านั้น');
      return;
    }

    setCreating(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        formData.email,
        formData.password
      );

      const userDoc = {
        email: formData.email,
        prefix: formData.prefix,
        firstName: formData.firstName,
        lastName: formData.lastName,
        position: formData.position,
        ward: formData.ward,
        phone: formData.phone,
        startDate: formData.startDate,
        isGovernmentOfficial: formData.isGovernmentOfficial,
        isAdmin: formData.isAdmin,
        constraints: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userDoc);
      
      alert('สร้างบัญชีสำเร็จ');
      setShowCreateModal(false);
      resetForm();
      loadNurses();
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('อีเมลนี้ถูกใช้งานแล้ว');
      } else if (error.code === 'auth/weak-password') {
        alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateNurse = async (e) => {
    e.preventDefault();
    if (!selectedNurse) return;

    setUpdating(true);
    try {
      const userRef = doc(db, 'users', selectedNurse.id);
      const updateData = {
        prefix: formData.prefix,
        firstName: formData.firstName,
        lastName: formData.lastName,
        position: formData.position,
        ward: formData.ward,
        phone: formData.phone,
        startDate: formData.startDate,
        isGovernmentOfficial: formData.isGovernmentOfficial,
        isAdmin: formData.isAdmin,
        updatedAt: new Date()
      };

      await updateDoc(userRef, updateData);
      
      alert('อัพเดทข้อมูลสำเร็จ');
      setShowEditModal(false);
      setSelectedNurse(null);
      resetForm();
      loadNurses();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteNurse = async (nurseId) => {
    if (!confirm('ต้องการลบบัญชีนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', nurseId));
      alert('ลบบัญชีสำเร็จ');
      loadNurses();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('เกิดข้อผิดพลาดในการลบบัญชี');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      prefix: '',
      firstName: '',
      lastName: '',
      position: '',
      ward: '',
      phone: '',
      startDate: '',
      isGovernmentOfficial: false,
      isAdmin: false
    });
  };

  const openEditModal = (nurse) => {
    setSelectedNurse(nurse);
    setFormData({
      email: nurse.email,
      password: '',
      prefix: nurse.prefix || '',
      firstName: nurse.firstName || '',
      lastName: nurse.lastName || '',
      position: nurse.position || '',
      ward: nurse.ward || '',
      phone: nurse.phone || '',
      startDate: nurse.startDate || '',
      isGovernmentOfficial: nurse.isGovernmentOfficial || false,
      isAdmin: nurse.isAdmin || false
    });
    setShowEditModal(true);
  };

  const filteredNurses = nurses.filter(nurse => {
    const matchesSearch = 
      nurse.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nurse.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nurse.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nurse.position?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesWard = filterWard === 'all' || nurse.ward === filterWard;
    
    return matchesSearch && matchesWard;
  });

  const nursesByWard = {};
  WARDS.forEach(ward => {
    nursesByWard[ward.name] = filteredNurses.filter(n => n.ward === ward.name);
  });
  nursesByWard['ไม่ระบุ'] = filteredNurses.filter(n => !n.ward || !WARDS.some(w => w.name === n.ward));

  return (
    <ProtectedRoute adminOnly>
      <Layout>
        <Head>
          <title>จัดการบัญชี - ระบบจัดเวรพยาบาล</title>
        </Head>

        <div className="accounts-container">
          <div className="page-header">
            <h1>จัดการบัญชีพยาบาล</h1>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              สร้างบัญชีใหม่
            </button>
          </div>

          <div className="filters-section">
            <div className="search-box">
              <input
                type="text"
                placeholder="ค้นหาด้วยชื่อ, อีเมล หรือตำแหน่ง..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="ward-filter"
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
            >
              <option value="all">ทุกวอร์ด</option>
              {WARDS.map(ward => (
                <option key={ward.id} value={ward.name}>{ward.name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="nurses-grid">
              {Object.entries(nursesByWard).map(([wardName, wardNurses]) => {
                if (wardNurses.length === 0) return null;
                
                return (
                  <div key={wardName} className="ward-section">
                    <h2>{wardName} ({wardNurses.length} คน)</h2>
                    <div className="nurses-list">
                      {wardNurses.map(nurse => (
                        <div key={nurse.id} className="nurse-card">
                          <div className="nurse-info">
                            <div className="nurse-avatar">
                              {nurse.firstName?.[0] || 'N'}
                            </div>
                            <div className="nurse-details">
                              <h3>{nurse.prefix}{nurse.firstName} {nurse.lastName}</h3>
                              <p className="nurse-position">{nurse.position || 'ไม่ระบุตำแหน่ง'}</p>
                              <p className="nurse-email">{nurse.email}</p>
                              <div className="nurse-badges">
                                {nurse.isGovernmentOfficial && (
                                  <span className="badge gov">ข้าราชการ</span>
                                )}
                                {nurse.isAdmin && (
                                  <span className="badge admin">Admin</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="nurse-actions">
                            <button 
                              className="btn-icon edit"
                              onClick={() => openEditModal(nurse)}
                              title="แก้ไข"
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn-icon delete"
                              onClick={() => handleDeleteNurse(nurse.id)}
                              title="ลบ"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>สร้างบัญชีพยาบาลใหม่</h2>
                <form onSubmit={handleCreateNurse}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">อีเมล</label>
                      <input
                        type="email"
                        className="form-input"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="example@gmail.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">รหัสผ่านเริ่มต้น</label>
                      <input
                        type="password"
                        className="form-input"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">คำนำหน้า</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.prefix}
                        onChange={(e) => setFormData({...formData, prefix: e.target.value})}
                        placeholder="นาง/นางสาว/นาย"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">ชื่อ</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">นามสกุล</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">ตำแหน่ง</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.position}
                        onChange={(e) => setFormData({...formData, position: e.target.value})}
                        placeholder="พยาบาลวิชาชีพ"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">วอร์ด</label>
                      <select
                        className="form-select"
                        value={formData.ward}
                        onChange={(e) => setFormData({...formData, ward: e.target.value})}
                        required
                      >
                        <option value="">เลือกวอร์ด</option>
                        {WARDS.map(ward => (
                          <option key={ward.id} value={ward.name}>{ward.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">เบอร์โทรศัพท์</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="0812345678"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">วันที่เริ่มงาน</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.startDate}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-checkboxes">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.isGovernmentOfficial}
                        onChange={(e) => setFormData({...formData, isGovernmentOfficial: e.target.checked})}
                      />
                      <span>เป็นข้าราชการ</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.isAdmin}
                        onChange={(e) => setFormData({...formData, isAdmin: e.target.checked})}
                      />
                      <span>สิทธิ์ Admin</span>
                    </label>
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                      {creating ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showEditModal && selectedNurse && (
            <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>แก้ไขข้อมูลพยาบาล</h2>
                <form onSubmit={handleUpdateNurse}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">อีเมล</label>
                      <input
                        type="email"
                        className="form-input"
                        value={formData.email}
                        disabled
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">คำนำหน้า</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.prefix}
                        onChange={(e) => setFormData({...formData, prefix: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">ชื่อ</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">นามสกุล</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">ตำแหน่ง</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.position}
                        onChange={(e) => setFormData({...formData, position: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">วอร์ด</label>
                      <select
                        className="form-select"
                        value={formData.ward}
                        onChange={(e) => setFormData({...formData, ward: e.target.value})}
                        required
                      >
                        <option value="">เลือกวอร์ด</option>
                        {WARDS.map(ward => (
                          <option key={ward.id} value={ward.name}>{ward.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">เบอร์โทรศัพท์</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">วันที่เริ่มงาน</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.startDate}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-checkboxes">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.isGovernmentOfficial}
                        onChange={(e) => setFormData({...formData, isGovernmentOfficial: e.target.checked})}
                      />
                      <span>เป็นข้าราชการ</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.isAdmin}
                        onChange={(e) => setFormData({...formData, isAdmin: e.target.checked})}
                      />
                      <span>สิทธิ์ Admin</span>
                    </label>
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="btn btn-primary" disabled={updating}>
                      {updating ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setShowEditModal(false);
                        setSelectedNurse(null);
                        resetForm();
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
          .accounts-container {
            max-width: 1400px;
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

          .filters-section {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            flex-wrap: wrap;
          }

          .search-box {
            flex: 1;
            min-width: 250px;
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

          .ward-filter {
            padding: 12px 20px;
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

          .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
          }

          .nurses-grid {
            display: flex;
            flex-direction: column;
            gap: 40px;
          }

          .ward-section h2 {
            font-size: 20px;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
          }

          .nurses-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
          }

          .nurse-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            transition: all 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .nurse-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
          }

          .nurse-info {
            display: flex;
            gap: 16px;
            align-items: center;
          }

          .nurse-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 20px;
            flex-shrink: 0;
          }

          .nurse-details h3 {
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 4px;
          }

          .nurse-position {
            font-size: 14px;
            color: #718096;
            margin-bottom: 4px;
          }

          .nurse-email {
            font-size: 13px;
            color: #a0aec0;
            margin-bottom: 8px;
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

          .nurse-actions {
            display: flex;
            gap: 8px;
          }

          .btn-icon {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
          }

          .btn-icon.edit {
            background: #ebf4ff;
            color: #3182ce;
          }

          .btn-icon.edit:hover {
            background: #bee3f8;
          }

          .btn-icon.delete {
            background: #fff5f5;
            color: #e53e3e;
          }

          .btn-icon.delete:hover {
            background: #fed7d7;
          }

          .modal-content h2 {
            font-size: 24px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 24px;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
          }

          .form-checkboxes {
            display: flex;
            gap: 24px;
            margin-bottom: 24px;
          }

          .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
          }

          .checkbox-label input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .checkbox-label span {
            font-size: 14px;
            color: #4a5568;
          }

          .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }

          @media (max-width: 768px) {
            .page-header {
              flex-direction: column;
              align-items: stretch;
              gap: 16px;
            }

            .filters-section {
              flex-direction: column;
            }

            .nurses-list {
              grid-template-columns: 1fr;
            }

            .nurse-card {
              flex-direction: column;
              align-items: stretch;
              gap: 16px;
            }

            .nurse-actions {
              justify-content: flex-end;
            }
          }
        `}</style>
      </Layout>
    </ProtectedRoute>
  );
}