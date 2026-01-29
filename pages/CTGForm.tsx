
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { Patient, CTG } from '../types';
import { ArrowLeft, Activity, Save, Calculator, AlertCircle, Info, Trash2 } from 'lucide-react';

const CTGForm: React.FC = () => {
  const { id, ctgId } = useParams<{ id: string, ctgId?: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));

  const [formData, setFormData] = useState({
    baseline: '',
    variability: '6-25',
    accelerations: 'Presentes',
    atMfRatio: '> 60% ou 2 AT 20 min',
    movements: 'Presentes',
    decelerations: 'Ausentes',
    decelerationType: '',
    decelerationCount: '',
    contractions: 'Ausentes',
    soundStimulus: 'Não Realizado',
    stimulusCount: '',
    notes: ''
  });

  const [calculatedScore, setCalculatedScore] = useState(0);
  const [suggestedConclusion, setSuggestedConclusion] = useState('');

  useEffect(() => {
    if (id) {
        patientService.getPatientById(id).then(p => {
            if (p) setPatient(p);
        });
    }
  }, [id]);

  // Load existing CTG data if in edit mode
  useEffect(() => {
    if (ctgId) {
        patientService.getCTGById(ctgId).then(ctg => {
            if (ctg) {
                const d = new Date(ctg.timestamp);
                // Adjust date string for input type="date" and "time"
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                
                setDate(`${y}-${m}-${day}`);
                setTime(d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));

                setFormData({
                    baseline: String(ctg.baseline),
                    variability: ctg.variability,
                    accelerations: ctg.accelerations,
                    atMfRatio: ctg.atMfRatio,
                    movements: ctg.movements,
                    decelerations: ctg.decelerations,
                    decelerationType: ctg.decelerationDetails?.type || '',
                    decelerationCount: ctg.decelerationDetails?.count || '',
                    contractions: ctg.contractions,
                    soundStimulus: ctg.soundStimulus,
                    stimulusCount: ctg.stimulusCount || '',
                    notes: ctg.notes || ''
                });
                // Set existing conclusion if editing
                setSuggestedConclusion(ctg.conclusion);
            }
        });
    }
  }, [ctgId]);

  // Scoring Logic based on image provided
  useEffect(() => {
      let score = 0;

      // 1. Linha de Base (110-160 = 1pt)
      const bpm = Number(formData.baseline);
      if (bpm >= 110 && bpm <= 160) score += 1;

      // 2. Variabilidade (6-25 = 1pt)
      if (formData.variability === '6-25') score += 1;

      // 3. Relação AT/MF (>60% = 2pt)
      if (formData.atMfRatio === '> 60% ou 2 AT 20 min') score += 2;

      // 4. Desacelerações (Ausentes = 1pt)
      if (formData.decelerations === 'Ausentes') score += 1;

      setCalculatedScore(score);

      // Only auto-suggest if NOT editing an existing record or if specifically desired.
      // For now, we update it dynamically based on score changes to help the user.
      // Note: If user manually changes the select, this effect will overwrite it if formData changes.
      // To prevent that, we could track if user manually touched the select, but simple logic is requested.
      if (!ctgId) {
          if (score >= 4) setSuggestedConclusion('Feto ativo');
          else if (score >= 2) setSuggestedConclusion('Feto Hipoativo');
          else setSuggestedConclusion('Feto inativo');
      }

  }, [formData, ctgId]);

  const handleChange = (name: string, value: string) => {
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || !patient) return;
      setIsSubmitting(true);

      const ctgPayload: Partial<CTG> = {
          patientId: id,
          timestamp: new Date(`${date}T${time}`).toISOString(),
          baseline: Number(formData.baseline),
          variability: formData.variability as any,
          accelerations: formData.accelerations as any,
          atMfRatio: formData.atMfRatio as any,
          movements: formData.movements as any,
          decelerations: formData.decelerations as any,
          decelerationDetails: formData.decelerations === 'Presentes' ? {
              type: formData.decelerationType as any,
              count: formData.decelerationCount
          } : undefined,
          contractions: formData.contractions as any,
          soundStimulus: formData.soundStimulus as any,
          stimulusCount: formData.soundStimulus === 'Realizado' ? formData.stimulusCount : undefined,
          score: calculatedScore,
          conclusion: suggestedConclusion,
          notes: formData.notes
      };

      try {
          if (ctgId) {
             await patientService.updateCTG(ctgId, ctgPayload);
          } else {
             // For creation, we need the full object, usually addCTG handles ID generation but better to follow pattern
             await patientService.addCTG({ ...ctgPayload, id: crypto.randomUUID() } as CTG);
          }
          navigate(`/patient/${id}`);
      } catch (error) {
          console.error(error);
          alert('Erro ao salvar CTG.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDelete = async () => {
      if (!ctgId || !id) return;
      if (confirm("Tem certeza que deseja excluir esta CTG? Esta ação não pode ser desfeita.")) {
          setIsSubmitting(true);
          try {
              await patientService.deleteCTG(ctgId);
              navigate(`/patient/${id}`);
          } catch (error) {
              console.error(error);
              alert("Erro ao excluir CTG.");
              setIsSubmitting(false);
          }
      }
  };

  if (!patient) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-4 px-4 sticky top-16 bg-slate-50 z-10 py-2">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-pink-600" />
                    {ctgId ? 'Editar Cardiotocografia' : 'Nova Cardiotocografia'}
                </h1>
                <p className="text-xs text-slate-500">{patient.name}</p>
            </div>
        </div>
        
        {ctgId && (
            <button 
                type="button" 
                onClick={handleDelete}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Excluir CTG"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="px-4 space-y-6">
        
        {/* Date/Time */}
        <div className="flex gap-4">
            <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora</label>
                <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm" />
            </div>
        </div>

        {/* --- PARAMETERS --- */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6">
            
            {/* 1. Linha de Base */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Linha de Base (BPM)</label>
                <div className="flex items-center gap-3">
                    <input 
                        type="number" 
                        placeholder="Ex: 140"
                        className="w-24 p-3 border border-slate-300 bg-white text-slate-900 rounded-lg text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-pink-500"
                        value={formData.baseline}
                        onChange={e => handleChange('baseline', e.target.value)}
                    />
                    <div className="text-xs text-slate-500 space-y-1">
                        <p className={Number(formData.baseline) < 110 && formData.baseline ? 'font-bold text-red-500' : ''}>&lt; 110 : 0 pontos</p>
                        <p className={Number(formData.baseline) >= 110 && Number(formData.baseline) <= 160 ? 'font-bold text-green-600' : ''}>110 - 160 : 1 ponto</p>
                        <p className={Number(formData.baseline) > 160 ? 'font-bold text-red-500' : ''}>&gt; 160 : 0 pontos</p>
                    </div>
                </div>
            </div>

            {/* 2. Variabilidade */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Variabilidade</label>
                <div className="flex flex-wrap gap-2">
                    {['Ausente', '< 5', '6-25', '> 25', 'Sinusoidal'].map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => handleChange('variability', opt)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                                formData.variability === opt 
                                ? 'bg-slate-800 text-white border-slate-900' 
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">6-25 bpm: 1 ponto. Outros: 0 pontos.</p>
            </div>

            {/* 3. Acelerações */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Acelerações Transitórias</label>
                <div className="flex gap-2 mb-3">
                    {['Ausentes', 'Presentes'].map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => handleChange('accelerations', opt)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                                formData.accelerations === opt
                                ? 'bg-pink-600 text-white border-pink-700 shadow-md'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
                
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Relação AT / MF</label>
                <select 
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                    value={formData.atMfRatio}
                    onChange={e => handleChange('atMfRatio', e.target.value)}
                >
                    <option value="< 60%">&lt; 60% (0 pontos)</option>
                    <option value="> 60% ou 2 AT 20 min">&gt; 60% ou 2 AT em 20 min (2 pontos)</option>
                </select>
            </div>

            {/* 4. Movimentação Fetal */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Movimentação Fetal</label>
                <div className="flex gap-2">
                    {['Ausentes', 'Presentes'].map(opt => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => handleChange('movements', opt)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                                formData.movements === opt
                                ? 'bg-slate-800 text-white border-slate-900 shadow-md'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>

            {/* 5. Desacelerações */}
            <div className="border-t border-slate-100 pt-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Desacelerações</label>
                <div className="flex gap-2 mb-3">
                    <button
                        type="button"
                        onClick={() => handleChange('decelerations', 'Ausentes')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                            formData.decelerations === 'Ausentes'
                            ? 'bg-slate-800 text-white border-slate-900 shadow-md'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Ausentes (1 ponto)
                    </button>
                    <button
                        type="button"
                        onClick={() => handleChange('decelerations', 'Presentes')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                            formData.decelerations === 'Presentes'
                            ? 'bg-red-600 text-white border-red-700 shadow-md'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        Presentes (0 pontos)
                    </button>
                </div>

                {formData.decelerations === 'Presentes' && (
                    <div className="bg-slate-50 p-3 rounded-lg space-y-3 animate-in fade-in">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Número de desacelerações</label>
                            <input 
                                type="text" 
                                placeholder="Ex: 3" 
                                className="w-full p-2 border border-slate-300 rounded-md text-sm"
                                value={formData.decelerationCount}
                                onChange={e => handleChange('decelerationCount', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label>
                            <div className="flex gap-2">
                                {['Precoce', 'Tardia', 'Variável'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleChange('decelerationType', type)}
                                        className={`flex-1 py-1.5 rounded border text-xs font-bold ${
                                            formData.decelerationType === type 
                                            ? 'bg-red-100 text-red-700 border-red-200' 
                                            : 'bg-white text-slate-500 border-slate-200'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Extras: Contrações e Estímulo */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contrações</label>
                    <div className="flex gap-1">
                        {['Ausentes', 'Presentes'].map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => handleChange('contractions', opt)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                                    formData.contractions === opt
                                    ? 'bg-slate-800 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Estímulo Sonoro</label>
                    <div className="flex gap-1">
                        {['Não Realizado', 'Realizado'].map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => handleChange('soundStimulus', opt)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                                    formData.soundStimulus === opt
                                    ? 'bg-slate-800 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {opt === 'Não Realizado' ? 'Não Realizado' : 'Realizado'}
                            </button>
                        ))}
                    </div>
                </div>
                {formData.soundStimulus === 'Realizado' && (
                    <div className="col-span-2">
                        <input 
                            type="text" 
                            placeholder="Nº de estímulos" 
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            value={formData.stimulusCount}
                            onChange={e => handleChange('stimulusCount', e.target.value)}
                        />
                    </div>
                )}
            </div>
        </div>

        {/* Conclusion Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Calculator className="w-24 h-24 text-blue-900" />
            </div>
            
            <div className="flex justify-between items-center mb-2 relative z-10">
                <span className="text-sm font-bold text-blue-800 uppercase">Pontuação Total</span>
                <span className="text-3xl font-bold text-blue-700">{calculatedScore} <span className="text-base font-normal text-blue-500">/ 5</span></span>
            </div>
            
            <div className="relative z-10">
                <label className="block text-xs font-bold text-blue-800 mb-1">Conclusão Sugerida</label>
                <select 
                    className="w-full p-3 border border-blue-200 rounded-lg text-lg font-bold text-blue-900 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={suggestedConclusion}
                    onChange={e => setSuggestedConclusion(e.target.value)}
                >
                    <option value="Feto ativo">Feto ativo</option>
                    <option value="Feto Hipoativo">Feto Hipoativo</option>
                    <option value="Feto inativo">Feto inativo</option>
                    <option disabled>---</option>
                    <option value="Reativo">Reativo</option>
                    <option value="Hiporreativo">Hiporreativo</option>
                    <option value="Não reativo">Não reativo</option>
                    <option value="Bifásico">Bifásico</option>
                </select>
                <div className="mt-2 flex gap-1 items-start text-[10px] text-blue-600 bg-white/50 p-2 rounded">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    <p>
                        4-5 pts: Ativo<br/>
                        2-3 pts: Hipoativo<br/>
                        0-1 pt: Inativo
                    </p>
                </div>
            </div>
        </div>

        {/* Notes */}
        <div>
           <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Observações (Opcional)</label>
           <textarea 
             name="notes" 
             className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors" 
             rows={2} 
             placeholder="Detalhes adicionais..."
             value={formData.notes}
             onChange={e => handleChange('notes', e.target.value)}
           />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isSubmitting ? 'Salvando...' : <><Save className="w-5 h-5" /> Salvar CTG</>}
        </button>
      </form>
    </div>
  );
};

export default CTGForm;
