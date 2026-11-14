/*
 * ASTRA-MED FRONTEND BACKEND MODULE
 * Drop-in replacement for the Firebase backend block in the supplied frontend.
 * It keeps the frontend's existing state/function names while using the Node API.
 */

const API_BASE = window.ASTRA_MED_API_BASE || '';
let backendEventSource = null;
let backendInitialized = false;
let backendWriteInFlight = false;

async function backendRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Backend request failed: HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

function updateBackendStatusUI(text, connected) {
  const headerText = document.getElementById('cloudSyncHeaderText');
  const pill = document.getElementById('backendStatusPill');
  if (headerText) headerText.textContent = text;
  if (pill) pill.textContent = connected ? 'ONLINE • REAL-TIME SYNC' : 'EDGE BUFFER • LOCAL MODE';
}

function getCurrentCrew() {
  return crewData.find(c => c.id === selectedCrewId) || crewData[0] || null;
}

function getCrewDisplayName(crew) {
  if (!crew) return 'UNKNOWN CREW';
  return isAnonymizedView ? (crew.anonId || crew.anonInitials || 'REDACTED') : crew.name;
}

function mergeCrewMember(remote) {
  if (!remote || !remote.id) return;
  const index = crewData.findIndex(c => c.id === remote.id);
  if (index === -1) {
    crewData.push(remote);
  } else {
    crewData[index] = { ...crewData[index], ...remote };
  }
}

