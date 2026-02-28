
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
import PartogramPage from './pages/PartogramPage';
import BulkObservationForm from './pages/BulkObservationForm';
import BulkEditObservationForm from './pages/BulkEditObservationForm';
import NewSchedulePage from './pages/NewSchedulePage';

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
          <Route path="/patient/:id/bulk-observations" element={<BulkObservationForm />} />
          <Route path="/patient/:id/bulk-edit-observations" element={<BulkEditObservationForm />} />
          <Route path="/patient/:id/new-schedule" element={<NewSchedulePage />} />
          <Route path="/patient/:id/ctg" element={<CTGForm />} />
          <Route path="/patient/:id/edit-ctg/:ctgId" element={<CTGForm />} />
          <Route path="/patient/:id/partogram" element={<PartogramPage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
