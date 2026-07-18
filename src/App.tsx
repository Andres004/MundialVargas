// @ts-nocheck
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://spulkmtcpxjxqcolkiuo.supabase.co', 'sb_publishable_OGy26eyySr3gpRsKC1imtA_iOzL_0Hm');

// =========================================================================
// CONFIGURACION DEL ADMINISTRADOR (TU)
// =========================================================================

// 1. FECHA EXACTA DE LOS PARTIDOS
const FECHA_DE_PARTIDOS = "2026-07-18";

// 2. El sobrante exacto de los partidos anteriores. 
const POZO_AYER = 0; 
const PRECIO_POR_PARTIDO = 5; 

// 3. PARTIDOS DE ELIMINACION DIRECTA.
const PARTIDOS_DE_HOY = [
  { 
    id: 7001, 
    home_team: 'Francia', 
    away_team: 'Inglaterra',
    home_flag: 'https://flagcdn.com/w80/fr.png', 
    away_flag: 'https://flagcdn.com/w80/gb-eng.png', 
    home_score: 0, 
    away_score: 0, 
    status: 'PENDING', 
    time: '17:00',
    advanced_team: '' 
  }
];

export default function App() {
  const hoyStr = FECHA_DE_PARTIDOS; 
  const datosGuardados = JSON.parse(localStorage.getItem('pollaData') || '{}');
  
  const [user, setUser] = useState(datosGuardados.fecha === hoyStr ? datosGuardados.nombre : '');
  const [nameInput, setNameInput] = useState('');
  
  const [predictions, setPredictions] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    
    if (user) {
      fetchPredictions();
      const channel = supabase
        .channel('public-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
          fetchPredictions();
        })
        .subscribe();
      return () => { clearInterval(timer); supabase.removeChannel(channel); };
    }
    return () => clearInterval(timer);
  }, [user]);

  const fetchPredictions = async () => {
    const { data, error } = await supabase.from('predictions').select('*');
    if (error) console.error("Error al leer:", error);
    if (data) setPredictions(data);
  };

  const login = async (e) => {
    e.preventDefault();
    if (!nameInput) return;
    const formattedName = nameInput.trim();
    
    await supabase.from('users').upsert({ name: formattedName });
    localStorage.setItem('pollaData', JSON.stringify({ nombre: formattedName, fecha: hoyStr }));
    setUser(formattedName);
  };

  const predict = async (matchId, home, away) => {
    const homeVal = home === '' ? '' : parseInt(home) || 0;
    const awayVal = away === '' ? '' : parseInt(away) || 0;

    setPredictions(prev => {
      const newList = [...prev];
      const index = newList.findIndex(p => p.match_id === matchId && p.user_name === user);
      if (index >= 0) {
        newList[index] = { ...newList[index], home_score: homeVal, away_score: awayVal };
      } else {
        newList.push({ user_name: user, match_id: matchId, home_score: homeVal, away_score: awayVal });
      }
      return newList;
    });

    const { error } = await supabase.from('predictions').upsert({
      user_name: user, 
      match_id: matchId, 
      home_score: homeVal === '' ? 0 : homeVal, 
      away_score: awayVal === '' ? 0 : awayVal
    }, { onConflict: 'user_name,match_id' });
    
    if (error) {
      console.error("Error al guardar: " + error.message); 
      fetchPredictions(); 
    }
  };

  const isLocked = (matchTimeStr) => {
    const [year, month, day] = FECHA_DE_PARTIDOS.split('-');
    const [hours, minutes] = matchTimeStr.split(':');
    
    const matchDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), 0, 0);
    
    const diffMinutes = (matchDate.getTime() - currentTime.getTime()) / 60000;
    return diffMinutes <= 0; 
  };

  const idsDeHoy = PARTIDOS_DE_HOY.map(m => m.id);
  const prediccionesDeHoy = predictions.filter(p => idsDeHoy.includes(p.match_id));
  
  const jugadoresUnicosSet = new Set(prediccionesDeHoy.map(p => p.user_name));
  const jugadoresUnicosHoy = jugadoresUnicosSet.size;

  const misPrediccionesHoy = prediccionesDeHoy.filter(p => p.user_name === user);
  const faltanPredicciones = misPrediccionesHoy.length < PARTIDOS_DE_HOY.length;
  
  let acumuladoEnJuego = POZO_AYER; 

  const partidosPorHora = {};
  PARTIDOS_DE_HOY.forEach(m => {
    if (!partidosPorHora[m.time]) partidosPorHora[m.time] = [];
    partidosPorHora[m.time].push(m);
  });

  const horasOrdenadas = Object.keys(partidosPorHora).sort();
  const matchesConPozoUnsorted = [];

  horasOrdenadas.forEach(hora => {
    const grupo = partidosPorHora[hora];
    const acumuladoRepartido = acumuladoEnJuego / grupo.length;
    let acumuladoParaSiguienteHora = 0;

    grupo.forEach(m => {
      const matchPreds = prediccionesDeHoy.filter(p => p.match_id === m.id);
      
      let ganadores = [];
      const aciertosExactos = matchPreds.filter(p => p.home_score === m.home_score && p.away_score === m.away_score);
      
      if (m.status === 'FINISHED') {
        if (aciertosExactos.length > 0) {
           ganadores = aciertosExactos;
        } else {
           if (m.home_score === m.away_score) {
             let equipoGanadorReal = '';
             if (m.advanced_team !== '') {
               equipoGanadorReal = m.advanced_team; 
             }
             
             if (equipoGanadorReal !== '') {
               ganadores = matchPreds.filter(p => {
                 if (equipoGanadorReal === m.home_team) return p.home_score > p.away_score;
                 if (equipoGanadorReal === m.away_team) return p.away_score > p.home_score;
                 return false;
               });
             }
           }
        }
      }

      const pozoBaseDelPartido = jugadoresUnicosHoy * PRECIO_POR_PARTIDO;
      const pozoTotal = pozoBaseDelPartido + acumuladoRepartido;
      
      let mensajeResultado = "";
      
      if (m.status === 'FINISHED') {
        if (ganadores.length > 0) {
          const premio = (pozoTotal / ganadores.length).toFixed(2);
          mensajeResultado = `GANADOR(ES): ${ganadores.map(g => g.user_name).join(', ')} (PREMIO: ${premio} Bs)`;
        } else {
          mensajeResultado = "Nadie acerto. El pozo pasa al siguiente turno.";
          acumuladoParaSiguienteHora += pozoTotal; 
        }
      }

      const esGanadorEnTabla = (userName) => ganadores.some(g => g.user_name === userName);

      matchesConPozoUnsorted.push({ ...m, pozoTotal, mensajeResultado, ganadores, esGanadorEnTabla });
    });

    acumuladoEnJuego = acumuladoParaSiguienteHora;
  });

  const matchesConPozo = matchesConPozoUnsorted.sort((a,b) => a.id - b.id);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');`}</style>
        
        {/* Decoracion de fondo para la final */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-yellow-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>

        <form onSubmit={login} className="bg-[#1e293b]/80 backdrop-blur-xl p-8 md:p-10 rounded-[2rem] shadow-[0_0_50px_rgba(245,158,11,0.15)] border border-amber-500/20 w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <div className="inline-block px-4 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
              Gran Final
            </div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 tracking-tight uppercase drop-shadow-sm">
              Mundial Vargas
            </h1>
            <p className="text-slate-400 text-sm mt-3 font-bold">Costo del pase: {PRECIO_POR_PARTIDO * PARTIDOS_DE_HOY.length} Bs</p>
          </div>
          <input 
            type="text" placeholder="Ingresa tu nombre..." required
            className="w-full bg-[#0f172a] text-white px-5 py-4 rounded-2xl mb-6 outline-none border-2 border-slate-700 focus:border-amber-500 font-bold text-center text-lg transition-all placeholder:text-slate-600 shadow-inner"
            value={nameInput} onChange={(e) => setNameInput(e.target.value)}
          />
          <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 font-black py-4 rounded-2xl hover:from-amber-400 hover:to-yellow-500 shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all uppercase tracking-widest text-lg transform hover:scale-[1.02]">
            Entrar a la Final
          </button>
        </form>
      </div>
    );
  }

  const recaudacionTotalDelDia = jugadoresUnicosHoy * (PRECIO_POR_PARTIDO * PARTIDOS_DE_HOY.length);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 pb-12 relative overflow-hidden" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');`}</style>
      
      {/* Fondo Premium */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full filter blur-[150px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-yellow-600/10 rounded-full filter blur-[150px]"></div>
      </div>
      
      {showRules && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 transition-opacity">
          <div className="bg-[#1e293b] rounded-[2rem] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-[0_0_40px_rgba(245,158,11,0.15)] border border-slate-700">
            <div className="p-5 md:p-6 border-b border-slate-700 flex justify-between items-center bg-[#0f172a]/50">
              <h2 className="text-lg md:text-xl font-black text-amber-400 uppercase tracking-tight">Reglamento Oficial</h2>
              <button onClick={() => setShowRules(false)} className="bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm">
                Cerrar X
              </button>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-sm md:text-base text-slate-300 scrollbar-thin">
              <p className="text-center font-black text-amber-500 mb-6 uppercase text-lg">REGLAMENTO DEL JUEGO DE PRONOSTICOS <br/>MUNDIAL DE FUTBOL</p>
              
              <div><span className="font-black text-amber-400 block mb-1">1. Aporte</span>Cada participante aporta Bs 5 por partido. El pozo de cada juego se conformara con el total de los aportes de los participantes.</div>
              <div><span className="font-black text-amber-400 block mb-1">2. Mecanica</span>Cada participante debera enviar su pronostico del marcador exacto antes del inicio de cada partido.</div>
              <div><span className="font-black text-amber-400 block mb-1">3. Ganador del pozo</span>El ganador de cada encuentro sera quien acierte el marcador exacto.</div>
              <div><span className="font-black text-amber-400 block mb-1">4. Partidos de eliminacion directa</span>Si un participante acierta el marcador exacto de empate al finalizar los 90 minutos, se llevara el pozo. Si nadie acierta ese empate exacto, el pozo sera para quien haya acertado al equipo que clasifique a la siguiente ronda, ya sea en tiempo suplementario o por penales.</div>
              <div><span className="font-black text-amber-400 block mb-1">5. Acumulacion</span>Si nadie acierta el marcador exacto o un partido es suspendido, el pozo se acumulara para el siguiente partido. Si existen dos o mas partidos programados a la misma hora, el pozo acumulado se dividira en partes iguales entre ellos. Cada partido continuara con su acumulado de forma independiente. Si un participante acierta solo uno de esos partidos, unicamente recibira la parte del pozo correspondiente a ese encuentro, mientras que el saldo restante continuara acumulandose.</div>
              <div><span className="font-black text-amber-400 block mb-1">6. Continuidad del acumulado</span>El pozo acumulado continuara partido tras partido hasta que exista al menos un ganador.</div>
              <div><span className="font-black text-amber-400 block mb-1">7. Retiro e ingreso de participantes</span>Si un participante decide retirarse del juego, perdera el derecho a cualquier pozo acumulado generado hasta ese momento. Si posteriormente vuelve a ingresar, o si se incorpora un participante nuevo, debera nivelarse con los aportes de los partidos anteriores para tener derecho a participar en los pozos acumulados.</div>
              <div><span className="font-black text-amber-400 block mb-1">8. Aclaracion sobre el acumulado</span>El primer dia del juego el pozo acumulado se entrego en su totalidad porque no hubo partidos disputandose al mismo tiempo. La division del acumulado solo se aplicara cuando existan dos o mas encuentros programados en el mismo horario.</div>
              <div><span className="font-black text-amber-400 block mb-1">9. Cierre del acumulado</span>Si el pozo acumulado llega hasta la final del Mundial, este se disputara unicamente en ese partido y se otorgara a quien acierte el marcador exacto. Si en la final hay empate al termino de los 90 minutos, se aplicara lo establecido en el punto 4. Si existen varios acertantes, el pozo se dividira en partes iguales entre ellos.</div>
              <div><span className="font-black text-amber-400 block mb-1">10. Aceptacion del reglamento</span>La participacion en el juego implica la aceptacion total de las presentes reglas. Cualquier situacion no contemplada en este reglamento sera resuelta por el organizador, procurando mantener la transparencia y la equidad del juego.</div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER DE LA GRAN FINAL */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 text-[#0f172a] text-center py-2 font-black uppercase tracking-[0.4em] text-xs shadow-[0_4px_15px_rgba(245,158,11,0.3)] relative z-50">
        ✧ LA GRAN FINAL DEL MUNDIAL ✧
      </div>

      <header className="bg-[#1e293b]/80 backdrop-blur-xl sticky top-0 z-40 p-5 border-b border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left flex flex-col items-center md:items-start">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 uppercase tracking-tight">Mundial Vargas</h1>
            <button onClick={() => setShowRules(true)} className="bg-slate-800 text-amber-400 hover:bg-amber-500 hover:text-slate-900 border border-slate-700 hover:border-amber-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
              REGLAS
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-2 font-bold">Jugador: <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">{user}</span> | Activos Hoy: {jugadoresUnicosHoy}</p>
        </div>
        <div className="bg-[#0f172a] px-6 py-2.5 rounded-2xl border border-amber-500/30 text-center w-full md:w-auto shadow-inner">
          <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest">Recaudacion Final</p>
          <p className="text-3xl font-black text-yellow-400">{recaudacionTotalDelDia} <span className="text-base">Bs</span></p>
        </div>
      </header>

      {faltanPredicciones && (
        <div className="bg-red-600/90 text-white p-3 text-center shadow-[0_0_15px_rgba(220,38,38,0.5)] border-b border-red-500 relative z-30">
          <p className="text-[11px] md:text-sm font-black uppercase tracking-widest animate-pulse">
            AUN NO ESTAS PARTICIPANDO EN LA FINAL. ¡INGRESA TU PRONOSTICO AHORA!
          </p>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 mt-10 relative z-10">
        <div className="grid gap-8 grid-cols-1">
          {matchesConPozo.map(m => {
            const myP = prediccionesDeHoy.find(p => p.match_id === m.id && p.user_name === user);
            const isFinished = m.status === 'FINISHED';
            const locked = isLocked(m.time) || isFinished;
            const matchPredictions = prediccionesDeHoy.filter(p => p.match_id === m.id);
            const miApuestaEnEstePartido = myP && myP.home_score !== '' && myP.away_score !== '';

            return (
              <div key={m.id} className="bg-gradient-to-b from-[#1e293b] to-[#0f172a] rounded-[2rem] p-6 md:p-10 border-2 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.1)] relative flex flex-col transition-all overflow-hidden">
                
                {/* Reflejo superior dorado */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50"></div>

                <div className="absolute top-0 right-0 bg-[#0f172a] text-amber-400 text-[11px] font-black px-5 py-2 rounded-bl-2xl border-b border-l border-amber-500/30 uppercase tracking-widest">
                  Hora: {m.time}
                </div>
                
                {isFinished && <div className="absolute top-0 left-0 bg-amber-500 text-slate-900 text-[11px] font-black px-5 py-2 rounded-br-2xl uppercase tracking-widest">Finalizado</div>}
                {locked && !isFinished && <div className="absolute top-0 left-0 bg-red-600 text-white text-[11px] font-black px-5 py-2 rounded-br-2xl uppercase tracking-widest shadow-md">Cerrado</div>}

                <div className="flex justify-between items-center mt-10 mb-8 gap-2 sm:gap-4">
                  <div className="flex flex-col items-center w-1/3">
                    <img src={m.home_flag} alt={m.home_team} className="w-20 sm:w-28 h-14 sm:h-20 object-cover rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.5)] mb-4 border border-slate-600" />
                    <span className="font-black text-[13px] sm:text-lg text-white text-center uppercase tracking-wider drop-shadow-md">{m.home_team}</span>
                  </div>
                  
                  <div className="bg-[#0f172a] px-6 py-4 sm:px-8 sm:py-5 rounded-3xl font-black text-4xl sm:text-6xl text-amber-400 border border-slate-700 shadow-inner flex flex-row flex-nowrap items-center justify-center whitespace-nowrap shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                    <span className="relative z-10">{isFinished ? m.home_score : '-'}</span>
                    <span className="text-slate-600 mx-3 sm:mx-4 relative z-10">:</span> 
                    <span className="relative z-10">{isFinished ? m.away_score : '-'}</span>
                  </div>

                  <div className="flex flex-col items-center w-1/3">
                    <img src={m.away_flag} alt={m.away_team} className="w-20 sm:w-28 h-14 sm:h-20 object-cover rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.5)] mb-4 border border-slate-600" />
                    <span className="font-black text-[13px] sm:text-lg text-white text-center uppercase tracking-wider drop-shadow-md">{m.away_team}</span>
                  </div>
                </div>

                <div className="text-center mb-10">
                  <div className="inline-block bg-amber-500/10 border border-amber-500/40 text-amber-400 text-sm font-black px-8 py-3 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.2)] tracking-wide">
                    POZO EN JUEGO: {m.pozoTotal} Bs
                  </div>
                  {isFinished && (
                    <div className={`mt-6 text-sm font-black px-6 py-4 rounded-xl uppercase tracking-wider transition-all border ${m.ganadores.length > 0 ? 'bg-amber-500 text-slate-900 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {m.mensajeResultado}
                    </div>
                  )}
                </div>

                {!locked ? (
                  <div className="mb-8">
                    <div className="bg-[#0f172a] p-6 rounded-3xl flex flex-row flex-nowrap justify-center items-center gap-4 border border-slate-700 shadow-inner relative overflow-hidden">
                      <input 
                        type="number" 
                        min="0" 
                        value={myP && myP.home_score !== '' ? myP.home_score : ''} 
                        onChange={(e) => predict(m.id, e.target.value, myP?.away_score ?? '')} 
                        className="w-20 h-16 bg-[#1e293b] border-2 border-slate-600 rounded-2xl text-center text-3xl font-black text-white outline-none focus:border-amber-500 focus:bg-[#0f172a] transition-all shadow-inner placeholder:text-slate-700" 
                        placeholder="-"
                      />
                      <span className="text-2xl font-black text-slate-600">:</span>
                      <input 
                        type="number" 
                        min="0" 
                        value={myP && myP.away_score !== '' ? myP.away_score : ''} 
                        onChange={(e) => predict(m.id, myP?.home_score ?? '', e.target.value)} 
                        className="w-20 h-16 bg-[#1e293b] border-2 border-slate-600 rounded-2xl text-center text-3xl font-black text-white outline-none focus:border-amber-500 focus:bg-[#0f172a] transition-all shadow-inner placeholder:text-slate-700" 
                        placeholder="-"
                      />
                    </div>
                    <p className="text-[10px] text-center text-slate-500 font-bold mt-3 uppercase tracking-widest animate-pulse">
                      Se guarda automaticamente
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#0f172a] p-6 rounded-3xl text-center border border-slate-700 mb-8 shadow-inner">
                    <p className="text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest">Tu prediccion Final</p>
                    <p className="text-4xl font-black text-amber-500">{myP?.home_score ?? '-'} : {myP?.away_score ?? '-'}</p>
                  </div>
                )}

                <div className="mt-auto border-t border-slate-700 pt-8">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 text-center">Apuestas de la Familia</h3>
                  
                  {!miApuestaEnEstePartido && !locked ? (
                    <div className="p-6 bg-slate-800/50 rounded-2xl text-center border border-slate-700 backdrop-blur-sm">
                      <p className="text-[12px] font-black text-amber-500/50 uppercase tracking-widest">Modo Espia Bloqueado</p>
                      <p className="text-[11px] text-slate-400 mt-2 font-bold">Ingresa tu pronostico para descubrir como jugo el resto.</p>
                    </div>
                  ) : matchPredictions.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                      <table className="w-full text-left text-base">
                        <tbody className="divide-y divide-slate-800">
                          {matchPredictions.map(p => {
                            const isMyPrediction = p.user_name === user;
                            const showScore = locked || isMyPrediction;
                            const acerto = isFinished && m.ganadores.some(g => g.user_name === p.user_name);
                            
                            return (
                              <tr key={p.user_name} className={`transition-colors ${isMyPrediction ? 'bg-amber-500/10' : 'hover:bg-slate-800/30'}`}>
                                <td className={`py-3 px-4 ${isMyPrediction ? 'text-amber-400 font-black' : 'text-slate-300 font-bold'}`}>{p.user_name}</td>
                                <td className={`py-3 px-4 text-right font-black text-lg ${acerto ? 'text-green-400' : 'text-slate-100'}`}>
                                  {showScore ? (
                                    `${p.home_score} : ${p.away_score}`
                                  ) : (
                                    <span className="blur-md opacity-40 select-none text-slate-500">0 : 0</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic text-center font-bold">Nadie aposto aun para la gran final.</p>
                  )}
                </div>

              </div>
            )
          })}
        </div>

        <div className="mt-16 bg-[#1e293b] rounded-[2rem] shadow-[0_0_30px_rgba(0,0,0,0.3)] border border-slate-700 overflow-hidden mb-10">
          <div className="bg-gradient-to-r from-amber-600 to-yellow-500 p-5 border-b border-amber-600">
            <h2 className="text-lg font-black text-[#0f172a] uppercase tracking-widest text-center">Resumen Final de Predicciones</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-sm">
              <thead className="bg-[#0f172a] text-slate-400 font-black uppercase text-[10px] tracking-wider border-b-2 border-slate-700">
                <tr>
                  <th className="p-4 border-r border-slate-800 text-left min-w-[120px]">Jugador</th>
                  {matchesConPozo.map(m => (
                    <th key={m.id} className="p-4 border-r border-slate-800 min-w-[120px]">
                      <div className="text-amber-500 mb-1">{m.time}</div>
                      <div className="text-xs text-white">{m.home_team.substring(0,3)} vs {m.away_team.substring(0,3)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-[#1e293b]">
                {Array.from(jugadoresUnicosSet).map(jugador => (
                  <tr key={jugador} className="hover:bg-slate-800 transition-colors">
                    <td className="p-4 font-black text-left text-slate-200 border-r border-slate-800">{jugador}</td>
                    {matchesConPozo.map(m => {
                      const p = prediccionesDeHoy.find(pred => pred.match_id === m.id && pred.user_name === jugador);
                      let content = <span className="text-slate-600">-</span>;
                      let bgClass = "";
                      
                      if (p) {
                        const isMatchLocked = isLocked(m.time) || m.status === 'FINISHED';
                        const isMyPrediction = jugador === user;

                        if (isMatchLocked || isMyPrediction) {
                          content = <span>{p.home_score} - {p.away_score}</span>;
                          if (m.status === 'FINISHED') {
                            if (m.esGanadorEnTabla(jugador)) {
                              bgClass = "bg-green-500/20 text-green-400 border border-green-500/50 shadow-inner";
                            } else {
                              bgClass = "bg-red-500/10 text-slate-300 shadow-inner";
                            }
                          }
                        } else {
                          content = <span className="blur-sm opacity-40 select-none text-slate-500">0 - 0</span>;
                        }
                      }

                      return (
                        <td key={m.id} className={`p-4 font-black border-r border-slate-800 ${bgClass} text-base`}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}