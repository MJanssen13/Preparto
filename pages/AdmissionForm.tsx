
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { PatientStatus, ScheduledTask } from '../types';
import { ArrowLeft, CalendarClock, Zap, Plus, Pill, Beaker, Check, Settings2, Trash2, Power, StopCircle, Baby } from 'lucide-react';

// Added 'Dinâmica'
const PARAM_OPTIONS = ['BCF', 'Dinâmica', 'PA', 'FC', 'Medicação', 'Toque', 'Reflexo', 'Diurese', 'FR', 'Sat', 'TAX', 'DXT'];

interface TimeSlot {
  time: Date;
  selectedParams: string[];
}

const AdmissionForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    babyName: '',
    bed: '',
    age: '',
    weeks: '',
    days: '',
    parity: '',
    bloodType: 'O+',
    riskFactors: '',
    useMethyldopa: false,
    useMagnesiumSulfate: false
  });
  
  // New Schedule Grid State
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Preset State
  const [presetParam, setPresetParam] = useState<string>('BCF');
  const [presetInterval, setPresetInterval] = useState<number>(60);

  // Initialize slots on mount
  useEffect(() => {
    generateInitialSlots();
  }, []);

  const generateInitialSlots = () => {
    const now = new Date();
    const start = new Date(now);
    start.setSeconds(0, 0);

    // 1. Snap to previous hour or half-hour
    const minutes = start.getMinutes();
    if (minutes < 30) {
      start.setMinutes(0);
    } else {
      start.setMinutes(30);
    }

    // 2. Determine Shift End (07:00 or 19:00)
    const currentHour = start.getHours();
    let endTime = new Date(start);
    endTime.setMinutes(0, 0, 0);

    if (currentHour >= 7 && currentHour < 19) {
      // Day Shift -> End at 19:00 today
      endTime.setHours(19);
    } else {
      // Night Shift -> End at 07:00
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

  const handleToggleProtocol = (type: 'methyldopa' | 'magnesium') => {
      if (type === 'methyldopa') {
          setFormData(prev => ({ ...prev, useMethyldopa: !prev.useMethyldopa }));
      } else {
          setFormData(prev => {
              const newState = !prev.useMagnesiumSulfate;
              if (newState) {
                  applyPreset(60, ['PA', 'Reflexo', 'Diurese', 'FR']);
              }
              return { ...prev, useMagnesiumSulfate: newState };
          });
      }
  };

  const handleClearSchedule = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o cronograma? Isso removerá todas as marcações.')) {
        setTimeSlots(prev => prev.map(slot => ({
            ...slot,
            selectedParams: []
        })));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Convert active slots to ScheduledTasks
    const schedule: ScheduledTask[] = timeSlots
      .filter(slot => slot.selectedParams.length > 0)
      .map(slot => ({
        id: crypto.randomUUID(),
        timestamp: slot.time.toISOString(),
        focus: slot.selectedParams,
        status: 'pending'
      }));

    const nowIso = new Date().toISOString();

    try {
      await patientService.createPatient({
        name: formData.name,
        babyName: formData.babyName,
        bed: formData.bed,
        age: Number(formData.age),
        gestationalAgeWeeks: Number(formData.weeks),
        gestationalAgeDays: Number(formData.days),
        parity: formData.parity,
        status: PatientStatus.ACTIVE_LABOR,
        admissionDate: nowIso,
        bloodType: formData.bloodType,
        riskFactors: formData.riskFactors ? formData.riskFactors.split(',').map(s => s.trim()) : [],
        
        // Protocol Logic
        useMethyldopa: formData.useMethyldopa,
        methyldopaStartTime: formData.useMethyldopa ? nowIso : undefined,
        
        useMagnesiumSulfate: formData.useMagnesiumSulfate,
        magnesiumSulfateStartTime: formData.useMagnesiumSulfate ? nowIso : undefined,

        schedule: schedule
      });
      navigate('/');
    } catch (error) {
      console.error(error);
      alert('Erro ao admitir paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Admissão de Paciente</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        
        {/* Bed Number */}
        <div>
           <label className="block text-sm font-bold text-slate-700 mb-1">Número do Leito</label>
           <input
             required
             name="bed"
             type="text"
             placeholder="Ex: 01"
             className="w-full p-4 border border-slate-300 rounded-lg text-2xl font-bold text-medical-600 bg-white focus:ring-2 focus:ring-medical-500 focus:outline-none"
             value={formData.bed}
             onChange={handleChange}
           />
        </div>

        {/* Identification */}
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

        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Baby className="w-4 h-4" /> Nome do Bebê (Opcional)
            </label>
            <input
                name="babyName"
                type="text"
                placeholder="Ex: Maria"
                className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none"
                value={formData.babyName}
                onChange={handleChange}
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Idade</label>
            <input required name="age" type="number" className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.age} onChange={handleChange} />
          </div>
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Sang.</label>
             <select name="bloodType" value={formData.bloodType} onChange={handleChange} className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none">
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
             </select>
          </div>
        </div>

        {/* Obstetrics Info */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
          <div className="col-span-2 font-medium text-slate-700 text-sm">Idade Gestacional</div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Semanas</label>
            <input required name="weeks" type="number" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.weeks} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dias</label>
            <input required name="days" type="number" className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.days} onChange={handleChange} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Paridade</label>
            <input required name="parity" placeholder="G1P0A0" className="w-full p-2 border border-slate-300 rounded-lg uppercase bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" value={formData.parity} onChange={handleChange} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Comorbidades</label>
            <textarea 
              name="riskFactors" 
              placeholder="Ex: HAS, Diabetes, etc..." 
              className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none h-20 bg-white text-slate-900 focus:ring-2 focus:ring-medical-500 focus:outline-none" 
              value={formData.riskFactors} 
              onChange={handleChange} 
            />
          </div>
          
          {/* PROTOCOLS CARDS */}
          <div className="col-span-2 pt-2 border-t border-slate-200 space-y-3">
             <label className="block text-xs font-bold text-slate-500 uppercase">Protocolos Iniciais</label>
             
             {/* Methyldopa Card */}
             <div className={`p-4 rounded-xl border transition-all ${formData.useMethyldopa ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
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
                           {formData.useMethyldopa ? <><StopCircle className="w-3 h-3" /> Remover</> : <><Power className="w-3 h-3" /> Iniciar</>}
                       </button>
                   </div>
                   <p className="text-[10px] text-slate-500 leading-tight">
                       Habilita campos para coleta de PA sentada e em pé nas evoluções.
                   </p>
            </div>

            {/* Magnesium Card */}
            <div className={`p-4 rounded-xl border transition-all ${formData.useMagnesiumSulfate ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
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
                           {formData.useMagnesiumSulfate ? <><StopCircle className="w-3 h-3" /> Remover</> : <><Power className="w-3 h-3" /> Iniciar</>}
                       </button>
                   </div>
                   <p className="text-[10px] text-slate-500 leading-tight">
                       Habilita campos de neuroproteção. <span className="text-purple-600 font-bold">*Ao iniciar, a rotina de 1h em 1h será aplicada automaticamente abaixo.</span>
                   </p>
            </div>
          </div>
        </div>

        {/* SCHEDULE GRID */}
        <div className="border-t border-slate-200 pt-6 mt-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-medical-600" />
                    Cronograma de Aferições
                </h3>
            </div>
            
            {/* NOVO: Gerador de Rotina Rápida (Sem scroll horizontal) */}
            <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-200">
               <div className="flex items-center gap-2 mb-3">
                  <Settings2 className="w-4 h-4 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Gerador de Rotina</h4>
               </div>

               <div className="flex flex-col gap-4">
                  
                  {/* Passo 1: Escolher Parâmetro */}
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

                  {/* Passo 2: Frequencia e Botão */}
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
                          title="Limpar Cronograma"
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
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-96 overflow-y-auto">
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
                             // Simple styling distinction for Mg params
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
            <p className="text-[10px] text-slate-400 mt-2 text-center">Cronograma ajustado automaticamente ao plantão (07:00 / 19:00)</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-medical-600 text-white font-bold py-4 rounded-xl shadow hover:bg-medical-700 transition-colors disabled:opacity-50 mt-6"
        >
          {isSubmitting ? 'Salvando...' : 'Admitir e Iniciar'}
        </button>
      </form>
    </div>
  );
};

export default AdmissionForm;
