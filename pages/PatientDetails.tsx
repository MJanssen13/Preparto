
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Patient, Observation, PatientStatus } from '../types';
import { patientService } from '../services/supabaseService';
import { ArrowLeft, Plus, Droplets, Thermometer, Activity, Pill, Clock, BedDouble, CircleDot, Edit2, Beaker, Hammer, Wind, Waves, CheckCircle2, Droplet, Baby, Scissors, Archive, RotateCcw, X } from 'lucide-react';
import { VitalCharts } from '../components/VitalCharts';

const PatientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Resolution Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (patientId: string) => {
    setLoading(true);
    const [p, obs] = await Promise.all([
      patientService.getPatientById(patientId),
      patientService.getObservations(patientId)
    ]);
    setPatient(p);
    setObservations(obs);
    setLoading(false);
  };

  const handleResolution = async (status: PatientStatus) => {
      if (!patient || !id) return;
      setIsProcessing(true);

      try {
          await patientService.resolvePatient(id, status);
          await loadData(id);
          setShowResolveModal(false);
          
          // Verify discharge time check
          const updatedP = await patientService.getPatientById(id);
          if (updatedP && !updatedP.dischargeTime) {
             // If dischargeTime is missing but status changed, it's the DB column issue.
          }

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
                onClick={() => setShowResolveModal(true)}
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
                     <p className="text-xs text-slate-500 mb-2">Selecione o tipo de resolução para encerrar o acompanhamento:</p>
                     
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
      {!isResolved && pendingTasks.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 relative overflow-hidden">
           <div className="flex items-center gap-2 text-blue-800 font-bold text-sm mb-3">
             <Clock className="w-4 h-4" />
             Próximas Avaliações
           </div>
           
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

      {/* Action Button */}
      {!isResolved && (
        <Link 
          to={`/patient/${id}/add-observation`}
          className="fixed bottom-20 right-6 md:static md:w-full md:block bg-medical-600 hover:bg-medical-700 text-white shadow-lg md:shadow-none rounded-full md:rounded-xl p-4 md:py-3 flex items-center justify-center gap-2 z-40 transition-all"
        >
          <Plus className="w-6 h-6" />
          <span className="hidden md:inline font-bold">Adicionar Evolução</span>
        </Link>
      )}

      {/* Timeline Feed */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-700 px-1">Evolução Clínica</h3>
        {observations.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white rounded-xl">
            Nenhuma observação registrada.
          </div>
        ) : (
          observations.map((obs) => {
             const isBcfAbnormal = obs.obstetric.bcf !== undefined && (obs.obstetric.bcf < 110 || obs.obstetric.bcf > 160);
             const toqueString = formatToqueVaginal(obs.obstetric);

             return (
              <div key={obs.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative group">
                 <div className="absolute top-4 right-4 flex items-center gap-3">
                   <span className="text-xs text-slate-400">
                     {new Date(obs.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </span>
                   {/* Allow editing observations even if resolved, for correction */}
                   <Link 
                    to={`/patient/${id}/edit-observation/${obs.id}`}
                    className="p-1.5 text-slate-300 hover:text-medical-600 hover:bg-slate-50 rounded-full transition-colors"
                   >
                     <Edit2 className="w-3 h-3" />
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

                     {/* Magnesium Protocol Data - Show if data exists, regardless of patient flag (History) */}
                     {obs.magnesiumData && (
                       <div className="col-span-2 bg-purple-100/50 p-2 rounded-lg border border-purple-200 text-xs text-purple-900 mt-2 flex flex-col gap-1">
                          <div className="font-bold text-[10px] uppercase tracking-wide text-purple-700 flex items-center gap-1">
                              <Activity className="w-3 h-3" /> Protocolo Magnésio
                          </div>
                          <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                  <Hammer className="w-3 h-3 text-purple-500" />
                                  <span>Reflexo: <b>{obs.magnesiumData.reflex}</b></span>
                              </div>
                              <div className="flex items-center gap-1">
                                  <Droplets className="w-3 h-3 text-purple-500" />
                                  <span>Diurese: <b>{obs.magnesiumData.diuresis}</b></span>
                              </div>
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
