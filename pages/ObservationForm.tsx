
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { MembraneStatus, Patient, ScheduledTask } from '../types';
import { ArrowLeft, Save, Clock, Trash2, Plus, AlertCircle, X, SlidersHorizontal, ArrowDownUp, CircleDot, Activity, Play, Square, Timer, RotateCcw, Hammer, Droplets, Wind, Waves, Calculator, Calendar, Edit3 } from 'lucide-react';

const ALL_PARAMS = [
  { id: 'BCF', label: 'BCF', section: 'obstetric' },
  { id: 'Dinâmica', label: 'Dinâmica', section: 'obstetric' },
  { id: 'Toque', label: 'Toque', section: 'obstetric' },
  { id: 'PA', label: 'Pressão Arterial', section: 'vitals' },
  { id: 'TAX', label: 'Temperatura', section: 'vitals' },
  { id: 'Sat', label: 'Saturação', section: 'vitals' },
  { id: 'Meds', label: 'Medicação', section: 'meds' },
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
  const [obsDate, setObsDate] = useState('');
  const [obsTime, setObsTime] = useState('');

  const [formData, setFormData] = useState({
    bcf: '',
    dinamicaFreq: '',
    dinamicaSummary: '', 
    dilation: '',
    cervixStatus: [] as string[], // NEW: OEEA, OEI, OII
    effacement: '',
    station: '',
    cervixPosition: '',
    cervixConsistency: '',
    membranes: '' as MembraneStatus | '', // CHANGED: Default is empty, not INTACT
    bloodOnGlove: false, // NEW: SDL (true) / SSDL (false)
    paSys: '',
    paDia: '',
    paSysStanding: '',
    paDiaStanding: '',
    tax: '',
    spo2: '',
    miso: '',
    oxy: '',
    magReflex: 'Presente',
    magDiuresis: '',
    magRespiratoryRate: '',
    notes: ''
  });

  // --- BISHOP SCORE ---
  const calculateBishopScore = () => {
    let score = 0;
    let filledFields = 0;
    
    // 1. Dilatação
    if (formData.dilation !== '') {
        const d = Number(formData.dilation);
        if (d >= 5) score += 3; else if (d >= 3) score += 2; else if (d >= 1) score += 1;
        filledFields++;
    }
    
    // 2. Apagamento
    if (formData.effacement !== '') {
        const e = Number(formData.effacement);
        if (e >= 80) score += 3; else if (e >= 60) score += 2; else if (e >= 40) score += 1;
        filledFields++;
    }
    
    // 3. Altura (De Lee)
    if (formData.station !== '') {
        const s = Number(formData.station);
        // Bishop Modificado:
        // +1, +2 : 3 pts
        // -1, 0  : 2 pts
        // -2     : 1 pt
        // -3     : 0 pts
        if (s >= 1) score += 3; 
        else if (s === 0 || s === -1) score += 2; 
        else if (s === -2) score += 1;
        filledFields++;
    }
    
    // 4. Consistência
    if (formData.cervixConsistency) {
        if (formData.cervixConsistency === 'Labial') score += 2; else if (formData.cervixConsistency === 'Nasolabial') score += 1;
        filledFields++;
    }
    
    // 5. Posição
    if (formData.cervixPosition) {
        if (formData.cervixPosition === 'Central') score += 2; else if (formData.cervixPosition === 'Intermediário') score += 1;
        filledFields++;
    }
    return { score, filledFields };
  };

  const bishopData = calculateBishopScore();

  // --- DYNAMICS TIMER ---
  const [timerState, setTimerState] = useState({
      isRunning: false,
      mainTimerMs: 0,
      isContractionActive: false,
      currentContractionStart: 0,
      currentContractionDuration: 0,
      recordedContractions: [] as number[]
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
                  if (newMainTimerMs >= 600000) {
                      clearInterval(intervalRef.current!);
                      return { ...prev, isRunning: false, isContractionActive: false, currentContractionDuration: 0, mainTimerMs: 600000 };
                  }
                  let liveDuration = 0;
                  if (prev.isContractionActive) liveDuration = Math.floor((now - prev.currentContractionStart) / 1000);
                  return { ...prev, mainTimerMs: newMainTimerMs, currentContractionDuration: liveDuration };
              });
          }, 50);
      } else {
          if (intervalRef.current) clearInterval(intervalRef.current);
      }
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState.isRunning]);

  const elapsedTotalSeconds = Math.floor(timerState.mainTimerMs / 1000);
  const toggleMainTimer = () => setTimerState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  const toggleContraction = () => {
      setTimerState(prev => {
          if (!prev.isRunning) return prev;
          if (prev.isContractionActive) {
              const duration = Math.floor((Date.now() - prev.currentContractionStart) / 1000);
              const newContractions = [...prev.recordedContractions, duration];
              updateDinamicaForm(newContractions);
              return { ...prev, isContractionActive: false, currentContractionDuration: 0, recordedContractions: newContractions };
          } else {
              return { ...prev, isContractionActive: true, currentContractionStart: Date.now(), currentContractionDuration: 0 };
          }
      });
  };

  const resetTimer = () => {
      setTimerState({ isRunning: false, mainTimerMs: 0, isContractionActive: false, currentContractionStart: 0, currentContractionDuration: 0, recordedContractions: [] });
      setFormData(prev => ({ ...prev, dinamicaFreq: '', dinamicaSummary: '' }));
  };

  const updateDinamicaForm = (contractions: number[]) => {
      // Group by duration
      const groups: Record<number, number> = {};
      contractions.forEach(d => { groups[d] = (groups[d] || 0) + 1; });
      
      // Format: 1X32" + 2X41"/10'
      const parts = Object.entries(groups)
        .sort((a,b) => Number(b[0]) - Number(a[0]))
        .map(([duration, count]) => `${count}X${duration}"`);
      
      const summary = parts.length > 0 ? `${parts.join(' + ')}/10'` : '';
      
      setFormData(prev => ({ ...prev, dinamicaFreq: String(contractions.length), dinamicaSummary: summary }));
  };

  const [schedule, setSchedule] = useState<ScheduledTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Correct date formatting using local time to avoid timezone shifts
  const toInputDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const toInputTime = (date: Date) => {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
  };

  useEffect(() => {
    const fetchData = async () => {
        if (!id) return;
        const p = await patientService.getPatientById(id);
        if (p) {
            setPatient(p);
            setSchedule(p.schedule || []);
            if (obsId) {
               const obs = await patientService.getObservationById(obsId);
               if (obs) {
                   const d = new Date(obs.timestamp);
                   setObsDate(toInputDate(d));
                   setObsTime(toInputTime(d));
                   const paramsToActivate: string[] = [];
                   setFormData({
                       bcf: obs.obstetric.bcf !== undefined ? String(obs.obstetric.bcf) : '',
                       dinamicaFreq: obs.obstetric.dinamicaFrequency !== undefined ? String(obs.obstetric.dinamicaFrequency) : '',
                       dinamicaSummary: obs.obstetric.dinamicaSummary || '',
                       dilation: obs.obstetric.dilation !== undefined ? String(obs.obstetric.dilation) : '',
                       cervixStatus: obs.obstetric.cervixStatus || [],
                       effacement: obs.obstetric.effacement !== undefined ? String(obs.obstetric.effacement) : '',
                       station: obs.obstetric.station !== undefined ? String(obs.obstetric.station) : '',
                       cervixPosition: obs.obstetric.cervixPosition || '',
                       cervixConsistency: obs.obstetric.cervixConsistency || '',
                       membranes: obs.obstetric.membranes || '' as MembraneStatus,
                       bloodOnGlove: obs.obstetric.bloodOnGlove || false,
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
                   if (obs.obstetric.bcf !== undefined) paramsToActivate.push('BCF');
                   if (obs.obstetric.dinamicaFrequency !== undefined || obs.obstetric.dinamicaSummary) paramsToActivate.push('Dinâmica');
                   if (obs.obstetric.dilation !== undefined) paramsToActivate.push('Toque');
                   if (obs.vitals.paSystolic !== undefined) paramsToActivate.push('PA');
                   if (obs.vitals.tax !== undefined) paramsToActivate.push('TAX');
                   if (obs.vitals.spo2) paramsToActivate.push('Sat');
                   if (obs.medication?.misoprostolDose || obs.medication?.oxytocinDose) paramsToActivate.push('Meds');
                   if (obs.magnesiumData) paramsToActivate.push('Reflexo', 'Diurese', 'FR');
                   setActiveParams(paramsToActivate);
               }
            } else {
                let targetDate = new Date();
                // Round current time to nearest 5 minutes
                const coeff = 1000 * 60 * 5;
                targetDate = new Date(Math.round(targetDate.getTime() / coeff) * coeff);
                let initialParams = ['BCF', 'Dinâmica', 'PA'];

                // Auto-activate Mg params if patient is using protocol (Convenience)
                if (p.useMagnesiumSulfate) {
                    initialParams.push('Reflexo', 'Diurese', 'FR');
                }

                if (taskId) {
                    const task = p.schedule.find(t => t.id === taskId);
                    if (task) {
                        // Use task timestamp specifically as requested
                        targetDate = new Date(task.timestamp);
                        initialParams = task.focus;
                    }
                }
                
                setObsDate(toInputDate(targetDate));
                setObsTime(toInputTime(targetDate));
                setActiveParams(initialParams);
            }
        }
    };
    fetchData();
  }, [id, taskId, obsId]);

  const toggleActiveParam = (paramId: string) => setActiveParams(prev => prev.includes(paramId) ? prev.filter(p => p !== paramId) : [...prev, paramId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !patient) return;
    setIsSubmitting(true);
    const numOrUndef = (val: string) => val === '' ? undefined : Number(val);
    const finalDateObj = new Date(`${obsDate}T${obsTime}`);
    
    // Logic: If dynamics is empty, do not send 'Ausente', send undefined. Only send if user typed something.
    const dynamicsVal = activeParams.includes('Dinâmica') && formData.dinamicaSummary.trim() !== '' ? formData.dinamicaSummary : undefined;

    // Determine if Mg Data should be sent. 
    // CRITICAL FIX: Only send if the parameters are ACTIVE in the form.
    const isMgActive = activeParams.includes('Reflexo') || activeParams.includes('Diurese') || activeParams.includes('FR');

    const payload = {
        patientId: id,
        timestamp: finalDateObj.toISOString(),
        examinerName: 'Dr. Demo', 
        vitals: {
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
          // We rely primarily on summary now for display
          dinamicaFrequency: activeParams.includes('Dinâmica') ? numOrUndef(formData.dinamicaFreq) : undefined,
          dinamicaSummary: dynamicsVal,
          dilation: activeParams.includes('Toque') ? numOrUndef(formData.dilation) : undefined,
          cervixStatus: activeParams.includes('Toque') ? formData.cervixStatus : undefined,
          effacement: activeParams.includes('Toque') ? numOrUndef(formData.effacement) : undefined,
          station: activeParams.includes('Toque') ? numOrUndef(formData.station) : undefined,
          cervixPosition: activeParams.includes('Toque') ? (formData.cervixPosition as any) : undefined,
          cervixConsistency: activeParams.includes('Toque') ? (formData.cervixConsistency as any) : undefined,
          // Only send membranes if Toque is active AND user selected a value (not empty string)
          membranes: activeParams.includes('Toque') && formData.membranes !== '' ? (formData.membranes as MembraneStatus) : undefined,
          bloodOnGlove: activeParams.includes('Toque') ? formData.bloodOnGlove : undefined
        },
        medication: {
          misoprostolDose: activeParams.includes('Meds') ? numOrUndef(formData.miso) : undefined,
          oxytocinDose: activeParams.includes('Meds') ? numOrUndef(formData.oxy) : undefined,
        },
        magnesiumData: isMgActive ? {
            reflex: formData.magReflex as any,
            diuresis: formData.magDiuresis,
            respiratoryRate: numOrUndef(formData.magRespiratoryRate)
        } : undefined,
        notes: formData.notes
    };

    try {
      if (obsId) await patientService.updateObservation(obsId, payload);
      else await patientService.addObservation(payload, taskId || undefined);
      navigate(`/patient/${id}`);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar.');
    } finally { setIsSubmitting(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSelection = (name: string, value: string) => setFormData(prev => ({ ...prev, [name]: value }));
  const handleCervixStatusToggle = (val: string) => {
     setFormData(prev => {
         const current = prev.cervixStatus;
         if (current.includes(val)) return { ...prev, cervixStatus: current.filter(x => x !== val) };
         return { ...prev, cervixStatus: [...current, val] };
     });
  };

  if (!patient) return <div className="p-8">Carregando...</div>;

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
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex gap-3">
             <div className="flex-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Data</label>
                 <input type="date" required className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700" value={obsDate} onChange={(e) => setObsDate(e.target.value)} />
             </div>
             <div className="flex-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Hora</label>
                 <input type="time" required className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700" value={obsTime} onChange={(e) => setObsTime(e.target.value)} />
             </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold mb-2 uppercase tracking-wide"><SlidersHorizontal className="w-3 h-3" /> Visível:</div>
            <div className="flex flex-wrap gap-2">
                {ALL_PARAMS.map(param => (
                    <button key={param.id} type="button" onClick={() => toggleActiveParam(param.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 ${activeParams.includes(param.id) ? 'bg-slate-800 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                        {param.label} {activeParams.includes(param.id) && <X className="w-3 h-3 ml-1 opacity-50" />}
                    </button>
                ))}
            </div>
        </div>

        {/* Vitals Group */}
        {(activeParams.includes('PA') || activeParams.includes('TAX') || activeParams.includes('Sat')) && (
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b pb-2">Sinais Vitais</h3>
                <div className="space-y-4">
                    {activeParams.includes('PA') && (
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                            <div className="col-span-3 text-xs font-bold text-slate-700 mb-1">Pressão Arterial (mmHg)</div>
                            <input name="paSys" type="number" placeholder="Sys" className="w-full p-3 border border-slate-300 rounded-lg text-lg font-bold text-center" value={formData.paSys} onChange={handleChange} />
                            <span className="pb-3 font-bold text-slate-400">x</span>
                            <input name="paDia" type="number" placeholder="Dia" className="w-full p-3 border border-slate-300 rounded-lg text-lg font-bold text-center" value={formData.paDia} onChange={handleChange} />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        {activeParams.includes('TAX') && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Temperatura</label>
                                <input name="tax" type="number" step="0.1" placeholder="36.5" className="w-full p-3 border border-slate-300 rounded-lg" value={formData.tax} onChange={handleChange} />
                            </div>
                        )}
                        {activeParams.includes('Sat') && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Saturação (%)</label>
                                <input name="spo2" type="number" placeholder="98" className="w-full p-3 border border-slate-300 rounded-lg" value={formData.spo2} onChange={handleChange} />
                            </div>
                        )}
                    </div>
                </div>
            </section>
        )}

        {/* BCF & Dinâmica */}
        {(activeParams.includes('BCF') || activeParams.includes('Dinâmica')) && (
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b pb-2">Monitoramento</h3>
                <div className="space-y-6">
                    {activeParams.includes('BCF') && (
                        <div className="bg-rose-50 p-4 rounded-xl">
                            <label className="block text-sm font-bold text-rose-800 mb-2">BCF (bpm)</label>
                            <input name="bcf" type="number" className="w-full p-4 border border-rose-200 rounded-xl text-3xl font-bold text-rose-600 bg-white text-center focus:ring-2 focus:ring-rose-500 focus:outline-none" placeholder="-" value={formData.bcf} onChange={handleChange} />
                        </div>
                    )}
                    {activeParams.includes('Dinâmica') && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                           <div className="flex justify-between items-center mb-4">
                             <label className="text-sm font-bold text-slate-800">Dinâmica Uterina</label>
                             <div className="flex items-center gap-2">
                                {(timerState.isRunning || timerState.mainTimerMs > 0) && (
                                     <button type="button" onClick={resetTimer} className="text-xs text-blue-600 underline mr-2">Resetar Timer</button>
                                )}
                                <button 
                                    type="button" 
                                    onClick={() => setFormData(p => ({...p, dinamicaSummary: 'Presente'}))} 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.dinamicaSummary === 'Presente' ? 'bg-green-600 text-white border-green-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                >
                                    Presente
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setFormData(p => ({...p, dinamicaSummary: 'Ausente'}))} 
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.dinamicaSummary === 'Ausente' ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                >
                                    Ausente
                                </button>
                             </div>
                           </div>

                           <div className="mb-4">
                               {/* Timer Control */}
                               {!timerState.isRunning && timerState.mainTimerMs === 0 ? (
                                   <button 
                                      type="button"
                                      onClick={toggleMainTimer}
                                      className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow-sm hover:bg-blue-700 flex items-center justify-center gap-2"
                                   >
                                      <Play className="w-4 h-4" /> Iniciar Contagem (10 min)
                                   </button>
                               ) : (
                                   <div className="bg-white p-3 rounded-lg border border-slate-200 mb-3">
                                       <div className="flex justify-between items-end mb-2">
                                           <span className="text-[10px] uppercase font-bold text-slate-400">Tempo Decorrido</span>
                                           <span className={`font-mono text-xl font-bold ${timerState.mainTimerMs >= 600000 ? 'text-green-600' : 'text-slate-700'}`}>
                                               {Math.floor(elapsedTotalSeconds / 60)}:{String(elapsedTotalSeconds % 60).padStart(2, '0')} / 10:00
                                           </span>
                                       </div>
                                       
                                       {/* Progress Bar */}
                                       <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                                           <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min((timerState.mainTimerMs / 600000) * 100, 100)}%` }}></div>
                                       </div>

                                       <div className="flex gap-2">
                                           {timerState.isRunning ? (
                                              <button 
                                                type="button"
                                                onClick={toggleContraction}
                                                className={`flex-1 py-4 rounded-lg font-bold text-lg shadow-sm transition-all flex flex-col items-center justify-center border-b-4 active:border-b-0 active:translate-y-1 ${
                                                    timerState.isContractionActive 
                                                    ? 'bg-red-500 border-red-700 text-white' 
                                                    : 'bg-green-500 border-green-700 text-white'
                                                }`}
                                              >
                                                 <span>{timerState.isContractionActive ? 'PARAR CONTRAÇÃO' : 'CONTRAÇÃO INICIOU'}</span>
                                                 {timerState.isContractionActive && (
                                                     <span className="text-xs font-mono mt-1 opacity-90">{timerState.currentContractionDuration}s</span>
                                                 )}
                                              </button>
                                           ) : (
                                              <button 
                                                type="button" 
                                                onClick={resetTimer}
                                                className="w-full py-2 text-slate-500 font-bold border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                                              >
                                                <RotateCcw className="w-4 h-4" /> Reiniciar
                                              </button>
                                           )}
                                       </div>
                                   </div>
                               )}
                               
                               {/* Manual Inputs - Primary field now */}
                               <div className="mt-4">
                                     <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center justify-between">
                                        <span>Descrição da Dinâmica (Manual)</span>
                                        {formData.dinamicaSummary && <span className="text-[10px] text-blue-600 font-bold" onClick={() => setFormData(p => ({...p, dinamicaSummary: ''}))}>Limpar</span>}
                                     </label>
                                     <div className="relative">
                                         <input 
                                            name="dinamicaSummary" 
                                            type="text" 
                                            placeholder="Ex: 1X32 + 2X41 / 10'" 
                                            className="w-full p-3 border border-slate-300 rounded-lg text-sm font-bold text-slate-700" 
                                            value={formData.dinamicaSummary} 
                                            onChange={handleChange} 
                                         />
                                         <Edit3 className="w-4 h-4 text-slate-300 absolute right-3 top-3.5" />
                                     </div>
                                     <p className="text-[10px] text-slate-400 mt-1">
                                        Use o formato: <b>2X35" + 1X40"/10'</b> ou clique em "Ausente" acima.
                                     </p>
                               </div>
                           </div>
                        </div>
                    )}
                </div>
            </section>
        )}

        {/* Toque Vaginal */}
        {activeParams.includes('Toque') && (
             <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b pb-2">Toque Vaginal</h3>
                
                {/* Bishop Score Calculator Display */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">Índice de Bishop</span>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="text-xs text-slate-400">({bishopData.filledFields}/5 param)</span>
                         <span className="text-lg font-bold text-medical-600">{bishopData.score}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Dilatação (cm)</label>
                        <div className="flex items-center gap-2">
                           <input name="dilation" type="range" min="0" max="10" step="1" className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" value={formData.dilation || 0} onChange={handleChange} />
                           <input name="dilation" type="number" className="w-16 p-2 border border-slate-300 rounded-lg text-center font-bold" value={formData.dilation} onChange={handleChange} />
                        </div>
                        
                        {/* Se dilatação for 0 ou vazia, mostrar detalhes de colo fechado */}
                        {(formData.dilation === '' || formData.dilation === '0') && (
                           <div className="mt-2 flex gap-2">
                               {['OEI', 'OEEA', 'OII'].map(status => (
                                   <button 
                                      type="button" 
                                      key={status}
                                      onClick={() => handleCervixStatusToggle(status)}
                                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                          formData.cervixStatus.includes(status) 
                                          ? 'bg-slate-800 text-white border-slate-900' 
                                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                      }`}
                                   >
                                       {status}
                                   </button>
                               ))}
                           </div>
                        )}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Apagamento (%)</label>
                        <div className="flex items-center gap-2">
                           <input name="effacement" type="range" min="0" max="100" step="10" className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" value={formData.effacement || 0} onChange={handleChange} />
                           <input name="effacement" type="number" className="w-16 p-2 border border-slate-300 rounded-lg text-center font-bold" value={formData.effacement} onChange={handleChange} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">0% = Grosso (G)</p>
                    </div>
                    
                    <div className="col-span-2 border-t border-slate-100 my-2"></div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Plano De Lee</label>
                        <select name="station" className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm" value={formData.station} onChange={handleChange}>
                            <option value="">Selecione</option>
                            <option value="-4">-4 (Flutuante)</option>
                            <option value="-3">-3</option>
                            <option value="-2">-2</option>
                            <option value="-1">-1</option>
                            <option value="0">0 (Espinhas)</option>
                            <option value="1">+1</option>
                            <option value="2">+2</option>
                            <option value="3">+3</option>
                            <option value="4">+4</option>
                        </select>
                    </div>
                    
                    <div>
                         <label className="block text-xs font-medium text-slate-500 mb-1">Bolsa</label>
                         <select name="membranes" className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm" value={formData.membranes} onChange={handleChange}>
                             <option value="">Não avaliado</option>
                             <option value={MembraneStatus.INTACT}>Íntegras</option>
                             <option value={MembraneStatus.RUPTURED_CLEAR}>Rotas Claras</option>
                             <option value={MembraneStatus.RUPTURED_MECONIUM}>Rotas Meconiais</option>
                         </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Posição do Colo</label>
                        <div className="flex flex-col gap-2">
                            {['Posterior', 'Intermediário', 'Central'].map(opt => (
                                <label key={opt} className={`flex items-center justify-center p-2 rounded border text-xs cursor-pointer transition-all ${formData.cervixPosition === opt ? 'bg-medical-50 border-medical-200 text-medical-700 font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>
                                    <input type="radio" name="cervixPosition" value={opt} checked={formData.cervixPosition === opt} onChange={handleChange} className="hidden" />
                                    {opt}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Consistência</label>
                        <div className="flex flex-col gap-2">
                            {['Nasal', 'Nasolabial', 'Labial'].map(opt => (
                                <label key={opt} className={`flex items-center justify-center p-2 rounded border text-xs cursor-pointer transition-all ${formData.cervixConsistency === opt ? 'bg-medical-50 border-medical-200 text-medical-700 font-bold' : 'bg-white border-slate-200 text-slate-500'}`}>
                                    <input type="radio" name="cervixConsistency" value={opt} checked={formData.cervixConsistency === opt} onChange={handleChange} className="hidden" />
                                    {opt}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="col-span-2">
                       <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100">
                          <span className="text-sm font-bold text-slate-700">Sangue em Dedo de Luva</span>
                          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.bloodOnGlove ? 'bg-red-500' : 'bg-slate-300'}`} onClick={(e) => { e.preventDefault(); setFormData(p => ({...p, bloodOnGlove: !p.bloodOnGlove})) }}>
                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${formData.bloodOnGlove ? 'translate-x-6' : 'translate-x-0'}`}></div>
                          </div>
                       </label>
                       <p className="text-[10px] text-right text-slate-400 mt-1">{formData.bloodOnGlove ? 'SDL (Com Sangue)' : 'SSDL (Sem Sangue)'}</p>
                    </div>
                </div>
             </section>
        )}

        {/* Medications */}
        {activeParams.includes('Meds') && (
            <section className="bg-purple-50 p-5 rounded-xl border border-purple-100 shadow-sm">
                <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wide mb-4 border-b border-purple-200 pb-2">Medicação / Indução</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-purple-800 mb-1">Ocitocina (mU/min)</label>
                        <input name="oxy" type="number" placeholder="0" className="w-full p-3 border border-purple-200 rounded-lg bg-white" value={formData.oxy} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-purple-800 mb-1">Misoprostol (mcg)</label>
                         <select name="miso" className="w-full p-3 border border-purple-200 rounded-lg bg-white" value={formData.miso} onChange={handleChange}>
                            <option value="">-</option>
                            <option value="25">25 mcg</option>
                            <option value="50">50 mcg</option>
                            <option value="100">100 mcg</option>
                            <option value="200">200 mcg</option>
                        </select>
                    </div>
                </div>
            </section>
        )}

        {/* Magnesium Protocol (Neuroprotection/Preeclampsia) */}
        {(activeParams.includes('Reflexo') || activeParams.includes('Diurese') || activeParams.includes('FR')) && (
             <section className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 shadow-sm">
                 <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-4 border-b border-indigo-200 pb-2 flex items-center gap-2">
                     <Activity className="w-4 h-4" /> Protocolo Sulfato Mg
                 </h3>
                 <div className="space-y-4">
                     {activeParams.includes('Reflexo') && (
                        <div>
                             <label className="block text-xs font-medium text-indigo-800 mb-1 flex items-center gap-1"><Hammer className="w-3 h-3" /> Reflexo Patelar</label>
                             <div className="flex gap-2 overflow-x-auto pb-1">
                                 {['Ausente', 'Diminuído', 'Presente', 'Exaltado'].map(r => (
                                     <button 
                                        key={r}
                                        type="button"
                                        onClick={() => handleSelection('magReflex', r)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold border whitespace-nowrap ${formData.magReflex === r ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-500 border-indigo-200'}`}
                                     >
                                         {r}
                                     </button>
                                 ))}
                             </div>
                        </div>
                     )}
                     
                     <div className="grid grid-cols-2 gap-4">
                         {activeParams.includes('Diurese') && (
                             <div>
                                 <label className="block text-xs font-medium text-indigo-800 mb-1 flex items-center gap-1"><Droplets className="w-3 h-3" /> Diurese (mL)</label>
                                 <input name="magDiuresis" type="text" placeholder="Ex: 100ml Clara" className="w-full p-3 border border-indigo-200 rounded-lg bg-white" value={formData.magDiuresis} onChange={handleChange} />
                             </div>
                         )}
                         {activeParams.includes('FR') && (
                             <div>
                                 <label className="block text-xs font-medium text-indigo-800 mb-1 flex items-center gap-1"><Wind className="w-3 h-3" /> Freq. Resp.</label>
                                 <input name="magRespiratoryRate" type="number" placeholder="irpm" className="w-full p-3 border border-indigo-200 rounded-lg bg-white" value={formData.magRespiratoryRate} onChange={handleChange} />
                             </div>
                         )}
                     </div>
                 </div>
             </section>
        )}

        {/* Notes */}
        <div>
           <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Observações Adicionais</label>
           <textarea 
             name="notes" 
             className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-medical-500 focus:outline-none transition-colors" 
             rows={3} 
             placeholder="Conduta, queixas, etc..."
             value={formData.notes}
             onChange={handleChange}
           />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="fixed bottom-20 left-4 right-4 md:static md:w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 z-40"
        >
          {isSubmitting ? (
              'Salvando...' 
          ) : (
              <>
                <Save className="w-5 h-5" />
                Salvar Evolução
              </>
          )}
        </button>
        <div className="h-40 md:hidden"></div>
      </form>
    </div>
  );
};

export default ObservationForm;
