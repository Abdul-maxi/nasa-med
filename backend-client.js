/* ASTRA-MED REST + SSE backend connector. Load before the app module. */
window.ASTRA_MED_BACKEND = (() => {
  const base = `${location.protocol}//${location.host}`;
  let eventSource = null;
  async function request(path, options={}) {
    const r = await fetch(`${base}${path}`, {headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    if(!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.status===204 ? null : r.json();
  }
  const api={
    health:()=>request('/api/health'),
    getCrew:()=>request('/api/crew'),
    getCrewMember:id=>request(`/api/crew/${encodeURIComponent(id)}`),
    updateCrew:(id,data)=>request(`/api/crew/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(data)}),
    reset:()=>request('/api/crew/reset',{method:'POST'}),
    getMission:()=>request('/api/mission-control'),
    updateMission:data=>request('/api/mission-control',{method:'PUT',body:JSON.stringify(data)}),
    addLog:entry=>request('/api/logs',{method:'POST',body:JSON.stringify(entry)}),
    subscribe:(handlers={})=>{
      if(eventSource) eventSource.close();
      eventSource=new EventSource(`${base}/api/events`);
      eventSource.addEventListener('state.initial',e=>handlers.initial?.(JSON.parse(e.data)));
      eventSource.addEventListener('crew.updated',e=>handlers.crew?.(JSON.parse(e.data)));
      eventSource.addEventListener('mission.updated',e=>handlers.mission?.(JSON.parse(e.data)));
      eventSource.addEventListener('state.reset',e=>handlers.reset?.(JSON.parse(e.data)));
      eventSource.onerror=()=>handlers.error?.();
      return ()=>eventSource?.close();
    }
  };
  return api;
})();
