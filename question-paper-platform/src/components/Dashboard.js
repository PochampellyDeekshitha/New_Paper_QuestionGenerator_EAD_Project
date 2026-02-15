import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    
    setUser(JSON.parse(userData));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navigateToRolePage = () => {
    if (user?.role === 'subject_expert') {
      navigate('/subject-expert');
    } else {
      navigate('/paper-generator');
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="nav-brand">Question Paper Platform</div>
        <div className="nav-items">
          <span style={{ whiteSpace: "nowrap" }}>Welcome, {user.name}</span>
          <button onClick={handleLogout} className="btn btn-primary">Logout</button>
        </div>
      </nav>
      
      <div className="dashboard-content">
        <div className="welcome-card">
          <h1>Welcome to Dashboard</h1>
          <p>Role: {user.role === 'subject_expert' ? 'Subject Expert' : 'Paper Generator'}</p>
          <button onClick={navigateToRolePage} className="btn btn-success">
            Go to {user.role === 'subject_expert' ? 'Question Management' : 'Paper Generator'}
          </button>
        </div>
        
        <div className="stats-cards">
          <div className="stat-card">
            <h3>Subject Expert</h3>
            <p>Upload and manage questions with CO, BL, and Unit information</p>
          </div>
          <div className="stat-card">
            <h3>Paper Generator</h3>
            <p>Generate question papers based on specific criteria and distributions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;