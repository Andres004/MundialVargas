// @ts-nocheck
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://spulkmtcpxjxqcolkiuo.supabase.co', 'sb_publishable_OGy26eyySr3gpRsKC1imtA_iOzL_0Hm');

// =========================================================================
// ⚙️ CONFIGURACIÓN DEL ADMINISTRADOR
// =========================================================================
const POZO_AYER = 0; 
const PRECIO_POR_PARTIDO = 3; 

const PARTIDOS_DE_HOY = [
  { id: 101, home_team: 'Suiza', away_team: 'Canadá', home_flag: 'https://flagcdn.com/w80/ch.png', away_flag: 'https://flagcdn.com/w80/ca.png', home_score: 0, away_score: 0, status: 'PENDING', time: '15:00' },
  { id: 102, home_team: 'Bosnia', away_team: 'Catar', home_flag: 'https://flagcdn.com/w80/ba.png', away_flag: 'https://flagcdn.com/w80/qa.png', home_score: 0, away_score: 0, status: 'PENDING', time: '15:00' },
  { id: 103, home_team: 'Marruecos', away_team: 'Haití', home_flag: 'https://flagcdn.com/w80/ma.png', away_flag: 'https://flagcdn.com/w80/ht.png', home_score: 0, away_score: 0, status: 'PENDING', time: '18:00' },
  { id: 104, home_team: 'Escocia', away_team: 'Brasil', home_flag: 'https://flagcdn.com/w80/gb-sct.png', away_flag: 'https://flagcdn.com/w80/br.png', home_score: 0, away_score: 0, status: 'PENDING', time: '18:00' },
  { id: 105, home_team: 'Sudáfrica', away_team: 'Corea Sur', home_flag: 'https://flagcdn.com/w80/za.png', away_flag: 'https://flagcdn.com/w80/kr.png', home_score: 0, away_score: 0, status: 'PENDING', time: '21:00' },
  { id: 106, home_team: 'R. Checa', away_team: 'México', home_flag: 'https://flagcdn.com/w80/cz.png', away_flag: 'https://flagcdn.com/w80/mx.png', home_score: 0, away_score: 0, status: 'PENDING', time: '21:00' }
];

export default function App() {
  const hoyStr = new Date().toLocaleDateString('es-BO');
  const datosGuardados = JSON.parse(localStorage.getItem('pollaData') || '{}');
  const [user, setUser] = useState(datosGuardados.fecha === hoyStr ? datosGuardados.nombre : '');
  const [nameInput, setNameInput] = useState('');
  const [matches] = useState(PARTIDOS_DE_HOY);
  const [predictions, setPredictions] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setInterval(() => setCurrentTime(new Date()), 30000);
    if (user) {
      fetchPredictions();
      const channel = supabase.channel('public-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, fetchPredictions).subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [user]);

  const fetchPredictions = async () => {
    const { data } = await supabase.from('predictions').select('*');
    if (data) setPredictions(data);
  };

  const login = async (e) => {
    e.preventDefault();
    if (!nameInput) return;
    const name = nameInput.trim();
    await supabase.from('users').upsert({ name });
    localStorage.setItem('pollaData', JSON.stringify({ nombre: name, fecha: hoyStr }));
    setUser(name);
  };

  const predict = async (mId, h, a) => {
    await supabase.from('predictions').upsert({ user_name: user, match_id: mId, home_score: parseInt(h) || 0, away_score: parseInt(a) || 0 }, { onConflict: 'user_name,match_id' });
    fetchPredictions();
  };

  const isLocked = (t) => {
    const [h, m] = t.split(':');
    const d = new Date(); d.setHours(h, m, 0, 0);
    return (d.getTime() - currentTime.getTime()) / 60000 <= 5;
  };

  const jugadoresUnicos = new Set(predictions.map(p => p.user_name)).size;
  let acumuladoEnJuego = POZO_AYER; 

  // LÓGICA DE PREMIOS Y ACUMULADOS
  const matchesConPozo = matches.map(m => {
    const matchPreds = predictions.filter(p => p.match_id === m.id);
    const ganadores = matchPreds.filter(p => p.home_score === m.home_score && p.away_score === m.away_score);
    const pozoTotal = (jugadoresUnicos * PRECIO_POR_PARTIDO) + acumuladoEnJuego;
    
    let res = { mensaje: "", premio: 0 };
    if (m.status === 'FINISHED') {
      if (ganadores.length > 0) {
        res.mensaje = `GANADOR(ES): ${ganadores.map(g => g.user_name).join(', ')} - PREMIO: ${(pozoTotal / ganadores.length).toFixed(2)} Bs`;
        acumuladoEnJuego = 0;
      } else {
        res.mensaje = `NADIE ACERTÓ. Acumulado para el siguiente: ${pozoTotal} Bs`;
        acumuladoEnJuego = pozoTotal;
      }
    }
    return { ...m, pozoTotal, ...res };
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm">
          <h1 className="text-2xl font-black text-center mb-6">MUNDIAL VARGAS</h1>
          <input type="text" placeholder="Tu nombre..." className="w-full bg-slate-100 p-4 rounded-xl mb-4 text-center font-bold" value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-10">
      <header className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex justify-between items-center">
        <h1 className="font-black">MUNDIAL VARGAS</h1>
        <div className="bg-slate-100 px-4 py-2 rounded-xl font-black">{jugadoresUnicos * PRECIO_POR_PARTIDO * matches.length} Bs</div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {matchesConPozo.map(m => {
          const myP = predictions.find(p => p.match_id === m.id && p.user_name === user);
          const locked = isLocked(m.time) && m.status !== 'FINISHED';
          const matchPredictions = predictions.filter(p => p.match_id === m.id);

          return (
            <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative">
              <div className="flex justify-between mb-4 text-xs font-bold text-slate-400">
                <span>{m.time}</span>
                <span>Pozo: {m.pozoTotal} Bs</span>
              </div>
              <div className="flex justify-between mb-4">
                <div className="flex flex-col items-center"><img src={m.home_flag} className="w-12 mb-2" />{m.home_team}</div>
                <div className="text-2xl font-black self-center">{m.status === 'FINISHED' ? `${m.home_score} : ${m.away_score}` : '- : -'}</div>
                <div className="flex flex-col items-center"><img src={m.away_flag} className="w-12 mb-2" />{m.away_team}</div>
              </div>
              
              {m.status === 'FINISHED' && <div className="text-[10px] font-black text-blue-700 bg-blue-50 p-2 rounded mb-4 text-center uppercase">{m.mensaje}</div>}
              
              {!m.status === 'FINISHED' && !locked ? (
                <form onSubmit={(e) => { e.preventDefault(); predict(m.id, e.target.h.value, e.target.a.value); }} className="flex gap-2">
                  <input type="number" name="h" className="w-16 border rounded text-center" defaultValue={myP?.home_score} />
                  <input type="number" name="a" className="w-16 border rounded text-center" defaultValue={myP?.away_score} />
                  <button type="submit" className="bg-blue-600 text-white px-4 rounded">Apostar</button>
                </form>
              ) : <div className="text-sm font-bold text-center">{locked ? "CERRADO" : `Tu apuesta: ${myP?.home_score ?? '-'}:${myP?.away_score ?? '-'}`}</div>}

              <div className="mt-4 border-t pt-2 text-[10px]">
                {matchPredictions.map(p => <div key={p.user_name}>{p.user_name}: {p.home_score}-{p.away_score}</div>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}