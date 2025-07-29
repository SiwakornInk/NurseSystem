import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../lib/auth';

export default function Layout({ children }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { userData, logout } = useAuth();
  const router = useRouter();
  const isAdmin = userData?.isAdmin;

  const menuItems = [
    { path: '/dashboard', label: 'หน้าหลัก', icon: '🏠' },
    { path: '/schedule', label: 'ตารางเวร', icon: '📅' },
    { path: '/nurses', label: 'รายชื่อพยาบาล', icon: '👥' },
    { 
      path: '/requests', 
      label: 'คำขอ', 
      icon: '📝',
      submenu: [
        { path: '/requests/soft', label: 'คำขอรายเดือน' },
        { path: '/requests/hard', label: 'ขอหยุดล่วงหน้า' },
        { path: '/requests/swap', label: 'แลกเวร' }
      ]
    }
  ];

  const adminMenuItems = [
    { path: '/admin', label: 'Admin Dashboard', icon: '📊', exact: true },
    { path: '/admin/accounts', label: 'จัดการบัญชี', icon: '👤' },
    { path: '/admin/approvals', label: 'อนุมัติคำขอ', icon: '✅' },
    { path: '/schedule/create', label: 'สร้างตารางเวร', icon: '📝' }
  ];

  const handleLogout = async () => {
    if (confirm('ต้องการออกจากระบบหรือไม่?')) {
      await logout();
    }
  };

  const isActive = (path) => {
    if (path === '/dashboard' && router.pathname === '/') return true;
    return router.pathname.startsWith(path);
  };

  return (
    <div className="layout-container">
      <nav className="navbar">
        <div className="nav-content">
          <div className="nav-left">
            <button 
              className="mobile-menu-btn"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            
            <Link href="/dashboard" className="logo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M19 8H17V3H7V8H5C3.9 8 3 8.9 3 10V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V10C21 8.9 20.1 8 19 8ZM9 5H15V8H9V5ZM19 20H5V10H19V20Z" fill="currentColor"/>
                <path d="M11 13H8V16H11V19H13V16H16V13H13V10H11V13Z" fill="currentColor"/>
              </svg>
              <span>ระบบจัดเวรพยาบาล</span>
            </Link>
          </div>

          <div className="nav-center">
            <div className="desktop-menu">
              {menuItems.map((item) => (
                <div key={item.path} className="menu-item-wrapper">
                  {item.submenu ? (
                    <div className="dropdown">
                      <button className={`nav-item ${isActive(item.path) ? 'active' : ''}`}>
                        <span className="nav-icon">{item.icon}</span>
                        {item.label}
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M3 4.5L6 7.5L9 4.5H3Z"/>
                        </svg>
                      </button>
                      <div className="dropdown-menu">
                        {item.submenu.map((sub) => (
                          <Link 
                            key={sub.path} 
                            href={sub.path}
                            className={`dropdown-item ${isActive(sub.path) ? 'active' : ''}`}
                          >
                            <span className="dropdown-item-text">{sub.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Link 
                      href={item.path}
                      className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
              
              {isAdmin && (
                <div className="admin-divider">
                  <div className="dropdown">
                    <button className={`nav-item admin-menu ${router.pathname.includes('/admin') || router.pathname.includes('/schedule/create') ? 'active' : ''}`}>
                      <span className="nav-icon">⚙️</span>
                      Admin
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M3 4.5L6 7.5L9 4.5H3Z"/>
                      </svg>
                    </button>
                    <div className="dropdown-menu admin-dropdown">
                      {adminMenuItems.map((item) => (
                        <Link 
                          key={item.path} 
                          href={item.path}
                          className={`dropdown-item ${
                            item.exact 
                              ? router.pathname === item.path ? 'active' : ''
                              : isActive(item.path) ? 'active' : ''
                          }`}
                        >
                          <span className="dropdown-icon">{item.icon}</span>
                          <span className="dropdown-item-text">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="nav-right">
            <div className="user-info" onClick={() => setShowUserMenu(!showUserMenu)}>
              <div className="user-avatar">
                {userData?.profileImage ? (
                  <img src={userData.profileImage} alt={userData.firstName} />
                ) : (
                  <span>{userData?.firstName?.[0] || 'U'}</span>
                )}
              </div>
              <span className="user-name">
                {userData?.firstName} {userData?.lastName}
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 4.5L6 7.5L9 4.5H3Z"/>
              </svg>
            </div>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-detail">
                  <div className="ward-badge">{userData?.ward}</div>
                  {isAdmin && <div className="admin-badge">Admin</div>}
                </div>
                <div className="dropdown-divider"></div>
                <Link href="/dashboard" className="user-dropdown-link">
                  โปรไฟล์ของฉัน
                </Link>
                <button onClick={handleLogout} className="logout-btn">
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showMobileMenu && (
        <div className="mobile-menu">
          <div className="mobile-menu-content">
            {menuItems.map((item) => (
              <div key={item.path}>
                {item.submenu ? (
                  <>
                    <div className="mobile-menu-header">{item.label}</div>
                    {item.submenu.map((sub) => (
                      <Link 
                        key={sub.path} 
                        href={sub.path}
                        className={`mobile-menu-item ${isActive(sub.path) ? 'active' : ''}`}
                        onClick={() => setShowMobileMenu(false)}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </>
                ) : (
                  <Link 
                    href={item.path}
                    className={`mobile-menu-item ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
            
            {isAdmin && (
              <>
                <div className="mobile-menu-divider"></div>
                <div className="mobile-menu-header">Admin</div>
                {adminMenuItems.map((item) => (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className={`mobile-menu-item ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="page-transition">
          {children}
        </div>
      </main>

      <style jsx>{`
        .layout-container {
          min-height: 100vh;
          background: #f7fafc;
        }

        .navbar {
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 20px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .mobile-menu-btn {
          display: none;
          flex-direction: column;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 5px;
        }

        .mobile-menu-btn span {
          width: 24px;
          height: 2px;
          background: #4a5568;
          transition: 0.3s;
        }

        .nav-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        .desktop-menu {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .menu-item-wrapper {
          position: relative;
        }

        .nav-icon {
          font-size: 16px;
          opacity: 0.8;
        }

        .admin-divider {
          margin-left: 20px;
          padding-left: 20px;
          border-left: 1px solid #e2e8f0;
        }

        .admin-menu {
          color: #9f7aea;
        }

        .admin-menu.active {
          background: #faf5ff;
        }

        .dropdown {
          position: relative;
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          padding: 8px;
          min-width: 200px;
          margin-top: 8px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s ease;
          border: 1px solid #e2e8f0;
        }

        .admin-dropdown {
          min-width: 240px;
        }

        .dropdown:hover .dropdown-menu {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .dropdown-icon {
          font-size: 18px;
          opacity: 0.8;
        }

        .dropdown-item-text {
          flex: 1;
        }

        .nav-right {
          position: relative;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .user-info:hover {
          background: #f7fafc;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          overflow: hidden;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-avatar span {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }

        .user-name {
          font-size: 14px;
          font-weight: 500;
          color: #2d3748;
        }

        .user-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          padding: 16px;
          min-width: 220px;
          margin-top: 8px;
          animation: dropdownSlide 0.3s ease;
        }

        @keyframes dropdownSlide {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .user-detail {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .ward-badge {
          padding: 4px 12px;
          background: #ebf4ff;
          color: #667eea;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .admin-badge {
          padding: 4px 12px;
          background: #faf5ff;
          color: #9f7aea;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .dropdown-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 12px -16px;
        }

        .logout-btn {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          color: #e53e3e;
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 8px;
        }

        .logout-btn:hover {
          background: #fff5f5;
        }

        .mobile-menu {
          display: none;
          position: fixed;
          top: 64px;
          left: 0;
          right: 0;
          background: white;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
          z-index: 99;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .mobile-menu-content {
          padding: 20px;
        }

        .mobile-menu-header {
          font-size: 12px;
          font-weight: 600;
          color: #718096;
          text-transform: uppercase;
          margin: 16px 0 8px;
        }

        .mobile-menu-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 16px 0;
        }

        .main-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: flex;
          }

          .desktop-menu {
            display: none;
          }

          .nav-center {
            display: none;
          }

          .mobile-menu {
            display: block;
          }

          .main-content {
            padding: 20px 16px;
          }

          .user-name {
            display: none;
          }
        }
      `}</style>

      <style jsx global>{`
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 18px;
          color: #2d3748;
          text-decoration: none;
        }

        .logo svg {
          color: #667eea;
        }

        .nav-item {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #4a5568;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          cursor: pointer;
          text-decoration: none;
        }

        .nav-item:hover {
          color: #667eea;
          background: #f7fafc;
        }

        .nav-item.active {
          color: #667eea;
          background: #ebf4ff;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          color: #4a5568;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
          text-decoration: none;
        }

        .dropdown-item:hover {
          background: #f7fafc;
          color: #667eea;
          transform: translateX(4px);
        }

        .dropdown-item.active {
          background: #ebf4ff;
          color: #667eea;
          font-weight: 500;
        }

        .dropdown-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 16px;
          background: #667eea;
          border-radius: 0 2px 2px 0;
        }

        .user-dropdown-link {
          display: block;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          color: #4a5568;
          transition: all 0.3s ease;
          text-decoration: none;
        }

        .user-dropdown-link:hover {
          background: #f7fafc;
          color: #667eea;
        }

        .mobile-menu-item {
          display: block;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          color: #4a5568;
          transition: all 0.3s ease;
          margin-bottom: 4px;
          text-decoration: none;
        }

        .mobile-menu-item:hover {
          background: #f7fafc;
          color: #667eea;
        }

        .mobile-menu-item.active {
          background: #ebf4ff;
          color: #667eea;
        }
      `}</style>
    </div>
  );
}