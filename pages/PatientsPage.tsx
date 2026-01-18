import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus } from '../types';
import { patientService } from '../services/supabaseService';
import PatientCard from '../components/PatientCard';
import { Search, BedDouble, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

const PatientsPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    const data = await patientService.getPatients();
    setPatients(data);
    setLoading(false);
  };

  const activePatients = patients.filter(p => 
    p.status !== PatientStatus.DISCHARGED &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.bed.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 sticky top-16 bg-slate-50 z-10 py-2">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Pacientes</h2>
                <p className="text-slate-500 text-sm">Gerenciamento de leitos</p>
            </div>
            <Link to="/admission" className="bg-medical-600 text-white p-2 rounded-lg shadow-sm hover:bg-medical-700 transition-colors">
                <UserPlus className="w-6 h-6" />
            </Link>
        </div>
        
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou leito..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 shadow-sm"
            />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-600"></div>
        </div>
      ) : (
        <section>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePatients.length > 0 ? (
                activePatients.map(patient => (
                  <PatientCard key={patient.id} patient={patient} />
                ))
              ) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  <BedDouble className="w-12 h-12 mb-2 opacity-50" />
                  <p className="font-medium">Nenhum paciente encontrado.</p>
                </div>
              )}
            </div>
        </section>
      )}
    </div>
  );
};

export default PatientsPage;