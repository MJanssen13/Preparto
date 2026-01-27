
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { Patient, PatientStatus, ScheduledTask } from '../types';
import { ArrowLeft, Pill, Beaker, Save, Trash2, AlertTriangle, Lock, CalendarClock, Plus, X, Power, Check, StopCircle, Baby } from 'lucide-react';

// Added 'Dinâmica'
const PARAM_OPTIONS = ['BCF', 'Dinâmica', 'PA', 'FC', 'Medicação', 'Toque', 'Reflexo', 'Diurese', 'FR', 'Sat', 'TAX', 'DXT'];

const EditPatient: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientStatus, setPatientStatus] = useState<PatientStatus | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    babyName: '',
    bed: '',
    riskFactors: '',
    
    // Protocols
    useMethyldopa: false,
    methyldopaStartTime: '' as string | undefined,
    methyldopaEndTime: '' as string | undefined,
    
    useMagnesiumSulfate: false,
    magnesiumSulfateStartTime: '' as string | undefined,
    magnesiumSulfateEndTime: '' as string | undefined,
  });

  const [schedule, setSchedule] = useState<ScheduledTask[]>([]);

  useEffect(() => {
    if (id) {
        patientService.getPatientById(id).then(p => {
            if (p) {
                setPatientStatus(p.status);
                setFormData({
                    name: p.name,
                    babyName: p.babyName || '',
                    bed: p.bed,
                    riskFactors: p.riskFactors ? p.riskFactors.join(', ') : '',
                    
                    useMethyldopa: p.useMethyldopa || false,
                    methyldopaStartTime: p.methyldopaStartTime,
                    methyldopaEndTime: p.methyldopaEndTime,

                    useMagnesiumSulfate: p.useMagnesiumSulfate || false,
                    magnesiumSulfateStartTime: p.magnesiumSulfateStartTime,
                    magnesiumSulfateEndTime: p.magnesiumSulfateEndTime
                });
                // Load schedule, ensure dates are valid
                setSchedule(p.schedule || []);
            }
            setLoading(false);
        });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);

    try {
      await patientService.updatePatient(id, {
        name: formData.name,
        babyName: formData.babyName,
        bed: formData.bed,
        riskFactors: formData.riskFactors ? formData.riskFactors.split(',').map(s => s.trim()) : [],
        
        useMethyldopa: formData.useMethyldopa,
        methyldopaStartTime: formData.methyldopaStartTime,
        methyldopaEndTime: formData.methyldopaEndTime,

        useMagnesiumSulfate: formData.useMagnesiumSulfate,
        magnesiumSulfateStartTime: formData.magnesiumSulfateStartTime,
        magnesiumSulfateEndTime: formData.magnesiumSulfateEndTime,

        schedule: schedule // Save the updated schedule
      });
      navigate(`/patient/${id}`);
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
      if (!id) return;
      if (confirm('ATENÇÃO: Tem certeza que deseja excluir permanentemente este paciente e todo o histórico de evoluções? Esta ação não pode ser desfeita.')) {
          setIsSubmitting(true);
          try {
              await patientService.deletePatient(id);
              navigate('/');
          } catch (error) {
              console.error(error);
              alert('Erro ao excluir paciente.');
              setIsSubmitting(false);
          }
      }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  // --- PROTOCOL MANAGEMENT LOGIC ---
  const handleToggleProtocol = (type: 'methyldopa' | 'magnesium') => {
      const now = new Date().toISOString();
      const isMg = type === 'magnesium';
      
      setFormData(prev => {
          const isActive = isMg ? prev.useMagnesiumSulfate : prev.useMethyldopa;
          
          if (isActive) {
              // STOP PROTOCOL
              if (confirm(`Deseja realmente ENCERRAR o protocolo de ${isMg ? 'Sulfato' : 'Metildopa'}? Os parâmetros específicos serão removidos dos agendamentos futuros.`)) {
                  // Clean up schedule
                  if (isMg) {
                      setSchedule(currentSchedule => currentSchedule.map(task => {
                          if (task.status === 'pending') {
                              // Remove Mg specific params from future tasks
                              return {
                                  ...task,
                                  focus: task.focus.filter(f => !['Reflexo', 'Diurese', 'FR'].includes(f))
                              };
                          }
                          return task;
                      }));
                  }
                  
                  return {
                      ...prev,
                      [isMg ? 'useMagnesiumSulfate' : 'useMethyldopa']: false,
                      [isMg ? 'magnesiumSulfateEndTime' : 'methyldopaEndTime']: now
                  };
              }
              return prev;
          } else {
              // START PROTOCOL
              // For Mg, helpful to auto-add params to next 24h of pending tasks
              if (isMg) {
                 setSchedule(currentSchedule => {
                     const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).getTime();
                     return currentSchedule.map(task => {
                         const taskTime = new Date(task.timestamp).getTime();
                         if (task.status === 'pending' && taskTime <= cutoff) {
                             const newFocus = Array.from(new Set([...task.focus, 'Reflexo', 'Diurese', 'FR']));
                             return { ...task, focus: newFocus };
                         }
                         return task;
                     });
                 });
              }

              return {
                  ...prev,
                  [isMg ? 'useMagnesiumSulfate' : 'useMethyldopa']: true,
                  [isMg ? 'magnesiumSulfateStartTime' : 'methyldopaStartTime']: now,
                  [isMg ? 'magnesiumSulfateEndTime' : 'methyldopaEndTime']: undefined // Reset end time
              };
          }
      });
  };


  // --- SCHEDULE LOGIC ---

  const handleToggleTaskParam = (taskId: string, param: string) => {
      setSchedule(prev => prev.map(task => {
          if (task.id !== taskId) return task;
          
          const hasParam = task.focus.includes(param);
          const newFocus = hasParam 
            ? task.focus.filter(p => p !== param) 
            : [...task.focus, param];
          
          return { ...task, focus: newFocus };
      }));
  };

  const handleRemoveTask = (taskId: string) => {
      if (confirm('Remover este horário do cronograma?')) {
          setSchedule(prev => prev.filter(t => t.id !== taskId));
      }
  };

  const handleAddMoreTime = () => {
      setSchedule(prev => {
          // Find last task time or use now
          let startTime = new Date();
          if (prev.length > 0) {
              // Get the very last task regardless of status
              const sorted = [...prev].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              startTime = new Date(sorted[sorted.length - 1].timestamp);
              // Add 15 mins to start
              startTime = new Date(startTime.getTime() + 15 * 60000);
          } else {
              // Round up to next 15 min
              const coeff = 1000 * 60 * 15;
              startTime = new Date(Math.ceil(startTime.getTime() / coeff) * coeff);
          }

          const newTasks: ScheduledTask[] = [];
          // Add 48 slots (12 hours * 4 slots/hour)
          for (let i = 0; i < 48; i++) {
              const time = new Date(startTime.getTime() + i * 15 * 60000);
              newTasks.push({
                  id: crypto.randomUUID(),
                  timestamp: time.toISOString(),
                  focus: [], // Empty by default
                  status: 'pending'
              });
          }
          
          return [...prev, ...newTasks];
      });
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  const isResolved = patientStatus === PatientStatus.DISCHARGED || patientStatus === PatientStatus.PARTOGRAM_OPENED;

  // Filter tasks for display (sort by time)
  // We generally only want to edit PENDING tasks
  const pendingTasks = schedule
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Editar Paciente</h1>
      </div>
      
      {isResolved && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                  <h3 className="font-bold text-amber-800 text-sm">Paciente Resolvido</h3>
                  <p className="text-xs text-amber-700">As edições são permitidas, mas este paciente não aparece mais na lista ativa. Você pode excluí-lo abaixo.</p>
              </div>
          </div>
      )}

      <div className="space-y-6">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
            
            {/* Bed Number */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Número do Leito</label>
              <input
                required
                name="bed"
                type="text"
                className="w-full p-4 border border-slate-300 rounded-lg text-2xl font-bold text-medical-600 bg-white focus:ring-2 focus:ring-medical-500 focus:outline-none"
                value={formData.bed}
                onChange={handleChange}
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input
                required
                name="name"
                type="text"
                className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            {/* Baby Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Baby className="w-4 h-4" /> Nome do Bebê (Opcional)
              </label>
              <input
                name="babyName"
                type="text"
                className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none"
                value={formData.babyName}
                onChange={handleChange}
              />
            </div>

            {/* Risk Factors */}
            <div>
                <label className="block text-xs text-slate-500 mb-1">Comorbidades / Fatores de Risco</label>
                <textarea 
                  name="riskFactors" 
                  placeholder="Ex: HAS, Diabetes, etc..." 
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none h-24 bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" 
                  value={formData.riskFactors} 
                  onChange={handleChange} 
                />
            </div>

            {/* Protocols Management */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-800">Gerenciar Protocolos</h3>
                
                {/* Methyldopa Card */}
                <div className={`p-4 rounded-xl border transition-all ${formData.useMethyldopa ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2">
                           <Pill className={`w-5 h-5 ${formData.useMethyldopa ? 'text-blue-600' : 'text-slate-400'}`} />
                           <span className={`font-bold text-sm ${formData.useMethyldopa ? 'text-blue-900' : 'text-slate-600'}`}>Metildopa</span>
                       </div>
                       <button
                         type="button"
                         onClick={() => handleToggleProtocol('methyldopa')}
                         className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors ${
                             formData.useMethyldopa 
                             ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                             : 'bg-blue-600 text-white hover:bg-blue-700'
                         }`}
                       >
                           {formData.useMethyldopa ? <><StopCircle className="w-3 h-3" /> Encerrar</> : <><Power className="w-3 h-3" /> Iniciar</>}
                       </button>
                   </div>
                   <div className="text-[10px] text-slate-500">
                       {formData.useMethyldopa ? (
                           <span>Iniciado em: {new Date(formData.methyldopaStartTime!).toLocaleString()}</span>
                       ) : formData.methyldopaEndTime ? (
                           <span>Encerrado em: {new Date(formData.methyldopaEndTime).toLocaleString()}</span>
                       ) : (
                           <span>Protocolo inativo.</span>
                       )}
                   </div>
                </div>

                {/* Magnesium Card */}
                <div className={`p-4 rounded-xl border transition-all ${formData.useMagnesiumSulfate ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                   <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2">
                           <Beaker className={`w-5 h-5 ${formData.useMagnesiumSulfate ? 'text-purple-600' : 'text-slate-400'}`} />
                           <span className={`font-bold text-sm ${formData.useMagnesiumSulfate ? 'text-purple-900' : 'text-slate-600'}`}>Sulfato de Magnésio</span>
                       </div>
                       <button
                         type="button"
                         onClick={() => handleToggleProtocol('magnesium')}
                         className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors ${
                             formData.useMagnesiumSulfate 
                             ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                             : 'bg-purple-600 text-white hover:bg-purple-700'
                         }`}
                       >
                           {formData.useMagnesiumSulfate ? <><StopCircle className="w-3 h-3" /> Encerrar</> : <><Power className="w-3 h-3" /> Iniciar</>}
                       </button>
                   </div>
                   <div className="text-[10px] text-slate-500">
                       {formData.useMagnesiumSulfate ? (
                           <p>Iniciado em: {new Date(formData.magnesiumSulfateStartTime!).toLocaleString()}</p>
                       ) : formData.magnesiumSulfateEndTime ? (
                           <p>Encerrado em: {new Date(formData.magnesiumSulfateEndTime).toLocaleString()}</p>
                       ) : (
                           <p>Protocolo inativo.</p>
                       )}
                   </div>
                   {formData.useMagnesiumSulfate && (
                       <p className="text-[10px] text-purple-600 mt-2 bg-white/50 p-1 rounded">
                           *Encerrar o protocolo removerá automaticamente Reflexo, Diurese e FR dos agendamentos futuros.
                       </p>
                   )}
                </div>
            </div>

            {/* SCHEDULE EDITOR */}
            <div className="pt-4 border-t border-slate-200">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-medical-600" />
                      Editar Cronograma Futuro
                  </h3>
               </div>

               <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-96 overflow-y-auto custom-scrollbar">
                   {pendingTasks.length === 0 ? (
                       <div className="p-8 text-center text-slate-400 text-xs">
                           Sem tarefas pendentes no futuro.
                       </div>
                   ) : (
                       pendingTasks.map((task) => {
                           const hasSelection = task.focus.length > 0;
                           return (
                               <div key={task.id} className={`grid grid-cols-[60px_1fr_30px] border-b border-slate-100 last:border-0 ${hasSelection ? 'bg-blue-50/20' : 'bg-white'}`}>
                                   <div className={`p-3 flex items-center justify-center text-xs font-bold border-r border-slate-100 ${hasSelection ? 'text-blue-600' : 'text-slate-400'}`}>
                                       {new Date(task.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                   </div>
                                   <div className="p-2 flex flex-wrap gap-1 items-center">
                                       {PARAM_OPTIONS.map(param => {
                                           const isActive = task.focus.includes(param);
                                           const isMgParam = ['Reflexo', 'Diurese', 'FR'].includes(param);
                                           return (
                                               <button
                                                   key={param}
                                                   type="button"
                                                   onClick={() => handleToggleTaskParam(task.id, param)}
                                                   className={`
                                                     h-6 px-1.5 rounded text-[9px] font-bold border transition-all select-none
                                                     ${isActive 
                                                         ? (isMgParam ? 'bg-purple-500 text-white border-purple-600' : 'bg-medical-500 text-white border-medical-600')
                                                         : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}
                                                   `}
                                               >
                                                   {param}
                                               </button>
                                           )
                                       })}
                                   </div>
                                   <div className="flex items-center justify-center">
                                       <button 
                                          type="button"
                                          onClick={() => handleRemoveTask(task.id)}
                                          className="text-slate-300 hover:text-red-500 p-1"
                                       >
                                           <X className="w-4 h-4" />
                                       </button>
                                   </div>
                               </div>
                           );
                       })
                   )}
                   
                   {/* Add More Button */}
                   <div className="p-3 bg-slate-50 flex justify-center border-t border-slate-200 sticky bottom-0">
                        <button 
                            type="button" 
                            onClick={handleAddMoreTime}
                            className="text-xs font-bold text-medical-600 flex items-center gap-1 hover:text-medical-700 bg-white px-4 py-2 rounded-full border border-medical-100 shadow-sm"
                        >
                            <Plus className="w-3 h-3" />
                            Adicionar +12h ao final
                        </button>
                    </div>
               </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-medical-600 text-white font-bold py-4 rounded-xl shadow hover:bg-medical-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Salvando...' : <><Save className="w-5 h-5" /> Salvar Alterações</>}
            </button>
          </form>

          {/* Delete Zone */}
          <div className="bg-red-50 p-6 rounded-xl border border-red-100">
              <h3 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" /> Zona de Perigo
              </h3>
              <p className="text-xs text-red-600 mb-4">
                  Excluir o paciente removerá permanentemente todos os dados, incluindo histórico de aferições e gráficos.
              </p>
              <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="w-full bg-white border border-red-200 text-red-600 font-bold py-3 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                  <Trash2 className="w-4 h-4" />
                  Excluir Paciente
              </button>
          </div>
      </div>
    </div>
  );
};

export default EditPatient;
