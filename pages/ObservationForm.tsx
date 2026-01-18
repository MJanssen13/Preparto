import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { MembraneStatus, Patient, ScheduledTask } from '../types';
import { ArrowLeft, Save, Clock, Trash2, Plus, AlertCircle, X, SlidersHorizontal, ArrowDownUp, CircleDot, Activity, Play, Square, Timer, RotateCcw, Hammer, Droplets, Wind, Waves, Calculator } from 'lucide-react';

// Possible parameters for "Quick Add"
const ALL_PARAMS = [
  { id: 'BCF', label: 'BCF', section: 'obstetric' },
  { id: 'Dinâmica', label: 'Dinâmica', section: 'obstetric' },
  { id: 'Toque', label: 'Toque', section: 'obstetric' },
  { id: 'PA', label: 'Pressão Arterial', section: 'vitals' },
  { id: 'TAX', label: 'Temperatura', section: 'vitals' },
  { id: 'Sat', label: 'Saturação', section: 'vitals' },
  { id: 'Meds', label: 'Medicação', section: 'meds' },
  // Magnesium Protocol Items
  { id: 'Reflexo', label: 'Reflexo', section: 'mag' },
  { id: 'Diurese', label: 'Diurese', section: 'mag' },
  { id: 'FR', label: 'Freq. Resp.', section: 'mag' }
];