function applyRemoteMissionState(state) {
  if (!state) return;

  if (state.activeAnomaly !== undefined) {
    activeAnomaly = state.activeAnomaly;
    const banner = document.getElementById('anomalyBanner');
    if (banner) {
      if (activeAnomaly) {
        const title = document.getElementById('anomalyTitle');
        const desc = document.getElementById('anomalyDesc');
        if (title) title.textContent = activeAnomaly.bannerTitle || activeAnomaly.title || 'ACTIVE ANOMALY';
        if (desc) desc.textContent = activeAnomaly.desc || '';
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  if (state.sessionKeyId && typeof sessionKeyId !== 'undefined') {
    sessionKeyId = state.sessionKeyId;
    const keyWidget = document.getElementById('widgetSessionKey');
    const keyModal = document.getElementById('modalSessionKey');
    if (keyWidget) keyWidget.textContent = sessionKeyId;
    if (keyModal) keyModal.textContent = sessionKeyId;
  }

  if (typeof state.isAnonymizedView === 'boolean' && typeof isAnonymizedView !== 'undefined') {
    isAnonymizedView = state.isAnonymizedView;
    if (typeof updatePrivacyToggleUI === 'function') updatePrivacyToggleUI();
  }

  if (state.selectedCrewId && crewData.some(c => c.id === state.selectedCrewId)) {
    selectedCrewId = state.selectedCrewId;
  }

  if (Array.isArray(state.recentLogs)) {
    window._syncedLogsCache = state.recentLogs;
    if (typeof renderSyncedLogs === 'function') renderSyncedLogs(state.recentLogs);
  }

  if (typeof renderAll === 'function') renderAll();
}

function subscribeToTelemetryBackend() {
  if (backendEventSource) backendEventSource.close();

  backendEventSource = new EventSource(`${API_BASE}/api/events`);
  backendEventSource.addEventListener('state.initial', event => {
    const state = JSON.parse(event.data);
    if (Array.isArray(state.crew)) {
      crewData = state.crew;
      const count = document.getElementById('backendDocCount');
      if (count) count.textContent = `${crewData.length} / ${crewData.length} SYNCED`;
    }
    applyRemoteMissionState(state.mission);
    updateBackendStatusUI('CLOUD SYNC: LIVE', true);
  });

  backendEventSource.addEventListener('crew.updated', event => {
    mergeCrewMember(JSON.parse(event.data));
    const count = document.getElementById('backendDocCount');
    if (count) count.textContent = `${crewData.length} / ${crewData.length} SYNCED`;
    if (typeof renderAll === 'function') renderAll();
  });

  backendEventSource.addEventListener('mission.updated', event => {
    applyRemoteMissionState(JSON.parse(event.data));
  });

  backendEventSource.addEventListener('state.reset', event => {
    const state = JSON.parse(event.data);
    if (Array.isArray(state.crew)) crewData = state.crew;
    applyRemoteMissionState(state.mission);
    if (typeof renderAll === 'function') renderAll();
  });

  backendEventSource.onerror = () => {
    updateBackendStatusUI('EDGE BUFFER • RECONNECTING', false);
  };
}

async function initCloudBackend() {
  try {
    const health = await backendRequest('/api/health');
    backendInitialized = !!health.ok;
    updateBackendStatusUI('CLOUD SYNC: LIVE', true);

    const crewResponse = await backendRequest('/api/crew');
    if (Array.isArray(crewResponse.crew) && crewResponse.crew.length) {
      crewData = crewResponse.crew;
    }

    const mission = await backendRequest('/api/mission-control');
    applyRemoteMissionState(mission);
    subscribeToTelemetryBackend();

    const uidEl = document.getElementById('backendOperatorUid');
    if (uidEl) uidEl.textContent = `REST-SESSION-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    if (typeof renderAll === 'function') renderAll();
  } catch (error) {
    backendInitialized = false;
    updateBackendStatusUI('EDGE BUFFER • LOCAL MODE', false);
    console.warn('[ASTRA-MED] Backend unavailable; using local state.', error);
  }
}

async function syncCrewMemberToBackend(member) {
  if (!member || !backendInitialized) return;
  try {
    await backendRequest(`/api/crew/${encodeURIComponent(member.id)}`, {
      method: 'PUT',
      body: JSON.stringify(member)
    });
    const lastSync = document.getElementById('backendLastSync');
    if (lastSync) lastSync.textContent = new Date().toISOString().substring(11, 19) + ' UTC';
  } catch (error) {
    console.warn('[ASTRA-MED] Crew sync failed; local state retained.', error);
  }
}

async function syncMissionControlToBackend(extraLogEntry = null) {
  if (!backendInitialized) return;

  try {
    const payload = {
      activeAnomaly: activeAnomaly || null,
      sessionKeyId: typeof sessionKeyId !== 'undefined' ? sessionKeyId : 'SDLS-K256-09F4A',
      isAnonymizedView: typeof isAnonymizedView !== 'undefined' ? isAnonymizedView : false,
      selectedCrewId,
      recentLogs: window._syncedLogsCache || []
    };

    if (extraLogEntry) {
      payload.recentLogs = [extraLogEntry, ...payload.recentLogs].slice(0, 18);
      window._syncedLogsCache = payload.recentLogs;
    }

    await backendRequest('/api/mission-control', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.warn('[ASTRA-MED] Mission-control sync failed; local state retained.', error);
  }
}

async function pushFullStateToBackend(notify = false) {
  if (!backendInitialized || backendWriteInFlight) return;
  backendWriteInFlight = true;
  try {
    for (const member of crewData) await syncCrewMemberToBackend(member);
    await syncMissionControlToBackend();
    if (notify && typeof addLog === 'function') {
      addLog('BACKEND SYNC: Pushed full Artemis-IV crew telemetry & mission state to server.', 'success');
    }
  } finally {
    backendWriteInFlight = false;
  }
  if (typeof updateBackendJsonPreview === 'function') updateBackendJsonPreview();
}

async function resetBackendDatabase() {
  try {
    const response = await backendRequest('/api/crew/reset', { method: 'POST' });
    if (response?.state) {
      crewData = response.state.crew;
      applyRemoteMissionState(response.state.mission);
    }
    if (typeof addLog === 'function') addLog('BACKEND RESET: Restored all 4 crewmembers & global state to nominal baseline.', 'warn');
    if (typeof renderAll === 'function') renderAll();
  } catch (error) {
    console.warn('[ASTRA-MED] Backend reset failed.', error);
  }
}

function updateBackendJsonPreview() {
  const previewEl = document.getElementById('backendJsonPreview');
  if (!previewEl) return;
  const c = getCurrentCrew();
  if (!c) return;
  const payload = {
    endpoint: `/api/crew/${c.id}`,
    transport: 'REST + Server-Sent Events',
    subject: typeof isAnonymizedView !== 'undefined' && isAnonymizedView ? c.anonId : c.name,
    status: c.status,
    vitals: {
      heartRateBpm: Math.round(c.hr),
      spO2Pct: c.spo2,
      respirationBrpm: Math.round(c.resp),
      coreTempC: c.temp,
      hydrationPct: Math.round(c.hydration),
      radiationTotalMsv: c.radTotal
    },
    countermeasures: c.countermeasures
  };
  previewEl.textContent = JSON.stringify(payload, null, 2);
}

// Optional hooks for the rest of the supplied frontend.
const originalAddLog = typeof addLog === 'function' ? addLog : null;
if (typeof window !== 'undefined') {
  window.switchFrontendView = typeof switchFrontendView === 'function' ? switchFrontendView : undefined;
  window.pushFullStateToBackend = pushFullStateToBackend;
  window.resetBackendDatabase = resetBackendDatabase;
}
