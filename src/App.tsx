// @ts-nocheck
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://spulkmtcpxjxqcolkiuo.supabase.co', 'sb_publishable_OGy26eyySr3gpRsKC1imtA_iOzL_0Hm');

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('pollaUser') || '');
  const [nameInput, setNameInput] = useState('');
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    if (user) {
      fetchMatches();
      fetchPredictions();
    }
    
    const channel = supabase
      .channel('public-predictions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
        fetchPredictions();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const fetchMatches = async () => {
    // Partidos con imágenes de banderas reales
    const todayMatches = [
      { id: 101, home_team: 'Suiza', away_team: 'Canadá', home_flag: 'https://flagcdn.com/w80/ch.png', away_flag: 'https://flagcdn.com/w80/ca.png', home_score: 0, away_score: 0, status: 'PENDING', time: '15:00' },
      { id: 102, home_team: 'Bosnia', away_team: 'Catar', home_flag: 'https://flagcdn.com/w80/ba.png', away_flag: 'https://flagcdn.com/w80/qa.png', home_score: 0, away_score: 0, status: 'PENDING', time: '15:00' },
      { id: 103, home_team: 'Marruecos', away_team: 'Haití', home_flag: 'https://flagcdn.com/w80/ma.png', away_flag: 'https://flagcdn.com/w80/ht.png', home_score: 0, away_score: 0, status: 'PENDING', time: '18:00' },
      { id: 104, home_team: 'Escocia', away_team: 'Brasil', home_flag: 'https://flagcdn.com/w80/gb-sct.png', away_flag: 'https://flagcdn.com/w80/br.png', home_score: 0, away_score: 0, status: 'PENDING', time: '18:00' },
      { id: 105, home_team: 'Sudáfrica', away_team: 'Corea Sur', home_flag: 'https://flagcdn.com/w80/za.png', away_flag: 'https://flagcdn.com/w80/kr.png', home_score: 0, away_score: 0, status: 'PENDING', time: '21:00' },
      { id: 106, home_team: 'R. Checa', away_team: 'México', home_flag: 'https://flagcdn.com/w80/cz.png', away_flag: 'https://flagcdn.com/w80/mx.png', home_score: 0, away_score: 0, status: 'PENDING', time: '21:00' }
    ];
    setMatches(todayMatches);
  };

  const fetchPredictions = async () => {
    const { data } = await supabase.from('predictions').select('*');
    if (data) setPredictions(data);
  };

  const login = async (e) => {
    e.preventDefault();
    if (!nameInput) return;
    const formattedName = nameInput.trim();
    await supabase.from('users').upsert({ name: formattedName });
    localStorage.setItem('pollaUser', formattedName);
    setUser(formattedName);
  };

  const predict = async (matchId, home, away) => {
    await supabase.from('predictions').upsert({
      user_name: user,
      match_id: matchId,
      home_score: parseInt(home),
      away_score: parseInt(away)
    }, { onConflict: 'user_name, match_id' });
    fetchPredictions();
    alert('Apuesta guardada correctamente.');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200 w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Mundial Vargas</h1>
            <p className="text-slate-500 text-sm mt-2">Ingresa tu nombre para jugar.</p>
          </div>
          <input 
            type="text" placeholder="Tu nombre..." required
            className="w-full bg-slate-100 text-slate-900 px-5 py-4 rounded-xl mb-4 outline-none border border-slate-300 focus:border-blue-500 font-bold text-center"
            value={nameInput} onChange={(e) => setNameInput(e.target.value)}
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 uppercase tracking-widest">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  const pot = predictions.length * 3;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10">
      
      <header className="bg-white sticky top-0 z-50 p-4 border-b border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-black text-slate-900 uppercase">Mundial Vargas</h1>
          <p className="text-sm text-slate-500 mt-1">Hoy 24/06 | Jugador: <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{user}</span></p>
        </div>
        <div className="bg-slate-100 px-6 py-2 rounded-2xl border border-slate-200 text-center w-full md:w-auto">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Pozo Acumulado</p>
          <p className="text-2xl font-black text-slate-800">{pot} <span className="text-base">Bs</span></p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 mt-8">
        <h2 className="text-lg font-black text-slate-800 mb-6 border-l-4 border-blue-600 pl-3 uppercase tracking-widest">Partidos de Hoy</h2>
        
        <div className="grid gap-8 md:grid-cols-2">
          {matches.map(m => {
            const myP = predictions.find(p => p.match_id === m.id && p.user_name === user);
            const isFinished = m.status === 'FINISHED';
            const matchPredictions = predictions.filter(p => p.match_id === m.id);
            
            return (
              <div key={m.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative flex flex-col">
                <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[10px] font-bold px-4 py-1.5 rounded-bl-xl border-b border-l border-slate-200 uppercase tracking-widest">
                  {m.time}
                </div>
                {isFinished && <div className="absolute top-0 left-0 bg-slate-800 text-white text-[10px] font-bold px-4 py-1.5 rounded-br-xl uppercase tracking-widest">Finalizado</div>}

                <div className="flex justify-between items-center mt-6 mb-6">
                  <div className="flex flex-col items-center w-1/3">
                    <img src={m.home_flag} alt={m.home_team} className="w-16 h-12 object-cover rounded shadow-sm mb-3 border border-slate-200" />
                    <span className="font-bold text-sm text-slate-700 text-center uppercase tracking-wide">{m.home_team}</span>
                  </div>
                  
                  <div className="bg-slate-50 px-4 py-2 rounded-xl font-black text-2xl text-slate-800 border border-slate-200 shadow-inner">
                    {isFinished ? m.home_score : '-'} <span className="text-slate-400 mx-1">:</span> {isFinished ? m.away_score : '-'}
                  </div>

                  <div className="flex flex-col items-center w-1/3">
                    <img src={m.away_flag} alt={m.away_team} className="w-16 h-12 object-cover rounded shadow-sm mb-3 border border-slate-200" />
                    <span className="font-bold text-sm text-slate-700 text-center uppercase tracking-wide">{m.away_team}</span>
                  </div>
                </div>

                {!isFinished ? (
                  <form 
                    onSubmit={(e) => { e.preventDefault(); predict(m.id, e.target.home.value, e.target.away.value); }}
                    className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-200 mb-6"
                  >
                    <input type="number" name="home" min="0" required defaultValue={myP?.home_score} className="w-14 bg-white border border-slate-300 rounded-lg p-2 text-center text-lg font-black text-slate-800 outline-none focus:border-blue-500" />
                    <button type="submit" className="bg-blue-600 text-white font-black px-6 py-2.5 rounded-lg text-xs hover:bg-blue-700 shadow-md uppercase tracking-widest">
                      {myP ? 'Modificar' : 'Apostar'}
                    </button>
                    <input type="number" name="away" min="0" required defaultValue={myP?.away_score} className="w-14 bg-white border border-slate-300 rounded-lg p-2 text-center text-lg font-black text-slate-800 outline-none focus:border-blue-500" />
                  </form>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200 mb-6">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-widest">Tu predicción</p>
                    <p className="text-xl font-black text-blue-600">{myP?.home_score ?? '-'} : {myP?.away_score ?? '-'}</p>
                  </div>
                )}

                {/* TABLA DE PREDICCIONES DEL PARTIDO */}
                <div className="mt-auto border-t border-slate-100 pt-4">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Predicciones registradas</h3>
                  {matchPredictions.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto pr-1">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3 font-bold rounded-l-lg">Jugador</th>
                            <th className="py-2 px-3 font-bold text-center rounded-r-lg">Marcador</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {matchPredictions.map(p => (
                            <tr key={p.user_name} className={p.user_name === user ? 'bg-blue-50/50' : ''}>
                              <td className="py-2 px-3 text-slate-700 font-medium">{p.user_name}</td>
                              <td className="py-2 px-3 text-center font-bold text-blue-600">{p.home_score} : {p.away_score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">Aún no hay predicciones.</p>
                  )}
                </div>

              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}