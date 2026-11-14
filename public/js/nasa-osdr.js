(function () {
  const panelId = 'nasaOsdrPanel';

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function renderList(id, values, emptyText) {
    const list = document.getElementById(id);
    if (!list) return;
    list.replaceChildren();
    if (!values.length) {
      const item = document.createElement('span');
      item.className = 'text-slate-400';
      item.textContent = emptyText;
      list.appendChild(item);
      return;
    }
    values.forEach(function (value) {
      const item = document.createElement('span');
      item.className = 'inline-flex items-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-mono text-cyan-200';
      item.textContent = value;
      list.appendChild(item);
    });
  }

  async function loadNASAStudy() {
    const status = document.getElementById('nasaOsdrStatus');
    const refresh = document.getElementById('nasaOsdrRefresh');
    if (!document.getElementById(panelId)) return;

    if (status) {
      status.textContent = 'CONNECTING TO NASA OSDR...';
      status.className = 'text-xs font-mono text-amber-300';
    }
    if (refresh) refresh.disabled = true;

    try {
      const response = await fetch('/api/nasa/osd-575', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('NASA endpoint returned HTTP ' + response.status);
      const payload = await response.json();
      const study = payload && payload.data && payload.data.study &&
        payload.data.study['OSD-575'];
      const assays = study && study.additionalInformation &&
        study.additionalInformation.assays ? study.additionalInformation.assays : null;
      if (!assays) throw new Error('The OSD-575 response did not contain the expected assay metadata.');

      const entries = Object.entries(assays);
      const rows = entries.reduce(function (all, entry) {
        const raw = entry[1] && Array.isArray(entry[1].raw) ? entry[1].raw : [];
        return all.concat(raw);
      }, []);
      const sampleNames = Array.from(new Set(rows.map(function (row) {
        const key = Object.keys(row).find(function (name) {
          return /samplename/i.test(name);
        });
        return key && row[key] ? String(row[key]) : '';
      }).filter(Boolean)));
      const assayNames = Array.from(new Set(rows.map(function (row) {
        const key = Object.keys(row).find(function (name) {
          return /assayname/i.test(name);
        });
        return key && row[key] ? String(row[key]) : '';
      }).filter(Boolean)));
      const timepoints = Array.from(new Set(sampleNames.map(function (name) {
        const match = name.match(/_(L-\d+|R\+\d+)/i);
        return match ? match[1] : '';
      }).filter(Boolean)));

      setText('nasaOsdrAssayCount', String(entries.length));
      setText('nasaOsdrRecordCount', String(rows.length));
      setText('nasaOsdrSampleCount', String(sampleNames.length));
      renderList('nasaOsdrAssays', assayNames.slice(0, 8), 'Assay labels not available in this response');
      renderList('nasaOsdrTimepoints', timepoints.slice(0, 10), 'Time-point labels not available');
      setText('nasaOsdrRetrieved', payload.retrievedAt
        ? 'Retrieved ' + new Date(payload.retrievedAt).toLocaleString()
        : 'NASA metadata retrieved');

      if (status) {
        status.textContent = 'NASA OSDR CONNECTION VERIFIED';
        status.className = 'text-xs font-mono text-emerald-300';
      }
    } catch (error) {
      console.error('[ASTRA-MED] NASA OSDR panel:', error);
      if (status) {
        status.textContent = 'NASA DATA TEMPORARILY UNAVAILABLE';
        status.className = 'text-xs font-mono text-rose-300';
      }
      setText('nasaOsdrRetrieved', error.message || 'Unable to load NASA study metadata');
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  function initialize() {
    if (!document.getElementById(panelId)) return;
    const refresh = document.getElementById('nasaOsdrRefresh');
    if (refresh) refresh.addEventListener('click', loadNASAStudy);
    loadNASAStudy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();