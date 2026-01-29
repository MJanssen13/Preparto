import React, { useEffect, useState } from 'react';
import { Patient, PatientStatus, Observation } from '../types';
import { patientService, get24hStats } from '../services/supabaseService';
import { Activity, Copy, Clipboard, FileText, BedDouble, Maximize2, Minimize2, ChevronDown, ChevronUp, Ruler, Search, ArrowDownAZ, ArrowDown01 } from 'lucide-react';
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            
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
                                    
                                    return (
                                        <React.Fragment key={obs.id}>
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
            </div>
        </div>
    );
};

// --- Row Component for Summary View ---
// Fixed: Explicitly typed component as React.FC to accept 'key' prop without TS error
const PatientOverviewRow: React.FC<{ patient: Patient }> = ({ patient }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const observations = patient.observations || [];
    const stats = get24hStats(observations);
    
    // Last observation for static values (most recent)
    const lastObs = observations.length > 0 ? observations[0] : null;

    const getStatusBadge = (status: string) => {
        if (status === PatientStatus.DISCHARGED) return <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-bold border border-slate-200 uppercase">Alta / Transf.</span>;
        if (status === PatientStatus.PARTOGRAM_OPENED) return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold border border-green-200 uppercase">Partograma</span>;
        if (status === PatientStatus.DELIVERY) return <span className="bg-teal-100 text-teal-700 px-2 py-1 rounded text-[10px] font-bold border border-teal-200 uppercase">Parto Normal</span>;
        if (status === PatientStatus.C_SECTION) return <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold border border-indigo-200 uppercase">Cesárea</span>;
        return null; 
    };
    
    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
            {/* Header Row - Always Visible */}
            <div className="p-4 flex flex-col md:flex-row gap-4 md:items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                
                {/* 1. Bed */}
                <div className="flex items-center gap-4 min-w-[60px]">
                    <div className="bg-slate-100 text-slate-600 px-2 py-3 rounded-lg font-bold text-xl border border-slate-200 w-full text-center">
                        {patient.bed}
                    </div>
                </div>

                {/* 2. Patient Info */}
                <div className="flex-1 min-w-[200px]">
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{patient.name}</h3>
                    <div className="flex flex-wrap gap-2 text-xs mt-1">
                        <span className="bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100 font-medium">
                            {patient.gestationalAgeWeeks}s+{patient.gestationalAgeDays}d • {patient.parity}
                        </span>
                        {patient.riskFactors?.map(rf => (
                            <span key={rf} className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold text-[10px] uppercase">
                                {rf}
                            </span>
                        ))}
                    </div>
                </div>

                {/* 3. Obstetric Summary (24h) */}
                <div className="flex-1 grid grid-cols-2 gap-4 border-l border-slate-100 pl-4 md:border-l-0 md:pl-0 md:border-r md:pr-4">
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-1">
                            <Ruler className="w-3 h-3" /> Dilatação
                        </div>
                        <span className="font-bold text-slate-700 text-sm">
                            {lastObs?.obstetric.dilation !== undefined ? `${lastObs.obstetric.dilation} cm` : 
                             (lastObs?.obstetric.cervixStatus && lastObs.obstetric.cervixStatus.length > 0 ? lastObs.obstetric.cervixStatus[0] : '-')}
                        </span>
                    </div>

                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-1">
                            <Activity className="w-3 h-3" /> BCF (24h)
                        </div>
                        <span className={`font-bold text-sm ${stats?.hasBcf ? 'text-rose-600' : 'text-slate-400'}`}>
                            {stats?.hasBcf ? `${stats.bcf} bpm` : '-'}
                        </span>
                    </div>
                </div>

                {/* 4. Vitals Summary (24h) */}
                <div className="flex-1 md:max-w-[150px]">
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-1">
                            <Activity className="w-3 h-3" /> PA (24h)
                        </div>
                        <span className="font-bold text-indigo-600 text-sm">
                            {stats?.hasPa ? `${stats.pas} x ${stats.pad}` : '-'} <span className="text-slate-400 text-xs font-normal">mmHg</span>
                        </span>
                    </div>
                </div>

                {/* 5. Status / Actions */}
                <div className="flex items-center justify-between md:justify-end gap-3 md:min-w-[240px] border-t pt-3 md:border-t-0 md:pt-0 mt-2 md:mt-0">
                     <div className="flex-1 md:text-right">
                         {getStatusBadge(patient.status)}
                     </div>

                     <div className="flex items-center gap-2">
                         <Link 
                            to={`/patient/${patient.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold text-medical-600 hover:text-white hover:bg-medical-600 px-3 py-2 rounded-lg border border-medical-200 transition-colors"
                         >
                            Detalhes
                         </Link>
                         <button 
                            className={`p-2 rounded-lg transition-colors border ${isExpanded ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                         >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                         </button>
                     </div>
                </div>
            </div>

            {/* Expanded Content Body */}
            {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/50 p-4 animate-in slide-in-from-top-1">
                    <ExpandedContent 
                        patient={patient} 
                        observations={observations} 
                        isLoading={false} 
                    />
                </div>
            )}
        </div>
    );
};

const OverviewPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controls State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'active' | 'resolved' | 'all'>('active');
  const [sortType, setSortType] = useState<'bed' | 'name'>('bed');

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    const data = await patientService.getPatients();
    setPatients(data);
    setLoading(false);
  };

  const isResolved = (status: string) => {
      return [
          PatientStatus.DISCHARGED, 
          PatientStatus.PARTOGRAM_OPENED,
          PatientStatus.DELIVERY,
          PatientStatus.C_SECTION
      ].includes(status as PatientStatus);
  };

  const filteredPatients = patients
    .filter(p => {
        // Text Search
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.bed.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Filter Type
        const resolved = isResolved(p.status);
        if (filterType === 'active') return matchesSearch && !resolved;
        if (filterType === 'resolved') return matchesSearch && resolved;
        return matchesSearch; // 'all'
    })
    .sort((a, b) => {
        if (sortType === 'name') {
            return a.name.localeCompare(b.name);
        } else {
            // Bed sort
            return a.bed.localeCompare(b.bed, undefined, { numeric: true });
        }
    });

  return (
    <div className="space-y-6 pb-24">
       {/* Header & Controls */}
       <div className="flex flex-col gap-4 sticky top-16 bg-slate-50 z-20 py-2">
           <div className="flex items-center justify-between">
               <div>
                   <h2 className="text-2xl font-bold text-slate-900">Painel Geral</h2>
                   <p className="text-slate-500 text-sm">Visão consolidada do plantão</p>
               </div>
           </div>

           {/* Search */}
           <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou leito..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 shadow-sm"
                />
            </div>

           {/* Toolbar: Filters & Sorting */}
           <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
                {/* Filter Group */}
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    <button 
                       onClick={() => setFilterType('active')}
                       className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'active' ? 'bg-medical-50 text-medical-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                       Ativos
                    </button>
                    <button 
                       onClick={() => setFilterType('resolved')}
                       className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'resolved' ? 'bg-medical-50 text-medical-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                       Resolvidos
                    </button>
                    <button 
                       onClick={() => setFilterType('all')}
                       className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === 'all' ? 'bg-medical-50 text-medical-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                       Todos
                    </button>
                </div>

                {/* Sort Group */}
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm ml-auto">
                    <button 
                       onClick={() => setSortType('bed')}
                       className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortType === 'bed' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                       title="Ordenar por Leito"
                    >
                       <ArrowDown01 className="w-3 h-3" /> Leito
                    </button>
                    <button 
                       onClick={() => setSortType('name')}
                       className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortType === 'name' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                       title="Ordenar por Nome"
                    >
                       <ArrowDownAZ className="w-3 h-3" /> Nome
                    </button>
                </div>
           </div>
       </div>

       {loading ? (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-600"></div>
            </div>
       ) : filteredPatients.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                <BedDouble className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum paciente encontrado com estes filtros.</p>
            </div>
       ) : (
           <div className="space-y-4">
               {/* Table Header - Visible on larger screens */}
               <div className="hidden md:flex px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                   <div className="min-w-[60px] ml-4">Leito</div>
                   <div className="flex-1 pl-4">Paciente / IG</div>
                   <div className="flex-1 pl-4">Obstétrico (24h)</div>
                   <div className="flex-1 max-w-[150px]">Vitas (24h)</div>
                   <div className="min-w-[240px] text-right pr-12">Status</div>
               </div>

               {filteredPatients.map(patient => (
                   <PatientOverviewRow key={patient.id} patient={patient} />
               ))}
           </div>
       )}
    </div>
  );
};

export default OverviewPage;