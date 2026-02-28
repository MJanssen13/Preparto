import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { Patient, ScheduledTask } from '../types';
import { ArrowLeft, CalendarClock, Settings2, Trash2, Check, Zap, Plus, AlertCircle } from 'lucide-react';

const PARAM_OPTIONS = ['BCF', 'Dinâmica', 'PA', 'FC', 'Medicação', 'Toque', 'Reflexo', 'Diurese', 'FR', 'Sat', 'TAX', 'DXT'];

interface TimeSlot {
  time: Date;
  selectedParams: string[];
}

const NewSchedulePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Schedule Grid State
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  
  // Dynamic Preset State
  const [presetParam, setPresetParam] = useState<string>('BCF');
  const [presetInterval, setPresetInterval] = useState<number>(60);
  
  // Option to clear existing future schedule
  const [clearFuture, setClearFuture] = useState(true);

  useEffect(() => {
    if (id) {
        loadPatient(id);
        generateInitialSlots();
    }
  }, [id]);

  const loadPatient = async (patientId: string) => {
    setLoading(true);
    const p = await patientService.getPatientById(patientId);
    if (p) {
        setPatient(p);
    }
    setLoading(false);
  };

  const generateInitialSlots = () => {
    const now = new Date();
    const start = new Date(now);
    start.setSeconds(0, 0);

    // 1. Snap to next hour or half-hour
    const minutes = start.getMinutes();
    if (minutes < 30) {
      start.setMinutes(30);
    } else {
      start.setMinutes(0);
      start.setHours(start.getHours() + 1);
    }

    // 2. Determine Shift End (07:00 or 19:00)
    const currentHour = start.getHours();
    let endTime = new Date(start);
    endTime.setMinutes(0, 0, 0);

    if (currentHour >= 7 && currentHour < 19) {
      // Day Shift -> End at 19:00 today
      endTime.setHours(19);
    } else {
      // Night Shift -> End at 07:00 next day (or today if currently early morning)
      if (currentHour >= 19) {
         endTime.setDate(endTime.getDate() + 1);
         endTime.setHours(7);
      } else {
         endTime.setHours(7);
      }
    }

    // 3. Generate slots from start to endTime in 15min increments
    const slots: TimeSlot[] = [];
    let current = new Date(start);

    // Safety limit
    const maxSafety = new Date(start.getTime() + 24 * 60 * 60000);

    while (current <= endTime && current < maxSafety) {
       slots.push({
         time: new Date(current),
         selectedParams: []
       });
       // Add 15 minutes
       current = new Date(current.getTime() + 15 * 60000);
    }

    setTimeSlots(slots);
  };

  const loadMoreSlots = () => {
    if (timeSlots.length >= 288) return;

    const lastSlot = timeSlots[timeSlots.length - 1];
    const startNext = new Date(lastSlot.time.getTime() + 15 * 60000);
    
    const newSlots: TimeSlot[] = [];
    // Add 12 hours (48 slots)
    for (let i = 0; i < 48; i++) {
        const slotTime = new Date(startNext.getTime() + i * 15 * 60000);
        newSlots.push({
            time: slotTime,
            selectedParams: []
        });
    }
    
    setTimeSlots(prev => [...prev, ...newSlots]);
  };

  const toggleParam = (index: number, param: string) => {
    setTimeSlots(prev => prev.map((slot, i) => {
      if (i !== index) return slot;
      const isSelected = slot.selectedParams.includes(param);
      return {
        ...slot,
        selectedParams: isSelected
          ? slot.selectedParams.filter(p => p !== param)
          : [...slot.selectedParams, param]
      };
    }));
  };

  const applyPreset = (intervalMin: number, paramsToSet: string[]) => {
    const steps = intervalMin / 15;
    setTimeSlots(prev => prev.map((slot, i) => {
      if (i % steps === 0) {
        const newParams = Array.from(new Set([...slot.selectedParams, ...paramsToSet]));
        return { ...slot, selectedParams: newParams };
      }
      return slot;
    }));
  };

  const handleApplyDynamicPreset = () => {
      applyPreset(Number(presetInterval), [presetParam]);
  };

  const handleClearSchedule = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o cronograma desta tela?')) {
        setTimeSlots(prev => prev.map(slot => ({
            ...slot,
            selectedParams: []
        })));
    }
  };

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSave = async () => {
    if (!patient || !id) return;
    setIsSubmitting(true);
    
    try {
        // 1. Convert active slots to ScheduledTasks
        const newTasks: ScheduledTask[] = timeSlots
          .filter(slot => slot.selectedParams.length > 0)
          .map(slot => ({
            id: generateUUID(),
            timestamp: slot.time.toISOString(),
            focus: slot.selectedParams,
            status: 'pending'
          }));

        if (newTasks.length === 0) {
            alert('Nenhuma tarefa agendada. Selecione parâmetros nos horários desejados.');
            setIsSubmitting(false);
            return;
        }

        // 2. Merge with existing schedule
        let updatedSchedule = [...(patient.schedule || [])];

        if (clearFuture) {
            // Remove pending tasks that are in the future relative to now
            // Or maybe remove ALL pending tasks? Usually "New Routine" implies replacing the old plan.
            // Let's keep completed tasks, and remove pending tasks that are after the start of our new routine.
            const newStart = timeSlots[0].time;
            updatedSchedule = updatedSchedule.filter(t => {
                if (t.status !== 'pending') return true; // Keep completed/cancelled
                // If pending task is before our new routine start, keep it (it's overdue or immediate)
                // If it's after, remove it to be replaced by new routine
                return new Date(t.timestamp) < newStart;
            });
        }

        updatedSchedule = [...updatedSchedule, ...newTasks];

        // 3. Save
        await patientService.updatePatient(id, { schedule: updatedSchedule });
        
        navigate(`/patient/${id}`);

    } catch (error: any) {
      console.error('Error saving schedule:', error);
      alert(`Erro ao salvar rotina: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
  if (!patient) return <div className="p-8 text-center text-red-500">Paciente não encontrado</div>;

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
            <h1 className="text-xl font-bold text-slate-900">Nova Rotina de Aferições</h1>
            <p className="text-xs text-slate-500">{patient.name} - Leito {patient.bed}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-6">
        
        {/* Option to clear future */}
        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
                <label className="flex items-center gap-2 font-bold text-sm text-amber-900 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={clearFuture} 
                        onChange={(e) => setClearFuture(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                    />
                    Substituir rotina futura existente
                </label>
                <p className="text-xs text-amber-700 mt-1">
                    Se marcado, removerá agendamentos pendentes a partir de {timeSlots[0]?.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.
                </p>
            </div>
        </div>

        {/* Generator Controls */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
           <div className="flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Gerador Rápido</h4>
           </div>

           <div className="flex flex-col gap-4">
              {/* Step 1: Select Param */}
              <div>
                  <span className="text-[10px] font-bold text-slate-400 mb-2 block">1. SELECIONE O PARÂMETRO:</span>
                  <div className="flex flex-wrap gap-2">
                      {PARAM_OPTIONS.map(param => (
                          <button
                              key={param}
                              type="button"
                              onClick={() => setPresetParam(param)}
                              className={`
                                  px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                                  ${presetParam === param 
                                      ? 'bg-slate-800 text-white border-slate-900 shadow-md transform scale-105' 
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}
                              `}
                          >
                              {param}
                          </button>
                      ))}
                  </div>
              </div>

              {/* Step 2: Frequency & Apply */}
              <div className="flex items-end gap-2">
                  <div className="flex-1">
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">2. FREQUÊNCIA:</span>
                      <div className="relative">
                        <select 
                            value={presetInterval}
                            onChange={(e) => setPresetInterval(Number(e.target.value))}
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-medical-500 focus:outline-none"
                        >
                            <option value="15">A cada 15 min</option>
                            <option value="30">A cada 30 min</option>
                            <option value="60">A cada 1 hora</option>
                            <option value="120">A cada 2 horas</option>
                            <option value="180">A cada 3 horas</option>
                            <option value="240">A cada 4 horas</option>
                            <option value="360">A cada 6 horas</option>
                            <option value="720">A cada 12 horas</option>
                        </select>
                        <Zap className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                      </div>
                  </div>
                  
                  <button 
                      type="button" 
                      onClick={handleClearSchedule}
                      title="Limpar Seleção"
                      className="bg-white border border-red-200 text-red-500 px-3 py-2.5 rounded-lg font-bold shadow-sm hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center focus:ring-2 focus:ring-red-500 focus:outline-none"
                  >
                      <Trash2 className="w-5 h-5" />
                  </button>

                  <button 
                      type="button" 
                      onClick={handleApplyDynamicPreset}
                      className="bg-medical-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-sm hover:bg-medical-700 active:scale-95 transition-all flex items-center gap-2 focus:ring-2 focus:ring-medical-500 focus:outline-none"
                  >
                      <Check className="w-4 h-4" /> Aplicar
                  </button>
              </div>
           </div>
        </div>

        {/* The "Sheet" Grid */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
            <div className="grid grid-cols-[60px_1fr] bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-500 sticky top-0 z-10 shadow-sm">
               <div className="p-3 text-center border-r border-slate-200 bg-slate-100">Hora</div>
               <div className="p-3 text-center bg-slate-100">O que aferir?</div>
            </div>

            {timeSlots.map((slot, index) => {
              const hasSelection = slot.selectedParams.length > 0;
              return (
                <div key={index} className={`grid grid-cols-[60px_1fr] border-b border-slate-100 last:border-0 transition-colors ${hasSelection ? 'bg-blue-50/30' : 'bg-white'}`}>
                   <div className={`p-3 flex items-center justify-center text-xs font-bold border-r border-slate-100 ${hasSelection ? 'text-blue-600' : 'text-slate-400'}`}>
                      {slot.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </div>
                   
                   <div className="p-2 grid grid-cols-5 gap-1">
                      {PARAM_OPTIONS.map(param => {
                         const isActive = slot.selectedParams.includes(param);
                         const isMgParam = ['Reflexo', 'Diurese', 'FR'].includes(param);
                         return (
                           <button
                             key={param}
                             type="button"
                             onClick={() => toggleParam(index, param)}
                             className={`
                               h-8 px-1 rounded-md text-[10px] font-bold border transition-all select-none flex items-center justify-center whitespace-nowrap
                               ${isActive 
                                 ? (isMgParam ? 'bg-purple-500 text-white border-purple-600' : 'bg-medical-500 text-white border-medical-600 shadow-sm')
                                 : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}
                             `}
                           >
                             {param}
                           </button>
                         );
                      })}
                   </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {timeSlots.length < 288 && (
                <div className="p-3 bg-slate-50 flex justify-center border-t border-slate-200">
                    <button 
                        type="button" 
                        onClick={loadMoreSlots}
                        className="text-xs font-bold text-medical-600 flex items-center gap-1 hover:text-medical-700 bg-white px-4 py-2 rounded-full border border-medical-100 shadow-sm"
                    >
                        <Plus className="w-3 h-3" />
                        Carregar +12h
                    </button>
                </div>
            )}
        </div>
        
        <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="w-full bg-medical-600 text-white font-bold py-4 rounded-xl shadow hover:bg-medical-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CalendarClock className="w-5 h-5" />
              {isSubmitting ? 'Salvando...' : 'Salvar Nova Rotina'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default NewSchedulePage;
