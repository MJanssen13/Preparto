
import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus, ScheduledTask } from '../types';
import { patientService } from '../services/supabaseService';
import { Clock, CheckCircle2, BedDouble, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Flattened task for display
interface DashboardTask extends ScheduledTask {
  patientName: string;
  patientId: string;
  bed: string;
}

const SchedulePage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Filter tasks: Exclude patients who are Discharged OR Partogram Opened
  const tasks: DashboardTask[] = patients
    .filter(p => p.status !== PatientStatus.DISCHARGED && p.status !== PatientStatus.PARTOGRAM_OPENED)
    .flatMap(p => 
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
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cronograma</h2>
          <p className="text-slate-500 text-sm">Próximas aferições do plantão</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {tasks.length} pendentes
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-600"></div>
        </div>
      ) : (
        <section>
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
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-red-500 flex items-center justify-center">
                          <span className="sr-only">Atrasado</span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
               <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                 <div className="bg-green-50 p-4 rounded-full mb-3">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-700">Tudo em dia!</h3>
                 <p className="text-sm">Nenhuma aferição pendente no momento.</p>
               </div>
            )}
        </section>
      )}
    </div>
  );
};

export default SchedulePage;