const ObservationForm: React.FC = () => {
  const navigate = useNavigate();
  const { id, obsId } = useParams<{ id: string; obsId?: string }>();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeParams, setActiveParams] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    bcf: '',
    // Dinamica gets updated by the timer component
    dinamicaFreq: '',
    dinamicaSummary: '', 
    
    // Toque Fields
    dilation: '',
    effacement: '', // %
    station: '', // De Lee
    cervixPosition: '', // Posterior, Intermediário, Central
    cervixConsistency: '', // Nasal, Nasolabial, Labial
    membranes: MembraneStatus.INTACT,

    // Sitting / Standard
    paSys: '',
    paDia: '',
    // Standing (for Methyldopa)
    paSysStanding: '',
    paDiaStanding: '',
    
    tax: '',
    spo2: '',
    miso: '',
    oxy: '',
    
    // Magnesium Protocol
    magReflex: 'Presente',
    magDiuresis: '',
    magRespiratoryRate: '',

    notes: ''
  });

  // --- BISHOP SCORE CALCULATION ---
  const calculateBishopScore = () => {
    let score = 0;
    let filledFields = 0;
    const totalFields = 5;

    // 1. Dilation
    if (formData.dilation !== '') {
        const d = Number(formData.dilation);
        if (d >= 5) score += 3;
        else if (d >= 3) score += 2;
        else if (d >= 1) score += 1;
        else score += 0;
        filledFields++;
    }

    // 2. Effacement (%)
    if (formData.effacement !== '') {
        const e = Number(formData.effacement);
        if (e >= 80) score += 3;
        else if (e >= 60) score += 2;
        else if (e >= 40) score += 1;
        else score += 0;
        filledFields++;
    }

    // 3. Station (De Lee)
    if (formData.station !== '') {
        const s = Number(formData.station);
        if (s >= 0) score += 3; // "0 ou abaixo" (+1, +2...)
        else if (s === -1) score += 2;
        else if (s === -2) score += 1;
        else score += 0; // -3
        filledFields++;
    }

    // 4. Consistency (Nasal=Firme, Nasolabial=Médio, Labial=Amolecido)
    if (formData.cervixConsistency) {
        if (formData.cervixConsistency === 'Labial') score += 2;
        else if (formData.cervixConsistency === 'Nasolabial') score += 1;
        else score += 0; // Nasal
        filledFields++;
    }

    // 5. Position
    if (formData.cervixPosition) {
        if (formData.cervixPosition === 'Central') score += 2;
        else if (formData.cervixPosition === 'Intermediário') score += 1;
        else score += 0; // Posterior
        filledFields++;
    }

    return { score, filledFields, totalFields };
  };

  const bishopData = calculateBishopScore();

  // --- DYNAMICS TIMER LOGIC ---
  const [timerState, setTimerState] = useState({
      isRunning: false,
      mainTimerMs: 0, // Track precise milliseconds
      isContractionActive: false,
      currentContractionStart: 0, // timestamp
      currentContractionDuration: 0, // live counter for current contraction
      recordedContractions: [] as number[] // durations in seconds
  });
  
  const lastTickRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
      if (timerState.isRunning) {
          lastTickRef.current = Date.now();
          
          intervalRef.current = window.setInterval(() => {
              const now = Date.now();
              const delta = now - lastTickRef.current;
              lastTickRef.current = now;

              setTimerState(prev => {
                  const newMainTimerMs = prev.mainTimerMs + delta;
                  
                  if (newMainTimerMs >= 600000) { // 10 mins in ms
                      clearInterval(intervalRef.current!);
                      return { 
                          ...prev, 
                          isRunning: false, 
                          isContractionActive: false, 
                          currentContractionDuration: 0,
                          mainTimerMs: 600000 
                      };
                  }
                  
                  // Calculate live duration if active
                  let liveDuration = 0;
                  if (prev.isContractionActive) {
                      // High precision calculation
                      liveDuration = Math.floor((now - prev.currentContractionStart) / 1000);
                  }

                  return { 
                      ...prev, 
                      mainTimerMs: newMainTimerMs,
                      currentContractionDuration: liveDuration
                  };
              });
          }, 50); // 50ms update rate for immediate feedback
      } else {
          if (intervalRef.current) clearInterval(intervalRef.current);
      }
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState.isRunning]);

  const elapsedTotalSeconds = Math.floor(timerState.mainTimerMs / 1000);

  const toggleMainTimer = () => {
      setTimerState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const toggleContraction = () => {
      setTimerState(prev => {
          if (!prev.isRunning) return prev; // Safety check

          if (prev.isContractionActive) {
              // Stop contraction
              const duration = Math.floor((Date.now() - prev.currentContractionStart) / 1000);
              const newContractions = [...prev.recordedContractions, duration];
              updateDinamicaForm(newContractions);
              return {
                  ...prev,
                  isContractionActive: false,
                  currentContractionDuration: 0,
                  recordedContractions: newContractions
              };
          } else {
              // Start contraction
              return {
                  ...prev,
                  isContractionActive: true,
                  currentContractionStart: Date.now(),
                  currentContractionDuration: 0
              };
          }
      });
  };

  const resetTimer = () => {
      setTimerState({
          isRunning: false,
          mainTimerMs: 0,
          isContractionActive: false,
          currentContractionStart: 0,
          currentContractionDuration: 0,
          recordedContractions: []
      });
      setFormData(prev => ({ ...prev, dinamicaFreq: '', dinamicaSummary: '' }));
  };

  const updateDinamicaForm = (contractions: number[]) => {
      // Logic to format: "2x30"; 1x45" em 10'"
      const groups: Record<number, number> = {};
      contractions.forEach(d => {
          if (d > 0) {
              groups[d] = (groups[d] || 0) + 1;
          }
      });

      const parts = Object.entries(groups)
          .sort((a,b) => Number(b[0]) - Number(a[0])) // sort by duration desc
          .map(([duration, count]) => `${count}x${duration}"`);
      
      const summary = parts.length > 0 ? `${parts.join('; ')} em 10'` : '';

      setFormData(prev => ({
          ...prev,
          dinamicaFreq: String(contractions.length),
          dinamicaSummary: summary
      }));
  };

  // -----------------------------

  // Local state for editing the schedule
  const [schedule, setSchedule] = useState<ScheduledTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
        if (!id) return;
        
        const p = await patientService.getPatientById(id);
        if (p) {
            setPatient(p);
            setSchedule(p.schedule || []);

            // Check if we are in EDIT mode (obsId exists)
            if (obsId) {
               const obs = await patientService.getObservationById(obsId);
               if (obs) {
                   // Populate Form Data from Existing Observation
                   const paramsToActivate: string[] = [];
                   
                   setFormData({
                       bcf: obs.obstetric.bcf !== undefined ? String(obs.obstetric.bcf) : '',
                       dinamicaFreq: obs.obstetric.dinamicaFrequency !== undefined ? String(obs.obstetric.dinamicaFrequency) : '',
                       dinamicaSummary: obs.obstetric.dinamicaSummary || '',
                       
                       dilation: obs.obstetric.dilation !== undefined ? String(obs.obstetric.dilation) : '',
                       effacement: obs.obstetric.effacement !== undefined ? String(obs.obstetric.effacement) : '',
                       station: obs.obstetric.station !== undefined ? String(obs.obstetric.station) : '',
                       cervixPosition: obs.obstetric.cervixPosition || '',
                       cervixConsistency: obs.obstetric.cervixConsistency || '',
                       membranes: obs.obstetric.membranes || MembraneStatus.INTACT,

                       paSys: obs.vitals.paSystolic !== undefined ? String(obs.vitals.paSystolic) : '',
                       paDia: obs.vitals.paDiastolic !== undefined ? String(obs.vitals.paDiastolic) : '',
                       paSysStanding: obs.vitals.paStandingSystolic ? String(obs.vitals.paStandingSystolic) : '',
                       paDiaStanding: obs.vitals.paStandingDiastolic ? String(obs.vitals.paStandingDiastolic) : '',
                       
                       tax: obs.vitals.tax !== undefined ? String(obs.vitals.tax) : '',
                       spo2: obs.vitals.spo2 ? String(obs.vitals.spo2) : '',
                       
                       miso: obs.medication?.misoprostolDose ? String(obs.medication.misoprostolDose) : '',
                       oxy: obs.medication?.oxytocinDose ? String(obs.medication.oxytocinDose) : '',

                       magReflex: obs.magnesiumData?.reflex || 'Presente',
                       magDiuresis: obs.magnesiumData?.diuresis || '',
                       magRespiratoryRate: obs.magnesiumData?.respiratoryRate ? String(obs.magnesiumData.respiratoryRate) : '',

                       notes: obs.notes || ''
                   });

                   // Determine active params based on data presence
                   if (obs.obstetric.bcf !== undefined) paramsToActivate.push('BCF');
                   if (obs.obstetric.dinamicaFrequency !== undefined || obs.obstetric.dinamicaSummary) paramsToActivate.push('Dinâmica');
                   if (obs.obstetric.dilation !== undefined || obs.obstetric.effacement !== undefined) paramsToActivate.push('Toque');
                   if (obs.vitals.paSystolic !== undefined) paramsToActivate.push('PA');
                   if (obs.vitals.tax !== undefined) paramsToActivate.push('TAX');
                   if (obs.vitals.spo2) paramsToActivate.push('Sat');
                   if (obs.medication?.misoprostolDose || obs.medication?.oxytocinDose) paramsToActivate.push('Meds');
                   
                   // Mag params
                   if (obs.magnesiumData) {
                       paramsToActivate.push('Reflexo', 'Diurese', 'FR');
                   }

                   setActiveParams(paramsToActivate);
               }
            } else {
                // CREATE MODE: Logic to determine visible parameters
                if (taskId) {
                    const task = p.schedule.find(t => t.id === taskId);
                    if (task) {
                        setActiveParams(task.focus);
                    } else {
                        setActiveParams(ALL_PARAMS.map(p => p.id));
                    }
                } else {
                    setActiveParams(ALL_PARAMS.map(p => p.id));
                }
            }
        }
    };
    fetchData();
  }, [id, taskId, obsId]);

  const toggleActiveParam = (paramId: string) => {
    setActiveParams(prev => 
      prev.includes(paramId) ? prev.filter(p => p !== paramId) : [...prev, paramId]
    );
  };

  const addTask = () => {
      const now = new Date();
      let nextTime = new Date(now.getTime() + 30*60000);
      if (schedule.length > 0) {
          const last = new Date(schedule[schedule.length-1].timestamp);
          if (last > now) nextTime = new Date(last.getTime() + 30*60000);
      }
      
      setSchedule(prev => [...prev, {
          id: crypto.randomUUID(),
          timestamp: nextTime.toISOString(),
          focus: ['BCF'],
          status: 'pending' as const
      }].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
  };

  const removeTask = (taskId: string) => {
      setSchedule(prev => prev.filter(t => t.id !== taskId));
  };

  const updateTaskTime = (taskId: string, newTime: string) => {
      const [h, m] = newTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < new Date().getTime() - 43200000) d.setDate(d.getDate() + 1);
      
      setSchedule(prev => prev.map(t => t.id === taskId ? {...t, timestamp: d.toISOString()} : t).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
  };

  const updateTaskFocus = (taskId: string, item: string) => {
    setSchedule(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        const newFocus = t.focus.includes(item) 
            ? t.focus.filter(f => f !== item) 
            : [...t.focus, item];
        return { ...t, focus: newFocus };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !patient) return;
    setIsSubmitting(true);

    const numOrUndef = (val: string) => val === '' ? undefined : Number(val);

    const payload = {
        patientId: id,
        examinerName: 'Dr. Demo', 
        vitals: {
          fc: 0, 
          tax: activeParams.includes('TAX') ? numOrUndef(formData.tax) : undefined,
          spo2: activeParams.includes('Sat') ? numOrUndef(formData.spo2) : undefined,
          paSystolic: activeParams.includes('PA') ? numOrUndef(formData.paSys) : undefined,
          paDiastolic: activeParams.includes('PA') ? numOrUndef(formData.paDia) : undefined,
          paPosition: 'sitting' as const,
          
          paStandingSystolic: activeParams.includes('PA') ? numOrUndef(formData.paSysStanding) : undefined,
          paStandingDiastolic: activeParams.includes('PA') ? numOrUndef(formData.paDiaStanding) : undefined
        },
        obstetric: {
          bcf: activeParams.includes('BCF') ? numOrUndef(formData.bcf) : undefined,
          // Use the computed frequency and summary
          dinamicaFrequency: activeParams.includes('Dinâmica') ? numOrUndef(formData.dinamicaFreq) : undefined,
          dinamicaSummary: activeParams.includes('Dinâmica') ? formData.dinamicaSummary : undefined,
          
          // Toque fields
          dilation: activeParams.includes('Toque') ? numOrUndef(formData.dilation) : undefined,
          effacement: activeParams.includes('Toque') ? numOrUndef(formData.effacement) : undefined,
          station: activeParams.includes('Toque') ? numOrUndef(formData.station) : undefined,
          cervixPosition: activeParams.includes('Toque') ? (formData.cervixPosition as any) : undefined,
          cervixConsistency: activeParams.includes('Toque') ? (formData.cervixConsistency as any) : undefined,
          membranes: formData.membranes
        },
        medication: {
          misoprostolDose: activeParams.includes('Meds') ? numOrUndef(formData.miso) : undefined,
          oxytocinDose: activeParams.includes('Meds') ? numOrUndef(formData.oxy) : undefined,
        },
        // Only include Mg data if the patient is using it or if params are active (editing edge case)
        magnesiumData: (patient.useMagnesiumSulfate || activeParams.includes('Reflexo')) ? {
            reflex: formData.magReflex as any,
            diuresis: formData.magDiuresis,
            respiratoryRate: numOrUndef(formData.magRespiratoryRate)
        } : undefined,
        notes: formData.notes
    };

    try {
      if (obsId) {
          // UPDATE
          await patientService.updateObservation(obsId, payload);
      } else {
          // CREATE
          
          // Prepare the schedule to be updated:
          // If a taskId is associated with this action, mark it as completed in our local state BEFORE sending.
          const finalSchedule = schedule.map(task => 
              (taskId && task.id === taskId) 
                  ? { ...task, status: 'completed' as const } 
                  : task
          );
          
          // Pass taskId to service (Redundant but safe)
          await patientService.addObservation(payload, taskId || undefined);
          
          // Update the patient with the schedule that definitely has the task marked completed
          await patientService.updatePatient(id, { schedule: finalSchedule });
      }
      
      navigate(`/patient/${id}`);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleSelection = (name: string, value: string) => {
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!patient) return <div className="p-8">Carregando...</div>;

  const hasParam = (p: string) => activeParams.includes(p);
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-4 sticky top-16 bg-slate-50 z-10 py-2">
         <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
                <h1 className="text-xl font-bold text-slate-900">{obsId ? 'Editar Evolução' : 'Nova Evolução'}</h1>
                <p className="text-xs text-slate-500">{patient.name} - Leito {patient.bed}</p>
            </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Param Selector */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold mb-2 uppercase tracking-wide">
                <SlidersHorizontal className="w-3 h-3" />
                Parâmetros visíveis:
            </div>
            <div className="flex flex-wrap gap-2">
                {ALL_PARAMS.map(param => {
                    const isActive = hasParam(param.id);
                    return (
                        <button
                            key={param.id}
                            type="button"
                            onClick={() => toggleActiveParam(param.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1
                                ${isActive 
                                    ? 'bg-slate-800 text-white border-slate-900 shadow-sm' 
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}
                            `}
                        >
                            {param.label}
                            {isActive && <X className="w-3 h-3 ml-1 opacity-50" />}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Magnesium Sulfate Protocol Section (Automatically visible if active) */}
        {patient.useMagnesiumSulfate && (
            <section className="bg-purple-50 p-5 rounded-xl border border-purple-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Activity className="w-24 h-24 text-purple-600" />
                </div>
                <h3 className="text-sm font-bold text-purple-800 uppercase tracking-wide mb-4 border-b border-purple-200 pb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Protocolo Sulfato de Magnésio
                </h3>
                
                <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div>
                        <label className="flex items-center gap-1 text-xs font-bold text-purple-900 mb-2">
                            <Hammer className="w-3 h-3" /> Reflexo Patelar
                        </label>
                        <select 
                            name="magReflex" 
                            className="w-full p-3 border border-purple-200 rounded-lg bg-white text-purple-900 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            value={formData.magReflex}
                            onChange={handleChange}
                        >
                            <option value="Presente">Presente (+)</option>
                            <option value="Ausente">Ausente (0)</option>
                            <option value="Exaltado">Exaltado (++++)</option>
                            <option value="Diminuído">Diminuído (+/-)</option>
                        </select>
                    </div>
                    <div>
                        <label className="flex items-center gap-1 text-xs font-bold text-purple-900 mb-2">
                            <Droplets className="w-3 h-3" /> Diurese (ml/h)
                        </label>
                        <input 
                            name="magDiuresis" 
                            type="text" 
                            placeholder="Ex: 100ml"
                            className="w-full p-3 border border-purple-200 rounded-lg bg-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                            value={formData.magDiuresis} 
                            onChange={handleChange} 
                        />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="flex items-center gap-1 text-xs font-bold text-purple-900 mb-2">
                            <Wind className="w-3 h-3" /> Freq. Respiratória (irpm)
                        </label>
                        <input 
                            name="magRespiratoryRate" 
                            type="number" 
                            placeholder="16"
                            className="w-full p-3 border border-purple-200 rounded-lg bg-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                            value={formData.magRespiratoryRate} 
                            onChange={handleChange} 
                        />
                    </div>
                </div>
            </section>
        )}

        {/* Vitals Group */}
        {(hasParam('PA') || hasParam('TAX') || hasParam('Sat')) && (
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b pb-2">Sinais Vitais</h3>
                <div className="space-y-4">
                    {hasParam('PA') && (
                        <>
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                                <div className="col-span-3 text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                    {patient.useMethyldopa ? 'PA Sentada' : 'Pressão Arterial (Sentada)'}
                                    {patient.useMethyldopa && <span className="text-[10px] text-blue-500 bg-blue-50 px-1 rounded">Obrigatório</span>}
                                </div>
                                <div>
                                    <input name="paSys" type="number" required placeholder="Sys" className="w-full p-3 border border-slate-300 rounded-lg text-lg font-bold bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.paSys} onChange={handleChange} />
                                </div>
                                <span className="pb-3 font-bold text-slate-400">x</span>
                                <div>
                                    <input name="paDia" type="number" required placeholder="Dia" className="w-full p-3 border border-slate-300 rounded-lg text-lg font-bold bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.paDia} onChange={handleChange} />
                                </div>
                            </div>

                            {patient.useMethyldopa && (
                                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                                    <div className="col-span-3 text-xs font-bold text-yellow-800 mb-1 flex items-center gap-1">
                                        PA Em Pé
                                        <AlertCircle className="w-3 h-3" />
                                    </div>
                                    <div>
                                        <input name="paSysStanding" type="number" required placeholder="Sys" className="w-full p-3 border border-yellow-300 rounded-lg text-lg font-bold bg-white focus:ring-2 focus:ring-yellow-500 focus:outline-none" value={formData.paSysStanding} onChange={handleChange} />
                                    </div>
                                    <span className="pb-3 font-bold text-yellow-400">x</span>
                                    <div>
                                        <input name="paDiaStanding" type="number" required placeholder="Dia" className="w-full p-3 border border-yellow-300 rounded-lg text-lg font-bold bg-white focus:ring-2 focus:ring-yellow-500 focus:outline-none" value={formData.paDiaStanding} onChange={handleChange} />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {hasParam('TAX') && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Temp (TAX)</label>
                                <div className="relative">
                                    <input name="tax" type="number" step="0.1" required placeholder="36.5" className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.tax} onChange={handleChange} />
                                    <span className="absolute right-3 top-3.5 text-slate-400 text-sm">°C</span>
                                </div>
                            </div>
                        )}
                        {hasParam('Sat') && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Sat. O2</label>
                                <div className="relative">
                                    <input name="spo2" type="number" placeholder="98" className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.spo2} onChange={handleChange} />
                                    <span className="absolute right-3 top-3.5 text-slate-400 text-sm">%</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        )}

        {/* Obstetric Basic + Dynamic Timer */}
        {(hasParam('BCF') || hasParam('Dinâmica')) && (
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b pb-2">Monitoramento</h3>
                <div className="space-y-6">
                    {hasParam('BCF') && (
                        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                            <label className="block text-sm font-bold text-rose-800 mb-2">BCF (bpm)</label>
                            <input name="bcf" type="number" required className="w-full p-4 border border-rose-200 rounded-xl text-3xl font-bold text-center text-rose-600 bg-rose-50 focus:ring-2 focus:ring-rose-500 focus:outline-none" value={formData.bcf} onChange={handleChange} placeholder="140" />
                        </div>
                    )}

                    {hasParam('Dinâmica') && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-4">
                                <Timer className="w-4 h-4 text-medical-600" />
                                Dinâmica Uterina (10 min)
                            </label>
                            
                            {/* Main Timer Display */}
                            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className={`text-3xl font-mono font-bold ${elapsedTotalSeconds >= 600 ? 'text-green-600' : 'text-slate-800'}`}>
                                        {formatTime(elapsedTotalSeconds)}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 10:00</span>
                                </div>
                                <div className="flex gap-2">
                                    {!timerState.isRunning && elapsedTotalSeconds === 0 && (
                                        <button type="button" onClick={toggleMainTimer} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200">
                                            <Play className="w-5 h-5 fill-current" />
                                        </button>
                                    )}
                                    {timerState.isRunning && (
                                         <div className="p-2 rounded-full animate-pulse bg-green-100 text-green-700">
                                             <Activity className="w-5 h-5" />
                                         </div>
                                    )}
                                    <button type="button" onClick={resetTimer} className="p-2 text-slate-400 hover:text-slate-600" title="Reiniciar">
                                        <RotateCcw className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Contraction Button - ONLY enabled if timer is running */}
                            <div className="relative">
                                {timerState.isContractionActive && (
                                    <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 -translate-y-full z-10">
                                        <div className="bg-red-600 text-white font-mono text-2xl font-bold px-4 py-1 rounded-full shadow-lg animate-pulse border-2 border-white">
                                            {timerState.currentContractionDuration}"
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    disabled={!timerState.isRunning}
                                    onClick={toggleContraction}
                                    className={`w-full py-6 rounded-xl font-bold text-lg shadow-sm transition-all mb-4 flex items-center justify-center gap-2
                                        ${!timerState.isRunning 
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                            : timerState.isContractionActive
                                                ? 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]'
                                                : 'bg-medical-500 text-white hover:bg-medical-600 active:scale-[0.98]'}
                                    `}
                                >
                                    {timerState.isContractionActive ? (
                                        <>
                                            <Square className="w-5 h-5 fill-current" />
                                            PARAR CONTRAÇÃO
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-5 h-5 fill-current" />
                                            INICIAR CONTRAÇÃO
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Results List */}
                            <div className="bg-white rounded-lg border border-slate-200 p-3 min-h-[80px]">
                                <div className="text-xs text-slate-400 font-bold uppercase mb-2">Registro:</div>
                                {timerState.recordedContractions.length === 0 ? (
                                    <span className="text-slate-300 text-sm italic">Nenhuma contração registrada.</span>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {timerState.recordedContractions.map((duration, i) => (
                                            <span key={i} className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm font-medium border border-slate-200">
                                                {duration}"
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Final Output Preview */}
                            {formData.dinamicaSummary && (
                                <div className="mt-3 text-right">
                                    <span className="text-xs text-slate-500 mr-2">Resumo:</span>
                                    <span className="font-bold text-slate-800">{formData.dinamicaSummary}</span>
                                </div>
                            )}
                            
                            {/* Manual Override (Fallback) */}
                            {(!timerState.isRunning && elapsedTotalSeconds === 0 && formData.dinamicaFreq === '') && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <label className="text-xs text-slate-400 block mb-1">Entrada Manual (Opcional):</label>
                                    <input 
                                        name="dinamicaFreq" 
                                        type="number" 
                                        placeholder="Qtd em 10 min" 
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none"
                                        value={formData.dinamicaFreq}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>
        )}

        {/* TOQUE (CERVICAL EXAM) - OPTIMIZED */}
        {hasParam('Toque') && (
            <section className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                        <Activity className="w-4 h-4 text-medical-600" /> Toque
                    </h3>
                    
                    {/* Bishop Score Display */}
                    {bishopData.filledFields > 1 && (
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 transition-colors duration-300
                            ${bishopData.score > 6 
                                ? 'bg-green-100 text-green-700 border-green-200' 
                                : 'bg-amber-100 text-amber-700 border-amber-200'}
                        `}>
                            <Calculator className="w-3 h-3" />
                            Bishop: {bishopData.score}
                        </div>
                    )}
                </div>
                
                <div className="space-y-5">
                    
                    {/* 1. Dilation & Effacement */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-2">
                                <CircleDot className="w-3 h-3" /> Dilatação (cm)
                            </label>
                            <select name="dilation" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-lg font-bold text-center text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.dilation} onChange={handleChange} required>
                                <option value="">-</option>
                                {[...Array(11)].map((_, i) => <option key={i} value={i}>{i} cm</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-2">
                                <Activity className="w-3 h-3" /> Apagamento (%)
                            </label>
                            <input 
                                name="effacement" 
                                type="number" 
                                step="10"
                                min="0"
                                max="100"
                                placeholder="%" 
                                className="w-full p-2 border border-slate-300 rounded-lg text-lg font-bold text-center bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" 
                                value={formData.effacement} 
                                onChange={handleChange} 
                            />
                        </div>
                    </div>

                    {/* 2. Position & Consistency */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">Posição</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Posterior', 'Intermediário', 'Central'].map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleSelection('cervixPosition', opt)}
                                    className={`py-2 text-[10px] md:text-xs font-medium rounded border ${formData.cervixPosition === opt ? 'bg-medical-600 text-white border-medical-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">Consistência</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Nasal', 'Nasolabial', 'Labial'].map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleSelection('cervixConsistency', opt)}
                                    className={`py-2 text-[10px] md:text-xs font-medium rounded border ${formData.cervixConsistency === opt ? 'bg-medical-600 text-white border-medical-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    {opt === 'Nasal' ? 'Nasal (Firme)' : opt === 'Nasolabial' ? 'Nasolab. (Méd)' : 'Labial (Mole)'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Station (De Lee) */}
                    <div>
                        <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-2">
                            <ArrowDownUp className="w-3 h-3" /> Altura (De Lee)
                        </label>
                        <div className="flex justify-between bg-white border border-slate-200 rounded-lg p-1 overflow-x-auto">
                            {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => handleSelection('station', String(val))}
                                    className={`w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded ${Number(formData.station) === val && formData.station !== '' ? 'bg-medical-600 text-white shadow' : 'text-slate-400 hover:bg-slate-50'}`}
                                >
                                    {val > 0 ? `+${val}` : val}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. Membranes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2">Bolsa</label>
                        <select name="membranes" className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.membranes} onChange={handleChange}>
                        {Object.values(MembraneStatus).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                </div>
            </section>
        )}

        {/* Medication */}
        {hasParam('Meds') && (
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b pb-2">Medicação Atual</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Misoprostol (mcg)</label>
                        <input name="miso" type="number" placeholder="0" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.miso} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Ocitocina (mU/min)</label>
                        <input name="oxy" type="number" placeholder="0" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.oxy} onChange={handleChange} />
                    </div>
                </div>
            </section>
        )}

        {/* Notes (Always Visible) */}
        <section>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observações / Conduta</label>
            <textarea name="notes" rows={3} className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.notes} onChange={handleChange} placeholder="Plano de parto, analgesia, etc..." />
        </section>

        {/* Moved Submit Button Here */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-medical-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-medical-700 transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? <span className="animate-spin">...</span> : <><Save className="w-5 h-5" /> {obsId ? 'Atualizar Evolução' : 'Salvar Evolução'}</>}
        </button>

        {/* FUTURE SCHEDULE MANAGEMENT */}
        <section className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
           <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 border-b border-blue-200 pb-2 flex items-center justify-between">
             <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Próximas Aferições</span>
             <button type="button" onClick={addTask} className="text-blue-600 bg-white p-1 rounded border border-blue-200 hover:bg-blue-50">
                 <Plus className="w-4 h-4" />
             </button>
           </h3>
           
           <div className="space-y-2">
             {schedule.filter(t => t.status === 'pending').length > 0 ? (
                 schedule.filter(t => t.status === 'pending').map((task) => (
                    <div key={task.id} className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-lg">
                        <input 
                            type="time" 
                            className="font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1 py-1 text-sm w-20 focus:outline-none focus:border-blue-300"
                            value={new Date(task.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            onChange={(e) => updateTaskTime(task.id, e.target.value)}
                        />
                        <div className="flex-1 flex flex-wrap gap-1">
                            {['BCF', 'Dinâmica', 'Toque', 'PA', 'Reflexo', 'Diurese', 'FR', 'Sat', 'TAX'].map(item => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => updateTaskFocus(task.id, item)}
                                    className={`text-[10px] px-2 py-1 rounded border ${task.focus.includes(item) ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={() => removeTask(task.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                 ))
             ) : (
                 <div className="text-center text-slate-400 text-xs py-2">Sem horários futuros.</div>
             )}
           </div>
        </section>

      </form>
    </div>
  );
};

export default ObservationForm;