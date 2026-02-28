
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Patient, Observation, PatientStatus, CTG } from '../types';
import { patientService } from '../services/supabaseService';
import { ArrowLeft, Plus, Droplets, Thermometer, Activity, Pill, Clock, BedDouble, CircleDot, Edit2, Beaker, Hammer, Wind, Waves, CheckCircle2, Droplet, Baby, Scissors, Archive, RotateCcw, X, CalendarClock, HeartPulse, FileText, Copy } from 'lucide-react';
import { VitalCharts } from '../components/VitalCharts';

const PatientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [ctgs, setCtgs] = useState<CTG[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Prontuario Text State
  const [prontuarioText, setProntuarioText] = useState('');
  
  // Resolution Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Resolution Date/Time State
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('');

  useEffect(() => {
    if (id) loadData(id);
    
    // Init resolution time to now
    const now = new Date();
    setResDate(now.toISOString().split('T')[0]);
    setResTime(now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
  }, [id]);

  const loadData = async (patientId: string) => {
    setLoading(true);
    const p = await patientService.getPatientById(patientId);
    if (p) {
        setPatient(p);
        setObservations(p.observations || []);
        setCtgs(p.ctgs || []);
    }
    setLoading(false);
  };

  // --- PRONTUÁRIO TEXT GENERATION ---
  const generateProntuarioText = (p: Patient, obsList: Observation[], ctgList: CTG[]) => {
      const sortedObs = [...obsList].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      let text = '';
      let lastDate = '';

      // Helper helper for Toque inside generator
      const getToqueText = (o: Observation['obstetric']) => {
          const parts = [];
          
          // 1. Apagamento
          if (o.effacement !== undefined) parts.push(o.effacement === 0 ? 'G' : `${o.effacement}% AP`);
          
          // 2. Posição do Colo
          const posMap: Record<string, string> = { 'Posterior': 'P', 'Intermediário': 'I', 'Central': 'C' };
          if (o.cervixPosition && posMap[o.cervixPosition]) parts.push(posMap[o.cervixPosition]);
          
          // 3. Consistência
          const conMap: Record<string, string> = { 'Nasal': 'N', 'Nasolabial': 'NL', 'Labial': 'L' };
          if (o.cervixConsistency && conMap[o.cervixConsistency]) parts.push(conMap[o.cervixConsistency]);
          
          // 4. Dilatação
          if (o.dilation !== undefined && o.dilation > 0) parts.push(`${o.dilation}CM`);
          else if (o.cervixStatus && o.cervixStatus.length > 0) parts.push(o.cervixStatus.join(', '));
          else if (o.dilation === 0) parts.push('0CM');

          // 5. Apresentação
          const fetalMap: Record<string, string> = { 'Cefálico': 'CEF', 'Pélvico': 'PELV', 'Córmico': 'CORM' };
          if (o.fetalPosition && fetalMap[o.fetalPosition]) parts.push(fetalMap[o.fetalPosition]);

          // 6. De Lee
          if (o.station !== undefined) {
               if (o.station === -4) parts.push('AM');
               else parts.push(`DE LEE ${o.station > 0 ? '+' : ''}${o.station}`);
          }
          
          // 7. Bolsa
          if (o.membranes) parts.push(o.membranes.toUpperCase());

          // 8. SDL
          if (o.bloodOnGlove !== undefined) parts.push(o.bloodOnGlove ? 'SDL' : 'SSDL');
          
          if (o.cervixObservation) parts.push(`OBS: ${o.cervixObservation}`);
          
          return parts.length > 0 ? `TOQUE: ${parts.join(', ')}` : '';
      };

      sortedObs.forEach(o => {
          const dateObj = new Date(o.timestamp);
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = String(dateObj.getFullYear()).slice(-2);
          const dateStr = `${day}/${month}/${year}`;

          if (dateStr !== lastDate) {
              text += `# ${dateStr} #\n`;
              lastDate = dateStr;
          }

          const time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const lineParts = [`${time} HS`];
          
          if (o.obstetric.bcf) lineParts.push(`BCF: ${o.obstetric.bcf} BPM`);
          if (o.vitals.paSystolic) lineParts.push(`PA: ${o.vitals.paSystolic}X${o.vitals.paDiastolic} MMHG`);
          
          if (o.obstetric.dinamicaSummary) lineParts.push(`DU ${o.obstetric.dinamicaSummary.toUpperCase()}`);
          else if (o.obstetric.dinamicaFrequency) lineParts.push(`DU ${o.obstetric.dinamicaFrequency}/10'`);
          
          const toqueStr = getToqueText(o.obstetric);
          if (toqueStr) lineParts.push(toqueStr);
          
          if (o.vitals.dxt) lineParts.push(`DXT: ${o.vitals.dxt} MG/DL`);

          if (o.medication?.misoprostolDose) {
              const countStr = o.medication.misoprostolCount ? `${o.medication.misoprostolCount}º ` : '';
              lineParts.push(`${countStr}MISO ${o.medication.misoprostolDose}MCG`);
          }
          if (o.medication?.oxytocinDose) lineParts.push(`OCITOCINA ${o.medication.oxytocinDose} ML/H`);

          if (o.magnesiumData) {
              if (o.magnesiumData.diuresis) lineParts.push(`DIURESE ${o.magnesiumData.diuresis}`);
              if (o.magnesiumData.reflex) lineParts.push(`REFLEXO ${o.magnesiumData.reflex.toUpperCase()}`);
          }
          
          if (o.notes) lineParts.push(o.notes.toUpperCase());
          
          text += lineParts.join(' | ') + '\n';
      });

      if (ctgList && ctgList.length > 0) {
          text += '\n--- CARDIOTOCOGRAFIAS ---\n';
          const sortedCtgs = [...ctgList].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          sortedCtgs.forEach(ctg => {
              const d = new Date(ctg.timestamp);
              const dateStr = d.toLocaleDateString('pt-BR');
              const timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
              text += `[${dateStr} ${timeStr}] CTG: LB ${ctg.baseline}BPM | VARIAB: ${ctg.variability.toUpperCase()} | AT/MF: ${ctg.atMfRatio.replace('<', 'MENOR ').replace('>', 'MAIOR ').toUpperCase()} | DESC: ${ctg.decelerations.toUpperCase()} | SCORE: ${ctg.score}/5 (${ctg.conclusion.toUpperCase()})`;
              if (ctg.notes) text += ` | OBS: ${ctg.notes.toUpperCase()}`;
              text += '\n';
          });
      }

      if (p.status === PatientStatus.PARTOGRAM_OPENED) {
          text += "\nABERTO PARTOGRAMA E MANTIDO DEMAIS PARÂMETROS REGISTRADOS EM PARTOGRAMA.";
      } else if (p.status === PatientStatus.DELIVERY) {
          text += "\nEVOLUIU PARA PARTO NORMAL.";
      } else if (p.status === PatientStatus.C_SECTION) {
          text += "\nENCAMINHADA PARA CESÁREA.";
      } else if (p.status === PatientStatus.DISCHARGED) {
          text += "\nALTA / TRANSFERÊNCIA.";
      }

      return text;
  };

  // Sync text when data changes (e.g. deletion)
  useEffect(() => {
      if (patient) {
          const text = generateProntuarioText(patient, observations, ctgs);
          setProntuarioText(text);
      }
  }, [patient, observations, ctgs]);

  const copyProntuarioToClipboard = () => {
      navigator.clipboard.writeText(prontuarioText);
      alert('Texto copiado para a área de transferência!');
  };

  const handleResolution = async (status: PatientStatus) => {
      if (!patient || !id) return;
      setIsProcessing(true);

      try {
          // Construct the final timestamp
          let finalTimestamp: string | undefined = undefined;
          if (resDate && resTime) {
             finalTimestamp = new Date(`${resDate}T${resTime}`).toISOString();
          }

          await patientService.resolvePatient(id, status, finalTimestamp);
          await loadData(id);
          setShowResolveModal(false);
          
      } catch (error: any) {
          console.error("Erro ao resolver paciente:", error);
          const errorMessage = error.message || 'Erro desconhecido';
          alert(`Erro: ${errorMessage}`);
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleReopen = async () => {
      if (!patient || !id) return;
      if (!confirm("Deseja reabrir este prontuário? O paciente voltará para a lista de ativos e o status mudará para Trabalho de Parto Ativo.")) return;
      
      setIsProcessing(true);
      try {
          await patientService.reopenPatient(id);
          await loadData(id);
      } catch (error: any) {
          console.error("Erro ao reabrir:", error);
          alert("Erro ao reabrir prontuário.");
      } finally {
          setIsProcessing(false);
      }
  };

  const formatToqueVaginal = (o: Observation['obstetric']) => {
      const parts = [];

      // Apagamento
      if (o.effacement !== undefined) {
          parts.push(o.effacement === 0 ? 'G' : `${o.effacement}% AP`);
      }

      // Posição
      const posMap: Record<string, string> = { 'Posterior': 'P', 'Intermediário': 'I', 'Central': 'C' };
      if (o.cervixPosition && posMap[o.cervixPosition]) parts.push(posMap[o.cervixPosition]);

      // Consistência
      const conMap: Record<string, string> = { 'Nasal': 'N', 'Nasolabial': 'NL', 'Labial': 'L' };
      if (o.cervixConsistency && conMap[o.cervixConsistency]) parts.push(conMap[o.cervixConsistency]);

      // Dilatação
      if (o.dilation !== undefined && o.dilation > 0) {
          parts.push(`${o.dilation}CM`);
      } else if (o.cervixStatus && o.cervixStatus.length > 0) {
          parts.push(o.cervixStatus.join(', '));
      } else if (o.dilation === 0) {
          parts.push('0CM');
      }

      // Station / De Lee
      if (o.station !== undefined) {
          if (o.station === -4) {
              parts.push('AM'); // Alto e Móvel
          } else {
              parts.push(`De Lee ${o.station > 0 ? '+' : ''}${o.station}`);
          }
      }

      // Fetal Position (Apresentação)
      if (o.fetalPosition) {
          parts.push(o.fetalPosition);
      }

      // Sangue
      if (o.bloodOnGlove !== undefined) {
          parts.push(o.bloodOnGlove ? 'SDL' : 'SSDL');
      }
      
      // Observação extra
      if (o.cervixObservation) {
          parts.push(`Obs: ${o.cervixObservation}`);
      }

      return parts.length > 0 ? parts.join(', ') : null;
  };

  if (loading) return <div className="p-8 text-center">Carregando dados...</div>;
  if (!patient) return <div className="p-8 text-center text-red-500">Paciente não encontrado</div>;

  const isResolved = [PatientStatus.DISCHARGED, PatientStatus.PARTOGRAM_OPENED, PatientStatus.DELIVERY, PatientStatus.C_SECTION].includes(patient.status);
  
  // Display Status Helpers
  let statusIcon = <CheckCircle2 className="w-5 h-5" />;
  let statusText: string = patient.status;
  let statusColor = "bg-slate-50 border-slate-200 text-slate-600";
  
  if (patient.status === PatientStatus.PARTOGRAM_OPENED) {
      statusColor = "bg-green-50 border-green-200 text-green-800";
      statusText = "Partograma Aberto";
  } else if (patient.status === PatientStatus.DELIVERY) {
      statusColor = "bg-teal-50 border-teal-200 text-teal-800";
      statusIcon = <Baby className="w-5 h-5" />;
      statusText = "Parto Normal";
  } else if (patient.status === PatientStatus.C_SECTION) {
      statusColor = "bg-indigo-50 border-indigo-200 text-indigo-800";
      statusIcon = <Scissors className="w-5 h-5" />;
      statusText = "Cesárea";
  }

  // Pending tasks
  const pendingTasks = (patient.schedule || [])
    .filter(t => t.status === 'pending')
    .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Merge and Sort Timeline Items (Observations + CTGs)
  const timelineItems = [
      ...observations.map(o => ({ type: 'obs', data: o, time: new Date(o.timestamp).getTime() })),
      ...ctgs.map(c => ({ type: 'ctg', data: c, time: new Date(c.timestamp).getTime() }))
  ].sort((a, b) => b.time - a.time);

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${isResolved ? 'bg-slate-200 text-slate-600' : 'bg-medical-100 text-medical-700'}`}>
                    <BedDouble className="w-3 h-3" /> Leito {patient.bed}
                </span>
                <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
                
                <Link to={`/patient/${id}/edit`} className="text-slate-400 hover:text-medical-600 p-1">
                    <Edit2 className="w-4 h-4" />
                </Link>
            </div>
            
            {patient.babyName && (
                <p className="text-xs text-slate-600 font-medium flex items-center gap-1">
                    <Baby className="w-3 h-3" /> Bebê: {patient.babyName}
                </p>
            )}

            <p className="text-sm text-slate-500 mt-1">
              {patient.parity} • {patient.gestationalAgeWeeks}s+{patient.gestationalAgeDays}d
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
                {/* Protocols Badges */}
                {patient.useMethyldopa && (
                    <span className="text-[10px] bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded-full font-bold border border-blue-100 flex items-center gap-1">
                        <Pill className="w-3 h-3" /> Metildopa
                    </span>
                )}
                {patient.useMagnesiumSulfate && (
                    <span className="text-[10px] bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded-full font-bold border border-purple-100 flex items-center gap-1">
                        <Beaker className="w-3 h-3" /> MgSO4
                    </span>
                )}
            </div>
          </div>
        </div>
        
        {!isResolved ? (
             <button 
                onClick={() => {
                    const now = new Date();
                    setResDate(now.toISOString().split('T')[0]);
                    setResTime(now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
                    setShowResolveModal(true);
                }}
                className="flex flex-col items-center justify-center p-2 text-medical-700 bg-medical-50 hover:bg-medical-100 rounded-lg border border-medical-200 transition-colors shadow-sm"
             >
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-[10px] font-bold">Desfecho</span>
             </button>
        ) : (
             <button
                onClick={handleReopen}
                disabled={isProcessing}
                className="flex flex-col items-center justify-center p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors shadow-sm disabled:opacity-50"
             >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[10px] font-bold">Reabrir</span>
             </button>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="flex gap-2">
          {!isResolved && (
            <Link 
              to={`/patient/${id}/add-observation`}
              className="flex-1 bg-medical-600 hover:bg-medical-700 text-white shadow-md rounded-xl p-3 flex items-center justify-center gap-2 transition-all font-bold text-sm"
            >
              <Plus className="w-5 h-5" />
              Nova Evolução
            </Link>
          )}
          
          <Link
            to={`/patient/${id}/ctg`}
            className="flex-1 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 shadow-sm rounded-xl p-3 flex items-center justify-center gap-2 transition-all font-bold text-sm"
          >
            <Activity className="w-5 h-5" />
            Nova CTG
          </Link>
          
          <Link
            to={`/patient/${id}/partogram`}
            className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm rounded-xl p-3 flex items-center justify-center gap-2 transition-all font-bold text-sm"
          >
            <FileText className="w-5 h-5" />
            Abrir Partograma
          </Link>
      </div>

      {/* RESOLUTION MODAL */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
             <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-200">
                 <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                     <h3 className="font-bold text-slate-800">Definir Desfecho</h3>
                     <button onClick={() => setShowResolveModal(false)} className="p-1 rounded-full hover:bg-slate-100">
                         <X className="w-5 h-5 text-slate-400" />
                     </button>
                 </div>
                 
                 <div className="p-4 space-y-3">
                     {/* Date/Time Picker Block */}
                     <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" /> Data e Hora do Ocorrido
                        </label>
                        <div className="flex gap-3">
                            <input 
                                type="date" 
                                value={resDate} 
                                onChange={e => setResDate(e.target.value)}
                                className="flex-1 p-2 border border-slate-300 rounded text-sm bg-white font-bold text-slate-700"
                            />
                            <input 
                                type="time" 
                                value={resTime}
                                onChange={e => setResTime(e.target.value)}
                                className="w-24 p-2 border border-slate-300 rounded text-sm bg-white font-bold text-slate-700"
                            />
                        </div>
                     </div>

                     <p className="text-xs text-slate-500 mb-2">Selecione o tipo de resolução:</p>
                     
                     <button 
                        disabled={isProcessing}
                        onClick={() => handleResolution(PatientStatus.DELIVERY)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors"
                     >
                         <div className="bg-teal-200 p-2 rounded-full"><Baby className="w-5 h-5 text-teal-700" /></div>
                         <div className="text-left">
                             <div className="font-bold">Parto Normal</div>
                             <div className="text-[10px] opacity-80">Encerra monitoramento</div>
                         </div>
                     </button>

                     <button 
                        disabled={isProcessing}
                        onClick={() => handleResolution(PatientStatus.C_SECTION)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 transition-colors"
                     >
                         <div className="bg-indigo-200 p-2 rounded-full"><Scissors className="w-5 h-5 text-indigo-700" /></div>
                         <div className="text-left">
                             <div className="font-bold">Cesárea</div>
                             <div className="text-[10px] opacity-80">Encerra monitoramento</div>
                         </div>
                     </button>

                     <button 
                        disabled={isProcessing}
                        onClick={() => handleResolution(PatientStatus.PARTOGRAM_OPENED)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-800 transition-colors"
                     >
                         <div className="bg-green-200 p-2 rounded-full"><CheckCircle2 className="w-5 h-5 text-green-700" /></div>
                         <div className="text-left">
                             <div className="font-bold">Partograma Aberto</div>
                             <div className="text-[10px] opacity-80">Monitoramento migrado para papel</div>
                         </div>
                     </button>

                     <button 
                        disabled={isProcessing}
                        onClick={() => handleResolution(PatientStatus.DISCHARGED)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                     >
                         <div className="bg-slate-200 p-2 rounded-full"><Archive className="w-5 h-5 text-slate-600" /></div>
                         <div className="text-left">
                             <div className="font-bold">Alta / Transferência</div>
                             <div className="text-[10px] opacity-80">Remove da lista ativa</div>
                         </div>
                     </button>
                 </div>
             </div>
        </div>
      )}

      {/* Resolved Banner */}
      {isResolved && (
          <div className={`border p-4 rounded-xl flex items-center gap-3 ${statusColor}`}>
              {statusIcon}
              <div className="text-sm">
                  <p className="font-bold">{statusText}</p>
                  <p className="text-xs opacity-80">
                      Data: {new Date(patient.dischargeTime || '').toLocaleString()}
                      <br/>
                      Cronograma futuro cancelado automaticamente.
                  </p>
              </div>
          </div>
      )}

      {/* Next Observations List (Only if not resolved) */}
      {!isResolved && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 relative overflow-hidden">
           <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                <Clock className="w-4 h-4" />
                Próximas Avaliações
              </div>
              <Link 
                 to={`/patient/${id}/new-schedule`}
                 className="text-[10px] bg-white text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200 font-bold shadow-sm transition-colors flex items-center gap-1"
              >
                 <Plus className="w-3 h-3" /> Nova Rotina
              </Link>
           </div>
           
           {pendingTasks.length > 0 ? (
              <div className="space-y-2">
                 {pendingTasks.slice(0, 3).map(task => (
                   <Link 
                     key={task.id} 
                     to={`/patient/${id}/add-observation?taskId=${task.id}`}
                     className="flex justify-between items-center bg-white/60 p-2 rounded-lg border border-blue-100 hover:bg-white hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                   >
                      <div className="font-bold text-slate-700">
                        {new Date(task.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div className="flex gap-1">
                         {task.focus.map(f => (
                             <span key={f} className="text-[10px] bg-white border border-blue-200 text-blue-600 px-1.5 py-0.5 rounded">
                                 {f}
                             </span>
                         ))}
                      </div>
                   </Link>
                 ))}
                 {pendingTasks.length > 3 && (
                     <div className="text-center text-xs text-blue-400 font-medium pt-1">
                         + {pendingTasks.length - 3} agendadas
                     </div>
                 )}
              </div>
           ) : (
              <div className="text-center py-2 text-xs text-blue-400 italic">
                  Nenhuma avaliação agendada.
              </div>
           )}
        </div>
      )}

      {/* Risk Factors Banner */}
      {patient.riskFactors && patient.riskFactors.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex flex-wrap gap-2">
          <span className="text-xs font-bold text-red-700 uppercase tracking-wide mr-2 py-1">Atenção:</span>
          {patient.riskFactors.map(rf => (
            <span key={rf} className="bg-white px-2 py-0.5 rounded border border-red-200 text-xs text-red-700 font-medium">
              {rf}
            </span>
          ))}
        </div>
      )}

      {/* Charts Section */}
      <VitalCharts observations={observations} />

      {/* Copiar para Prontuário Section - EDITABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Copiar para Prontuário
              </h4>
              <button 
                  onClick={copyProntuarioToClipboard}
                  className="text-xs bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded border border-slate-200 flex items-center gap-1 transition-colors font-medium shadow-sm"
              >
                  <Copy className="w-3 h-3" /> Copiar Texto
              </button>
          </div>
          <textarea 
              value={prontuarioText}
              onChange={(e) => setProntuarioText(e.target.value)}
              className="w-full h-32 p-3 text-xs font-mono text-slate-700 resize-y focus:outline-none focus:bg-slate-50 transition-colors"
              placeholder="Aguardando dados..."
          />
      </div>

      {/* Timeline Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-slate-700">Evolução Clínica</h3>
          <div className="flex gap-2">
            <Link 
              to={`/patient/${id}/bulk-edit-observations`}
              className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-700 font-bold bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded transition-colors border border-slate-200"
            >
              <Edit2 className="w-3 h-3" /> Editar Lote
            </Link>
            <Link 
              to={`/patient/${id}/bulk-observations`}
              className="text-xs flex items-center gap-1 text-medical-600 hover:text-medical-700 font-bold bg-medical-50 hover:bg-medical-100 px-2 py-1 rounded transition-colors"
            >
              <Plus className="w-3 h-3" /> Adicionar Lote
            </Link>
          </div>
        </div>
        {timelineItems.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white rounded-xl">
            Nenhuma observação registrada.
          </div>
        ) : (
          timelineItems.map((item, idx) => {
             // RENDER CTG CARD
             if (item.type === 'ctg') {
                 const ctg = item.data as CTG;
                 return (
                    <div key={`ctg-${ctg.id}`} className="bg-pink-50 rounded-xl border border-pink-100 shadow-sm p-4 relative group animate-in fade-in">
                         <div className="absolute top-4 right-4 flex items-center gap-3">
                             <div className="flex flex-col items-end">
                                 <span className="text-[10px] font-bold text-pink-400 uppercase">
                                     {new Date(ctg.timestamp).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                                 </span>
                                 <span className="text-xl font-bold text-pink-700 tracking-tight">
                                     {new Date(ctg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </span>
                             </div>
                             <Link 
                                to={`/patient/${id}/edit-ctg/${ctg.id}`}
                                className="p-1.5 text-pink-300 hover:text-pink-600 hover:bg-pink-100 rounded-full transition-colors"
                             >
                                 <Edit2 className="w-4 h-4" />
                             </Link>
                         </div>
                         
                         <div className="flex items-center gap-2 mb-3">
                             <div className="bg-pink-100 p-1.5 rounded-lg">
                                <HeartPulse className="w-4 h-4 text-pink-600" />
                             </div>
                             <span className="text-xs font-bold uppercase text-pink-700">Cardiotocografia</span>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                             <div className="flex flex-col">
                                 <span className="text-[10px] text-pink-400 uppercase">Linha de Base</span>
                                 <span className="font-bold text-pink-900">{ctg.baseline} bpm</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-[10px] text-pink-400 uppercase">Variabilidade</span>
                                 <span className="font-bold text-pink-900">{ctg.variability}</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-[10px] text-pink-400 uppercase">Desacelerações</span>
                                 <span className={`font-bold ${ctg.decelerations === 'Presentes' ? 'text-red-500' : 'text-pink-900'}`}>
                                     {ctg.decelerations} 
                                     {ctg.decelerations === 'Presentes' && ctg.decelerationDetails && (
                                         <span className="text-xs font-normal text-red-400 block">
                                             ({ctg.decelerationDetails.count}x {ctg.decelerationDetails.type})
                                         </span>
                                     )}
                                 </span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-[10px] text-pink-400 uppercase">Pontuação</span>
                                 <span className="font-bold text-pink-900">{ctg.score}/5</span>
                             </div>
                             
                             <div className="col-span-2 pt-2 border-t border-pink-100">
                                 <span className="text-[10px] text-pink-400 uppercase block mb-1">Conclusão</span>
                                 <span className="font-bold text-pink-800 bg-white/50 px-2 py-1 rounded block w-fit">
                                     {ctg.conclusion}
                                 </span>
                             </div>
                             
                             {ctg.notes && (
                                <div className="col-span-2 text-xs text-pink-600 italic mt-1">
                                    "{ctg.notes}"
                                </div>
                             )}
                         </div>
                    </div>
                 );
             }

             // RENDER OBSERVATION CARD
             const obs = item.data as Observation;
             const isBcfAbnormal = obs.obstetric.bcf !== undefined && (obs.obstetric.bcf < 110 || obs.obstetric.bcf > 160);
             const toqueString = formatToqueVaginal(obs.obstetric);

             // Verificar se há dados de magnésio válidos (não vazios)
             const hasMagnesiumData = obs.magnesiumData && (
                obs.magnesiumData.reflex || 
                (obs.magnesiumData.diuresis && obs.magnesiumData.diuresis.trim() !== '') || 
                obs.magnesiumData.respiratoryRate !== undefined
             );

             return (
              <div key={`obs-${obs.id}`} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative group">
                 <div className="absolute top-4 right-4 flex items-center gap-3">
                   <div className="flex flex-col items-end">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">
                       {new Date(obs.timestamp).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                     </span>
                     <span className="text-xl font-bold text-slate-700 tracking-tight">
                       {new Date(obs.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </span>
                   </div>
                   {/* Allow editing observations even if resolved, for correction */}
                   <Link 
                    to={`/patient/${id}/edit-observation/${obs.id}`}
                    className="p-1.5 text-slate-300 hover:text-medical-600 hover:bg-slate-50 rounded-full transition-colors"
                   >
                     <Edit2 className="w-4 h-4" />
                   </Link>
                 </div>

                 <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                    {/* Obstetric Data */}
                    <div className="col-span-2 grid grid-cols-3 gap-2 pb-3 border-b border-slate-100">
                       <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase">Dilatação</span>
                          <span className="font-bold text-lg text-medical-600">
                              {obs.obstetric.dilation !== undefined ? `${obs.obstetric.dilation} cm` : 
                               (obs.obstetric.cervixStatus && obs.obstetric.cervixStatus.length > 0 ? obs.obstetric.cervixStatus[0] : '-')}
                          </span>
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase">BCF</span>
                          <span className={`font-bold text-lg ${isBcfAbnormal ? 'text-red-600' : 'text-obs-500'}`}>
                              {obs.obstetric.bcf !== undefined ? `${obs.obstetric.bcf} ` : '- '} 
                              {obs.obstetric.bcf !== undefined && <span className="text-xs text-slate-400 font-normal">bpm</span>}
                          </span>
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase">Dinâmica</span>
                          <div className="font-bold text-lg text-slate-700 leading-tight">
                              {obs.obstetric.dinamicaSummary ? (
                                  <span className="text-xs font-bold block mt-1">DU: {obs.obstetric.dinamicaSummary}</span>
                              ) : (
                                  <span>{obs.obstetric.dinamicaFrequency !== undefined ? `DU: ${obs.obstetric.dinamicaFrequency}/10'` : '-'}</span>
                              )}
                          </div>
                       </div>
                    </div>

                    {/* Vitals */}
                    <div className="col-span-2 text-sm text-slate-600 pt-1">
                      <div className="flex flex-col gap-1">
                        {/* PA Block */}
                        {(obs.vitals.paSystolic !== undefined || obs.vitals.paStandingSystolic !== undefined) && (
                            <div className="flex items-center flex-wrap gap-2">
                                <Activity className="w-4 h-4 text-slate-400" />
                                <div className="flex items-center gap-2">
                                    {/* Standard (Sitting) PA */}
                                    {obs.vitals.paSystolic !== undefined && (
                                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-700">
                                          PA Sent: {obs.vitals.paSystolic}x{obs.vitals.paDiastolic}
                                      </span>
                                    )}

                                    {/* Standing PA (If exists) */}
                                    {obs.vitals.paStandingSystolic !== undefined && (
                                        <span className="bg-yellow-100 px-2 py-0.5 rounded text-xs font-bold text-yellow-800 border border-yellow-200 flex items-center gap-1">
                                            PA Pé: {obs.vitals.paStandingSystolic}x{obs.vitals.paStandingDiastolic}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex gap-4">
                            {obs.vitals.tax !== undefined && (
                              <div className="flex items-center gap-1 mt-1">
                                <Thermometer className="w-4 h-4 text-slate-400" />
                                <span>{obs.vitals.tax}°C</span>
                              </div>
                            )}
                            {obs.vitals.spo2 !== undefined && (
                              <div className="flex items-center gap-1 mt-1">
                                <Waves className="w-4 h-4 text-slate-400" />
                                <span>Sat: {obs.vitals.spo2}%</span>
                              </div>
                            )}
                            {obs.vitals.dxt !== undefined && (
                              <div className="flex items-center gap-1 mt-1">
                                <Droplet className="w-4 h-4 text-slate-400" />
                                <span>DXT: <b>{obs.vitals.dxt}</b> mg/dL</span>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Obstetric Details (Toque) - NEW FORMAT */}
                    {toqueString && (
                        <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs text-slate-700 mt-1">
                            <div className="font-bold text-slate-500 mb-1 flex items-center gap-1">
                                <CircleDot className="w-3 h-3" /> Toque Vaginal:
                            </div>
                            <div className="font-mono font-medium text-slate-800">
                                {toqueString}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                                {obs.obstetric.station !== undefined && (
                                    <span className="bg-white px-1.5 rounded border border-slate-200">
                                        {obs.obstetric.station === -4 ? <b>Alto e Móvel</b> : <>De Lee: <b>{obs.obstetric.station > 0 ? '+' : ''}{obs.obstetric.station}</b></>}
                                    </span>
                                )}
                                {obs.obstetric.membranes && <span className="bg-white px-1.5 rounded border border-slate-200">Bolsa: <b>{obs.obstetric.membranes}</b></span>}
                            </div>
                        </div>
                    )}

                     {/* Magnesium Protocol Data - Show if data exists AND is not empty */}
                     {hasMagnesiumData && obs.magnesiumData && (
                       <div className="col-span-2 bg-purple-100/50 p-2 rounded-lg border border-purple-200 text-xs text-purple-900 mt-2 flex flex-col gap-1">
                          <div className="font-bold text-[10px] uppercase tracking-wide text-purple-700 flex items-center gap-1">
                              <Activity className="w-3 h-3" /> Protocolo Magnésio
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                              {obs.magnesiumData.reflex && (
                                  <div className="flex items-center gap-1">
                                      <Hammer className="w-3 h-3 text-purple-500" />
                                      <span>Reflexo: <b>{obs.magnesiumData.reflex}</b></span>
                                  </div>
                              )}
                              {obs.magnesiumData.diuresis && obs.magnesiumData.diuresis.trim() !== '' && (
                                  <div className="flex items-center gap-1">
                                      <Droplets className="w-3 h-3 text-purple-500" />
                                      <span>Diurese: <b>{obs.magnesiumData.diuresis}</b></span>
                                  </div>
                              )}
                              {obs.magnesiumData.respiratoryRate !== undefined && (
                                  <div className="flex items-center gap-1">
                                      <Wind className="w-3 h-3 text-purple-500" />
                                      <span>FR: <b>{obs.magnesiumData.respiratoryRate}</b></span>
                                  </div>
                              )}
                          </div>
                       </div>
                     )}

                     {/* Medications */}
                     {obs.medication && (obs.medication.misoprostolDose !== undefined || obs.medication.oxytocinDose !== undefined) && (
                       <div className="col-span-2 bg-purple-50 p-2 rounded-lg text-xs text-purple-800 flex flex-wrap gap-3 mt-1">
                          <Pill className="w-3 h-3" />
                          {obs.medication.misoprostolDose !== undefined && (
                             <span>
                                 {obs.medication.misoprostolCount ? `${obs.medication.misoprostolCount}º ` : ''}Miso: <b>{obs.medication.misoprostolDose}mcg</b>
                             </span>
                          )}
                          {obs.medication.oxytocinDose !== undefined && <span>Ocitocina: <b>{obs.medication.oxytocinDose}ml/h</b></span>}
                       </div>
                     )}
                     
                     {/* Notes */}
                     {obs.notes && (
                       <div className="col-span-2 text-sm text-slate-500 italic mt-2 border-t border-slate-50 pt-2">
                         "{obs.notes}"
                       </div>
                     )}
                 </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
};

export default PatientDetails;
