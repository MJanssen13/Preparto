
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SchedulePage from './pages/SchedulePage';
import PatientsPage from './pages/PatientsPage';
import PatientDetails from './pages/PatientDetails';
import AdmissionForm from './pages/AdmissionForm';
import EditPatient from './pages/EditPatient';
import ObservationForm from './pages/ObservationForm';
import OverviewPage from './pages/OverviewPage';
import CTGForm from './pages/CTGForm';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<SchedulePage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/admission" element={<AdmissionForm />} />
          <Route path="/patient/:id" element={<PatientDetails />} />
          <Route path="/patient/:id/edit" element={<EditPatient />} />
          <Route path="/patient/:id/add-observation" element={<ObservationForm />} />
          <Route path="/patient/:id/edit-observation/:obsId" element={<ObservationForm />} />
          <Route path="/patient/:id/ctg" element={<CTGForm />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
