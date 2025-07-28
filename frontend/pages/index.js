import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';
import Head from 'next/head';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  
  const { login, resetPassword, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setLoading(true);

    try {
      await resetPassword(resetEmail);
      setResetMessage('ส่งลิงก์รีเซตรหัสผ่านไปยังอีเมลของคุณแล้ว');
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail('');
        setResetMessage('');
      }, 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>ระบบจัดเวรพยาบาล - เข้าสู่ระบบ</title>
      </Head>
      <div className="login-container">
        <div className="login-box">
          <div className="hospital-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 8H17V3H7V8H5C3.9 8 3 8.9 3 10V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V10C21 8.9 20.1 8 19 8ZM9 5H15V8H9V5ZM19 20H5V10H19V20Z" fill="currentColor"/>
              <path d="M11 13H8V16H11V19H13V16H16V13H13V10H11V13Z" fill="currentColor"/>
            </svg>
          </div>
          
          <h1>ระบบจัดเวรพยาบาล</h1>
          <p className="subtitle">โรงพยาบาลส่วนกลาง</p>

          {!showForgotPassword ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <input
                  type="email"
                  placeholder="อีเมล @gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <input
                  type="password"
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>

              <button 
                type="button" 
                className="forgot-password-link"
                onClick={() => setShowForgotPassword(true)}
                disabled={loading}
              >
                ลืมรหัสผ่าน?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <h3>รีเซตรหัสผ่าน</h3>
              <div className="form-group">
                <input
                  type="email"
                  placeholder="กรอกอีเมล @gmail.com ที่ลงทะเบียนไว้"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="error-message">{error}</div>}
              {resetMessage && <div className="success-message">{resetMessage}</div>}

              <div className="button-group">
                <button type="submit" className="reset-button" disabled={loading}>
                  {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซต'}
                </button>
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                    setResetEmail('');
                  }}
                  disabled={loading}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}
          
          <div className="login-footer">
            <p>ระบบนี้สำหรับบุคลากรของโรงพยาบาลเท่านั้น</p>
            <p>หากต้องการบัญชีผู้ใช้ กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .login-box {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          padding: 60px 50px;
          width: 100%;
          max-width: 450px;
          text-align: center;
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hospital-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 30px;
          color: #667eea;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        h1 {
          font-size: 28px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 10px;
        }

        h3 {
          font-size: 22px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 20px;
        }

        .subtitle {
          font-size: 16px;
          color: #718096;
          margin-bottom: 40px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        input {
          width: 100%;
          padding: 15px 20px;
          font-size: 16px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          transition: all 0.3s ease;
          background: #f7fafc;
        }

        input:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.1);
        }

        input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-button, .reset-button {
          width: 100%;
          padding: 15px;
          font-size: 16px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 10px;
        }

        .login-button:hover:not(:disabled), .reset-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }

        .login-button:active:not(:disabled), .reset-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-button:disabled, .reset-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .forgot-password-link {
          background: none;
          border: none;
          color: #667eea;
          font-size: 14px;
          cursor: pointer;
          margin-top: 20px;
          transition: color 0.3s ease;
          text-decoration: underline;
        }

        .forgot-password-link:hover {
          color: #764ba2;
        }

        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .button-group button {
          flex: 1;
        }

        .cancel-button {
          padding: 15px;
          font-size: 16px;
          font-weight: 600;
          color: #4a5568;
          background: #e2e8f0;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .cancel-button:hover:not(:disabled) {
          background: #cbd5e0;
          transform: translateY(-2px);
        }

        .error-message {
          color: #e53e3e;
          font-size: 14px;
          margin: 15px 0;
          padding: 10px;
          background: #fff5f5;
          border-radius: 8px;
          animation: shake 0.5s ease-in-out;
        }

        .success-message {
          color: #38a169;
          font-size: 14px;
          margin: 15px 0;
          padding: 10px;
          background: #f0fff4;
          border-radius: 8px;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .login-footer {
          margin-top: 40px;
          padding-top: 30px;
          border-top: 1px solid #e2e8f0;
        }

        .login-footer p {
          font-size: 13px;
          color: #718096;
          margin: 5px 0;
        }

        @media (max-width: 480px) {
          .login-box {
            padding: 40px 30px;
          }

          h1 {
            font-size: 24px;
          }

          .hospital-icon {
            width: 60px;
            height: 60px;
          }
        }
      `}</style>
    </>
  );
}