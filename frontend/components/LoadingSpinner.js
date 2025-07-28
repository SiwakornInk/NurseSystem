export default function LoadingSpinner({ size = 'medium', color = 'primary' }) {
  const sizeClasses = {
    small: { width: 24, height: 24, border: 3 },
    medium: { width: 40, height: 40, border: 4 },
    large: { width: 60, height: 60, border: 5 }
  };

  const colorClasses = {
    primary: '#667eea',
    white: '#ffffff',
    gray: '#718096'
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.medium;
  const spinnerColor = colorClasses[color] || colorClasses.primary;

  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
      <style jsx>{`
        .loading-spinner-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        .loading-spinner {
          width: ${spinnerSize.width}px;
          height: ${spinnerSize.height}px;
          border: ${spinnerSize.border}px solid #e2e8f0;
          border-top-color: ${spinnerColor};
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}