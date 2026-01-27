
import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus, ScheduledTask } from '../types';
import { patientService } from '../services/supabaseService';
import PatientCard from '../components/PatientCard';
import { Search, Clock, CheckCircle2, BedDouble, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';

// Flattened task for display
interface DashboardTask extends ScheduledTask {
  patientName: string;
  patientId: string;
  bed: string;
}

const Dashboard: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadPatients();
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    const data = await patientService.getPatients();
    setPatients(data);
    setLoading(false);
  };

  // 1. Active Patients
  const activePatients = patients.filter(p => 
    p.status !== PatientStatus.DISCHARGED &&
    p.status !== PatientStatus.PARTOGRAM_OPENED &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.bed.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 2. Resolved Patients (Last 24h or generic resolved for now)
  const resolvedPatients = patients.filter(p => 
    (p.status === PatientStatus.DISCHARGED || p.status === PatientStatus.PARTOGRAM_OPENED) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.bed.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a,b) => new Date(b.dischargeTime || 0).getTime() - new Date(a.dischargeTime || 0).getTime());

  // Flatten pending tasks from all active patients
  const tasks: DashboardTask[] = activePatients.flatMap(p => 
    (p.schedule || [])
      .filter(t => t.status === 'pending')
      .map(t => ({
        ...t,
        patientName: p.name,
        patientId: p.id,
        bed: p.bed
      }))
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const getTaskStatusColor = (isoDate: string) => {
    const due = new Date(isoDate).getTime();
    const current = now.getTime();
    const diffMins = (due - current) / 60000;

    if (diffMins < -10) return 'bg-red-50 border-red-200 text-red-900'; // Atrasado
    if (diffMins <= 15) return 'bg-amber-50 border-amber-200 text-amber-900'; // Próximo
    return 'bg-white border-slate-200 text-slate-700'; // Futuro
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Painel do Plantão</h2>
          <p className="text-slate-500 text-sm">Cronograma e visão geral</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar paciente ou leito..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
            />
          </div>
          <Link to="/admission" className="md:hidden p-2 bg-medical-600 text-white rounded-lg shadow-md hover:bg-medical-700">
             <span className="font-bold text-xl leading-none">+</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-600"></div>
        </div>
      ) : (
        <>
          {/* Timeline Section */}
          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-medical-600" />
              Cronograma de Aferições
            </h3>
            
            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map(task => (
                  <Link 
                    key={task.id} 
                    to={`/patient/${task.patientId}/add-observation?taskId=${task.id}`}
                    className={`block border p-4 rounded-xl shadow-sm relative overflow-hidden transition-transform active:scale-[0.99] ${getTaskStatusColor(task.timestamp)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold font-mono tracking-tight">
                          {new Date(task.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <span className="text-xs uppercase tracking-wide opacity-70">Horário Previsto</span>
                      </div>
                      
                      <div className="text-right">
                         <div className="flex items-center justify-end gap-1 font-bold text-lg">
                           <BedDouble className="w-4 h-4" /> Leito {task.bed}
                         </div>
                         <div className="font-medium opacity-90">{task.patientName}</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-2">
                       <span className="text-xs font-bold uppercase opacity-60">Aferir:</span>
                       <div className="flex flex-wrap gap-1">
                         {task.focus.map((focus, i) => (
                           <span key={i} className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold border border-black/5">
                             {focus}
                           </span>
                         ))}
                         {task.focus.length === 0 && 
                            <span className="text-xs italic opacity-70">Rotina Padrão</span>
                         }
                       </div>
                    </div>
                    
                    {/* Visual indicator for late items */}
                    {new Date(task.timestamp).getTime() < now.getTime() && (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-red-500"></div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
               <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 flex flex-col items-center">
                 <CheckCircle2 className="w-8 h-8 mb-2 text-green-500" />
                 <p>Nenhuma aferição pendente.</p>
               </div>
            )}
          </section>

          {/* Active Patients Grid */}
          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-slate-600" />
              Pacientes no Leito
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePatients.length > 0 ? (
                activePatients.map(patient => (
                  <PatientCard key={patient.id} patient={patient} />
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                  Nenhum paciente ativo.
                </div>
              )}
            </div>
          </section>

          {/* Recently Resolved Section */}
          {resolvedPatients.length > 0 && (
             <section className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase">
                  <Archive className="w-4 h-4" /> Resolvidos Recentemente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
                  {resolvedPatients.slice(0, 6).map(patient => (
                    <PatientCard key={patient.id} patient={patient} />
                  ))}
                </div>
             </section>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
