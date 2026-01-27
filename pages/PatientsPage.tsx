
import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus } from '../types';
import { patientService } from '../services/supabaseService';
import PatientCard from '../components/PatientCard';
import { Search, BedDouble, UserPlus, Filter, ArrowDownAZ, ArrowDown01 } from 'lucide-react';
import { Link } from 'react-router-dom';

type FilterType = 'all' | 'active' | 'resolved';
type SortType = 'name' | 'bed';

const PatientsPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Controls
  const [filterType, setFilterType] = useState<FilterType>('active');
  const [sortType, setSortType] = useState<SortType>('bed');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    const data = await patientService.getPatients();
    setPatients(data);
    setLoading(false);
  };

  const isResolved = (status: PatientStatus) => {
      return [
        PatientStatus.DISCHARGED, 
        PatientStatus.PARTOGRAM_OPENED,
        PatientStatus.DELIVERY,
        PatientStatus.C_SECTION
      ].includes(status);
  };

  const filteredPatients = patients
    .filter(p => {
        // Search Filter
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.bed.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Status Filter
        const resolved = isResolved(p.status);
        if (filterType === 'active') return matchesSearch && !resolved;
        if (filterType === 'resolved') return matchesSearch && resolved;
        return matchesSearch; // 'all'
    })
    .sort((a, b) => {
        // Sort Logic
        if (sortType === 'name') {
            return a.name.localeCompare(b.name);
        } else {
            // Bed sort (numeric aware)
            return a.bed.localeCompare(b.bed, undefined, { numeric: true });
        }
    });

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 sticky top-16 bg-slate-50 z-10 py-2">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Pacientes</h2>
                <p className="text-slate-500 text-sm">Gerenciamento de leitos e histórico</p>
            </div>
            <Link to="/admission" className="bg-medical-600 text-white p-2 rounded-lg shadow-sm hover:bg-medical-700 transition-colors">
                <UserPlus className="w-6 h-6" />
            </Link>
        </div>
        
        {/* Search */}
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

        {/* Toolbar: Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
            {/* Filter Group */}
            <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                <button 
                   onClick={() => setFilterType('active')}
                   className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'active' ? 'bg-medical-50 text-medical-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                   Ativos
                </button>
                <button 
                   onClick={() => setFilterType('resolved')}
                   className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'resolved' ? 'bg-medical-50 text-medical-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                   Resolvidos
                </button>
                <button 
                   onClick={() => setFilterType('all')}
                   className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'all' ? 'bg-medical-50 text-medical-700' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                   Todos
                </button>
            </div>

            {/* Sort Group */}
            <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm ml-auto">
                <button 
                   onClick={() => setSortType('bed')}
                   className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortType === 'bed' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                   title="Ordenar por Leito"
                >
                   <ArrowDown01 className="w-3 h-3" /> Leito
                </button>
                <button 
                   onClick={() => setSortType('name')}
                   className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortType === 'name' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                   title="Ordenar por Nome"
                >
                   <ArrowDownAZ className="w-3 h-3" /> Nome
                </button>
            </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-600"></div>
        </div>
      ) : (
        <section>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPatients.length > 0 ? (
                filteredPatients.map(patient => (
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
