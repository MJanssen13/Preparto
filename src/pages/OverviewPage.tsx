
import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus, Observation } from '../types';
import { patientService } from '../services/supabaseService';
import { Activity, Copy, Clipboard, FileText, BedDouble, Maximize2, Minimize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VitalCharts } from '../components/VitalCharts';

// --- Helper Component for Expanded Content ---
const ExpandedContent = ({ patient, observations, isLoading }: { patient: Patient, observations: Observation[], isLoading: boolean }) => {
    const [isChartMaximized, setIsChartMaximized] = useState(false);

    // Function to generate the prontuario text (kept local to this component for the button)
    const formatToqueVaginal = (o: Observation['obstetric']) => {
        const parts = [];
        if (o.effacement !== undefined) parts.push(o.effacement === 0 ? 'G' : `${o.effacement}% AP`);
        const posMap: Record<string, string> = { 'Posterior': 'P', 'Intermediário': 'I', 'Central': 'C' };
        if (o.cervixPosition && posMap[o.cervixPosition]) parts.push(posMap[o.cervixPosition]);
        const conMap: Record<string, string> = { 'Nasal': 'N', 'Nasolabial': 'NL', 'Labial': 'L' };
        if (o.cervixConsistency && conMap[o.cervixConsistency]) parts.push(conMap[o.cervixConsistency]);
        if (o.dilation !== undefined && o.dilation > 0) parts.push(`${o.dilation}CM`);
        else if (o.cervixStatus && o.cervixStatus.length > 0) parts.push(o.cervixStatus.join(', '));
        else if (o.dilation === 0) parts.push('0CM');
        
        // Station Logic Updated
        if (o.station !== undefined) {
             if (o.station === -4) parts.push('AM');
             else parts.push(`DE LEE ${o.station > 0 ? '+' : ''}${o.station}`);
        }

        if (o.bloodOnGlove !== undefined) parts.push(o.bloodOnGlove ? 'SDL' : 'SSDL');
        
        if (o.cervixObservation) parts.push(`Obs: ${o.cervixObservation}`);

        return parts.length > 0 ? `TOQUE: ${parts.join(', ')}` : '';
    };

    const generateProntuarioText = (patient: Patient, obsList: Observation[]) => {
        const sorted = [...obsList].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let text = '';
        let lastDate = '';

        sorted.forEach(o => {
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
            
            const toqueStr = formatToqueVaginal(o.obstetric);
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

        // APPEND CTGs at the end
        if (patient.ctgs && patient.ctgs.length > 0) {
            text += '\n--- CARDIOTOCOGRAFIAS ---\n';
            // Sort old -> new
            const sortedCtgs = [...patient.ctgs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            
            sortedCtgs.forEach(ctg => {
                const d = new Date(ctg.timestamp);
                const dateStr = d.toLocaleDateString('pt-BR');
                const timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                text += `[${dateStr} ${timeStr}] CTG: LINHA BASE ${ctg.baseline}BPM | VARIAB: ${ctg.variability.toUpperCase()} | AT/MF: ${ctg.atMfRatio.replace('<', 'MENOR ').replace('>', 'MAIOR ').toUpperCase()} | PONTUAÇÃO: ${ctg.score}/5 - ${ctg.conclusion.toUpperCase()}`;
                
                if (ctg.notes) text += ` | OBS: ${ctg.notes.toUpperCase()}`;
                text += '\n';
            });
        }

        if (patient.status === PatientStatus.PARTOGRAM_OPENED) {
            text += "\nABERTO PARTOGRAMA E MANTIDO DEMAIS PARÂMETROS REGISTRADOS EM PARTOGRAMA.";
        }
        return text;
    };

    const copyProntuarioToClipboard = () => {
        const text = generateProntuarioText(patient, observations);
        navigator.clipboard.writeText(text);
        alert('Texto copiado para a área de transferência!');
    };

    // Helper for table rendering
    let lastRenderDate = '';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
            
            {/* 1. Charts Column - With Maximize Capability */}
            <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all duration-300 ${isChartMaximized ? 'fixed inset-4 z-50 flex flex-col p-6 shadow-2xl' : 'p-4'}`}>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Gráficos de Tendência
                    </h4>
                    <button 
                        onClick={() => setIsChartMaximized(!isChartMaximized)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                        title={isChartMaximized ? "Minimizar" : "Maximizar"}
                    >
                        {isChartMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
                
                {isLoading ? (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Carregando...</div>
                ) : (
                    <div className={`${isChartMaximized ? 'flex-1 min-h-0' : 'h-64'} overflow-y-auto custom-scrollbar`}>
                        <VitalCharts observations={observations} isMaximized={isChartMaximized} />
                    </div>
                )}
            </div>

            {/* Backgroup overlay for maximize */}
            {isChartMaximized && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setIsChartMaximized(false)}></div>
            )}

            {/* 2. History List Column - FULL Details */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:col-span-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Clipboard className="w-4 h-4" /> Histórico Completo
                </h4>
                <div className="flex-1 overflow-auto max-h-64 custom-scrollbar">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-400">...</div>
                    ) : observations.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 italic text-sm">Sem registros.</div>
                    ) : (
                        <table className="w-full text-xs min-w-[600px]">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 text-left w-16">Hora</th>
                                    <th className="p-3 text-left w-24">Monitor</th>
                                    <th className="p-3 text-left">Toque Vaginal</th>
                                    <th className="p-3 text-left">Sinais Vitais</th>
                                    <th className="p-3 text-left">Conduta / Obs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {observations.slice(0, 30).map(obs => {
                                    const isBcfBad = obs.obstetric.bcf !== undefined && (obs.obstetric.bcf < 110 || obs.obstetric.bcf > 160);
                                    
                                    const dateObj = new Date(obs.timestamp);
                                    const dateStr = dateObj.toLocaleDateString('pt-BR');
                                    const showDateHeader = dateStr !== lastRenderDate;
                                    if (showDateHeader) lastRenderDate = dateStr;

                                    return (
                                        <React.Fragment key={obs.id}>
                                            {/* Date Header Row */}
                                            {showDateHeader && (
                                                <tr className="bg-slate-100/80">
                                                    <td colSpan={5} className="py-1.5 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-y border-slate-200">
                                                        {dateStr}
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className="hover:bg-slate-50/50">
                                                {/* Hora */}
                                                <td className="p-3 font-bold text-slate-700 align-top">
                                                    {dateObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                </td>
                                                
                                                {/* Monitor (BCF / DU) */}
                                                <td className="p-3 align-top">
                                                    <div className="flex flex-col gap-1">
                                                        {obs.obstetric.bcf && (
                                                            <span className={`font-bold ${isBcfBad ? 'text-red-600' : 'text-slate-700'}`}>
                                                                BCF: {obs.obstetric.bcf}
                                                            </span>
                                                        )}
                                                        {(obs.obstetric.dinamicaSummary || obs.obstetric.dinamicaFrequency) && (
                                                            <span className="text-[10px] text-slate-500">
                                                                DU: {obs.obstetric.dinamicaSummary || `${obs.obstetric.dinamicaFrequency}/10'`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Toque */}
                                                <td className="p-3 align-top">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-bold text-slate-700">
                                                            {obs.obstetric.dilation !== undefined ? `${obs.obstetric.dilation} cm` : 
                                                            (obs.obstetric.cervixStatus?.join(', ') || '-')}
                                                        </span>
                                                        <div className="text-[10px] text-slate-500 flex flex-wrap gap-1">
                                                            {obs.obstetric.effacement !== undefined && <span>Apag: {obs.obstetric.effacement}%</span>}
                                                            {obs.obstetric.station !== undefined && (
                                                                <span>
                                                                    {obs.obstetric.station === -4 ? 'AM' : `De Lee: ${obs.obstetric.station > 0 ? '+' : ''}${obs.obstetric.station}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {obs.obstetric.membranes && (
                                                            <span className="text-[10px] bg-slate-100 px-1 rounded w-fit mt-0.5 border border-slate-200">
                                                                {obs.obstetric.membranes}
                                                            </span>
                                                        )}
                                                        {obs.obstetric.cervixObservation && (
                                                            <span className="text-[10px] text-slate-600 italic block mt-0.5">
                                                                Obs: {obs.obstetric.cervixObservation}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Vitais (PA, Tax, Sat, DXT) */}
                                                <td className="p-3 align-top">
                                                    <div className="flex flex-col gap-0.5">
                                                        {obs.vitals.paSystolic && (
                                                            <span className="font-bold text-slate-700">
                                                                PA: {obs.vitals.paSystolic}x{obs.vitals.paDiastolic}
                                                            </span>
                                                        )}
                                                        <div className="flex gap-2 text-[10px] text-slate-500 flex-wrap">
                                                            {obs.vitals.tax && <span>T: {obs.vitals.tax}°C</span>}
                                                            {obs.vitals.spo2 && <span>Sat: {obs.vitals.spo2}%</span>}
                                                            {obs.vitals.dxt && <span>DXT: {obs.vitals.dxt}</span>}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Condutas / Protocolos */}
                                                <td className="p-3 align-top">
                                                    <div className="flex flex-col gap-1">
                                                        {/* Meds */}
                                                        {(obs.medication?.oxytocinDose || obs.medication?.misoprostolDose) && (
                                                            <div className="flex gap-1 flex-wrap">
                                                                {obs.medication.oxytocinDose && <span className="text-[10px] bg-purple-50 text-purple-700 px-1 rounded border border-purple-100">Oxi: {obs.medication.oxytocinDose}ml/h</span>}
                                                                {obs.medication.misoprostolDose && (
                                                                    <span className="text-[10px] bg-purple-50 text-purple-700 px-1 rounded border border-purple-100">
                                                                        {obs.medication.misoprostolCount ? `${obs.medication.misoprostolCount}º ` : ''}Miso: {obs.medication.misoprostolDose}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Mag Protocol */}
                                                        {obs.magnesiumData && (obs.magnesiumData.reflex || obs.magnesiumData.diuresis) && (
                                                            <div className="text-[10px] text-indigo-600">
                                                                {obs.magnesiumData.reflex && <span>Refl: {obs.magnesiumData.reflex}</span>}
                                                                {obs.magnesiumData.reflex && obs.magnesiumData.diuresis && <span> | </span>}
                                                                {obs.magnesiumData.diuresis && <span>Diu: {obs.magnesiumData.diuresis}</span>}
                                                            </div>
                                                        )}

                                                        {/* Notes */}
                                                        {obs.notes && (
                                                            <span className="text-[10px] text-slate-400 italic truncate max-w-[150px]" title={obs.notes}>
                                                                "{obs.notes}"
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* 3. Medical Record Text Generator Column */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:col-span-3">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Copiar para Prontuário
                    </h4>
                    <button 
                        onClick={copyProntuarioToClipboard}
                        className="text-xs bg-medical-50 text-medical-700 hover:bg-medical-100 px-2 py-1 rounded border border-medical-200 flex items-center gap-1 transition-colors"
                    >
                        <Copy className="w-3 h-3" /> Copiar Texto
                    </button>
                </div>
                <div className="flex-1">
                    {isLoading ? (
                        <div className="h-full bg-slate-50 rounded animate-pulse h-24"></div>
                    ) : (
                        <textarea 
                            readOnly
                            className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-slate-200"
                            value={generateProntuarioText(patient, observations)}
                        />
                    )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                    Formato: Cronológico (Antigo &rarr; Novo). Copie e cole no sistema.
                </p>
            </div>
        </div>
    );
};

const OverviewPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    const data = await patientService.getPatients();
    // Filter out discharged for General Overview, assuming we only want active/monitoring
    const active = data.filter(p => p.status !== PatientStatus.DISCHARGED && p.status !== PatientStatus.PARTOGRAM_OPENED);
    setPatients(active);
    setLoading(false);
  };

  return (
    <div className="space-y-8 pb-24">
       <div className="flex flex-col gap-2 sticky top-16 bg-slate-50 z-20 py-4 border-b border-slate-200">
           <div>
               <h2 className="text-2xl font-bold text-slate-900">Painel Geral</h2>
               <p className="text-slate-500 text-sm">Visão detalhada de todos os pacientes ativos</p>
           </div>
       </div>

       {loading ? (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-600"></div>
            </div>
       ) : patients.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                <BedDouble className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum paciente ativo no momento.</p>
            </div>
       ) : (
           <div className="space-y-12">
               {patients.map(patient => (
                   <div key={patient.id} className="scroll-mt-32" id={`patient-${patient.id}`}>
                       <div className="flex items-center gap-3 mb-4 bg-slate-100/50 p-3 rounded-lg border border-slate-200">
                           <div className="bg-medical-100 text-medical-700 px-3 py-1 rounded-lg font-bold text-lg border border-medical-200 flex items-center gap-2 shadow-sm">
                               <BedDouble className="w-5 h-5" /> {patient.bed}
                           </div>
                           <div>
                               <h3 className="text-lg font-bold text-slate-800 leading-tight">{patient.name}</h3>
                               <p className="text-xs text-slate-500">{patient.status}</p>
                           </div>
                           <Link 
                                to={`/patient/${patient.id}`} 
                                className="ml-auto text-xs bg-white border border-slate-200 text-slate-600 hover:text-medical-600 hover:border-medical-200 px-3 py-1.5 rounded-full font-bold transition-all shadow-sm"
                           >
                               Abrir Prontuário
                           </Link>
                       </div>
                       
                       <ExpandedContent 
                           patient={patient} 
                           observations={patient.observations || []} 
                           isLoading={false} 
                       />
                   </div>
               ))}
           </div>
       )}
    </div>
  );
};

export default OverviewPage;
