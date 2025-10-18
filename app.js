(function(){
  const compareToggle = document.getElementById('compareToggle');
  const viewAggregatedToggle = document.getElementById('viewAggregatedToggle');
  const uploaderSingle = document.getElementById('uploaderSingle');
  const uploaderCompare = document.getElementById('uploaderCompare');
  const containerList = document.getElementById('containerList');
  const tablesWrapper = document.getElementById('tablesWrapper');
  const containerMeta = document.getElementById('containerMeta');
  const searchInput = document.getElementById('searchInput');
  const namesLoaded = document.getElementById('namesLoaded');
  const containersLoaded = document.getElementById('containersLoaded');
  const unknownItemsEl = document.getElementById('unknownItems');
  const unknownContainersEl = document.getElementById('unknownContainers');
  const downloadNamesBtn = document.getElementById('downloadNamesBtn');

  const state = {
    sets: { A: createEmptySet(), B: createEmptySet() },
    activeSet: 'A',
    compare: false,
    activeContainer: null,
    names: { items: {}, containers: {} },
    unknown: { items: new Set(), containers: new Set() }
  };

  function createEmptySet(){
    return {
      containers: new Map(),
      containerOrder: [],
    };
  }

  fetch('assets/names.json').then(r => r.ok ? r.json() : { items:{}, containers:{} }).catch(()=>({items:{},containers:{}})).then(n => {
    state.names = { items: n.items || {}, containers: n.containers || {} };
    updateNamesStatus();
  });

  for (const dz of document.querySelectorAll('.dropzone')){
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag');
      const target = dz.getAttribute('data-target');
      handleFiles(e.dataTransfer.files, target);
    });
    dz.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){
        dz.querySelector('input[type=file]').click();
      }
    })
  }
  document.getElementById('fileInputA').addEventListener('change', e => handleFiles(e.target.files, 'A'));
  const fiA = document.getElementById('fileInputA_compare'); if (fiA) fiA.addEventListener('change', e => handleFiles(e.target.files, 'A'));
  const fiB = document.getElementById('fileInputB_compare'); if (fiB) fiB.addEventListener('change', e => handleFiles(e.target.files, 'B'));

  compareToggle.addEventListener('change', () => {
    state.compare = compareToggle.checked;
    uploaderSingle.hidden = state.compare;
    uploaderCompare.hidden = !state.compare;
    render();
  });

  viewAggregatedToggle.addEventListener('change', () => renderTables());
  searchInput.addEventListener('input', () => renderTables());
  downloadNamesBtn.addEventListener('click', downloadUpdatedNames);

  function handleFiles(fileList, target){
    const files = Array.from(fileList || []);
    if (!files.length) return;
    Promise.all(files.map(readJsonFileSafe)).then(jsons => {
      for (const data of jsons){
        if (!data) continue;
        mergeDataIntoSet(state.sets[target], data);
      }
      const set = state.sets[target];
      if (!state.activeContainer){
        state.activeContainer = set.containerOrder[0] || null;
      }
      render();
    });
  }

  async function readJsonFileSafe(file){
    try{
      const text = await file.text();
      return JSON.parse(text);
    }catch(err){
      console.warn('Failed to parse JSON', file?.name, err);
      return null;
    }
  }

  function mergeDataIntoSet(set, json){
    for (const [container, body] of Object.entries(json || {})){
      if (!body || typeof body !== 'object') continue;
      const normContainer = normalizeContainer(container);
      if (!set.containers.has(normContainer)){
        set.containers.set(normContainer, { aggregated: [], combos: [] });
        set.containerOrder.push(normContainer);
      }
      const bucket = set.containers.get(normContainer);
      const probs = body.Probabilities || {};
      const amts = body.Amounts || {};
      for (const [key, chance] of Object.entries(probs)){
        const amounts = amts[key];
        if (!amounts) continue;
        const isCombo = key.includes(',');
        if (isCombo){
          const items = key.split(',').map(s => s.trim()).filter(Boolean);
          const combo = {
            key,
            items,
            chance: Number(chance),
            amounts: amounts.Min && amounts.Max ? { Min: amounts.Min, Max: amounts.Max } : null,
            conditions: amounts.Condition || null
          };
          bucket.combos.push(combo);
          items.forEach(short => ensureItemKnown(short));
        } else {
          const agg = {
            shortname: key,
            chance: Number(chance),
            amountMin: amounts.Min ?? null,
            amountMax: amounts.Max ?? null,
            minCondition: amounts.MinCondition ?? (amounts.Condition?.MinCondition ?? null),
            maxCondition: amounts.MaxCondition ?? (amounts.Condition?.MaxCondition ?? null)
          };
          bucket.aggregated.push(agg);
          ensureItemKnown(key);
        }
      }
    }
  }

  function normalizeItem(short){
    if (!short) return short;
    const name = state.names.items[short];
    if (!name){ state.unknown.items.add(short); }
    return name || short;
  }
  function normalizeContainer(short){
    if (!short) return short;
    const name = state.names.containers[short];
    if (!name){ state.unknown.containers.add(short); }
    return name || short;
  }
  function ensureItemKnown(short){
    if (!state.names.items[short]) state.unknown.items.add(short);
  }

  function updateNamesStatus(){
    namesLoaded.textContent = Object.keys(state.names.items).length.toString();
    containersLoaded.textContent = Object.keys(state.names.containers).length.toString();
    unknownItemsEl.textContent = state.unknown.items.size.toString();
    unknownContainersEl.textContent = state.unknown.containers.size.toString();
  }

  function render(){
    updateNamesStatus();
    renderContainers();
    renderTables();
  }

  function renderContainers(){
    const targetSet = state.compare ? state.sets.A : state.sets[state.activeSet];
    const containers = new Set();
    if (state.compare){
      state.sets.A.containerOrder.forEach(c => containers.add(c));
      state.sets.B.containerOrder.forEach(c => containers.add(c));
    } else {
      targetSet.containerOrder.forEach(c => containers.add(c));
    }
    const list = Array.from(containers);
    if (list.length && !state.activeContainer) state.activeContainer = list[0];
    containerList.innerHTML = '';
    list.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'container-btn' + (c === state.activeContainer ? ' active' : '');
      const img = document.createElement('img');
      img.alt = '';
      img.src = `assets/containers/${c}.png`;
      img.onerror = () => { img.style.display = 'none'; };
      const label = document.createElement('span');
      label.textContent = c;
      btn.appendChild(img);
      btn.appendChild(label);
      btn.addEventListener('click', () => {
        state.activeContainer = c;
        renderTables();
        // Update active styling
        document.querySelectorAll('.container-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
      containerList.appendChild(btn);
    });
  }

  function createTable(headers){
    const table = document.createElement('table');
    table.className = 'table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h.label;
      th.dataset.key = h.key;
      th.addEventListener('click', () => {
        const current = th.classList.contains('th-sort-asc') ? 'asc' : th.classList.contains('th-sort-desc') ? 'desc' : null;
        trh.querySelectorAll('th').forEach(t => t.classList.remove('th-sort-asc','th-sort-desc'));
        const next = current === 'asc' ? 'desc' : 'asc';
        th.classList.add(next === 'asc' ? 'th-sort-asc' : 'th-sort-desc');
        table.dispatchEvent(new CustomEvent('sort', { detail: { key: h.key, dir: next }}));
      });
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    return { table, tbody, headerRow: trh };
  }

  function renderTables(){
    updateNamesStatus();
    tablesWrapper.innerHTML = '';
    containerMeta.innerHTML = '';
    const cName = state.activeContainer;
    if (!cName){
      tablesWrapper.innerHTML = '<div class="small muted">Upload files to view tables.</div>';
      return;
    }

    const img = document.createElement('img');
    img.alt = '';
    img.src = `assets/containers/${cName}.png`;
    img.onerror = () => { img.style.display = 'none'; };
    const h = document.createElement('h3'); h.textContent = cName;
    containerMeta.appendChild(img); containerMeta.appendChild(h);

    const filterText = (searchInput.value || '').toLowerCase();
    const showAggregated = viewAggregatedToggle.checked;

    if (!state.compare){
      const set = state.sets[state.activeSet];
      const bucket = set.containers.get(cName);
      if (!bucket){ tablesWrapper.textContent = 'No data for this container.'; return; }
      const { table, tbody } = buildTableForBucket(bucket, showAggregated, filterText);
      tablesWrapper.appendChild(table);
    } else {
      const left = state.sets.A.containers.get(cName) || { aggregated: [], combos: [] };
      const right = state.sets.B.containers.get(cName) || { aggregated: [], combos: [] };

      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr 1fr';
      grid.style.gap = '12px';

      const aWrap = document.createElement('div');
      const aTitle = document.createElement('div'); aTitle.className = 'small muted'; aTitle.textContent = 'Set A';
      const aTbl = buildTableForBucket(left, showAggregated, filterText).table;
      aWrap.appendChild(aTitle); aWrap.appendChild(aTbl);

      const bWrap = document.createElement('div');
      const bTitle = document.createElement('div'); bTitle.className = 'small muted'; bTitle.textContent = 'Set B';
      const bTbl = buildTableForBucket(right, showAggregated, filterText).table;
      bWrap.appendChild(bTitle); bWrap.appendChild(bTbl);

      const aData = extractRowStats(left, showAggregated);
      const bData = extractRowStats(right, showAggregated);
      decorateDiffs(aTbl, aData, bData);
      decorateDiffs(bTbl, bData, aData);

      grid.appendChild(aWrap);
      grid.appendChild(bWrap);
      tablesWrapper.appendChild(grid);
    }
  }

  function extractRowStats(bucket, aggregated){
    const rows = new Map();
    if (aggregated){
      for (const it of bucket.aggregated){
        const name = normalizeItem(it.shortname);
        rows.set(name, it.chance);
      }
    } else {
      for (const cb of bucket.combos){
        const name = cb.items.map(normalizeItem).join(' + ');
        rows.set(name, cb.chance);
      }
    }
    return rows;
  }

  function decorateDiffs(table, selfMap, otherMap){
    const nameIdx = 0, chanceIdx = 2;
    for (const tr of table.querySelectorAll('tbody tr')){
      const name = tr.children[nameIdx]?.textContent?.trim();
      const chanceCell = tr.children[chanceIdx];
      if (!name || !chanceCell) continue;
      const a = selfMap.get(name);
      const b = otherMap.get(name);
      if (typeof a === 'number' && typeof b === 'number'){
        const diff = a - b;
        if (diff > 0.0001) chanceCell.classList.add('prob-up');
        else if (diff < -0.0001) chanceCell.classList.add('prob-down');
      }
    }
  }

  function buildTableForBucket(bucket, aggregated, filterText){
    const headers = [
      { key: 'name', label: 'Item Name' },
      { key: 'condition', label: 'Condition' },
      { key: 'chance', label: 'Chance (%)' },
      { key: 'amounts', label: 'Amounts' },
    ];
    const { table, tbody, headerRow } = createTable(headers);
    let rows = [];
    if (aggregated){
      const seen = new Set();
      rows = bucket.aggregated.filter(a => { if (seen.has(a.shortname)) return false; seen.add(a.shortname); return true; }).map(a => ({
        key: a.shortname,
        name: normalizeItem(a.shortname),
        icons: [a.shortname],
        condition: formatCond(a.minCondition, a.maxCondition),
        chance: a.chance,
        amounts: formatAmountRange(a.amountMin, a.amountMax)
      }));
    } else {
      const seen = new Set();
      rows = bucket.combos.filter(c => { if (seen.has(c.key)) return false; seen.add(c.key); return true; }).map(c => ({
        key: c.key,
        name: c.items.map(normalizeItem).join(' + '),
        icons: c.items.slice(),
        condition: formatComboCondition(c.conditions),
        chance: c.chance,
        amounts: formatComboAmounts(c.amounts)
      }));
    }

    if (filterText){
      const ft = filterText.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(ft));
    }

    rows.sort((a,b)=> b.chance - a.chance);

    for (const r of rows){
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      const nameCell = document.createElement('div'); nameCell.className = 'item-cell';
      const icons = document.createElement('div'); icons.className = 'item-icons';
      for (const short of r.icons){
        const img = document.createElement('img');
        img.alt = short;
        img.src = `assets/items/${short}.png`;
        img.onerror = () => { img.style.display = 'none'; };
        icons.appendChild(img);
      }
      const nameText = document.createElement('span'); nameText.textContent = r.name;
      nameCell.appendChild(icons); nameCell.appendChild(nameText);
      tdName.appendChild(nameCell);
      const tdCond = document.createElement('td'); tdCond.innerHTML = r.condition || '<span class="muted">—</span>';
      const tdChance = document.createElement('td'); tdChance.textContent = fmtNum(r.chance);
      const tdAmt = document.createElement('td'); tdAmt.innerHTML = r.amounts || '<span class="muted">—</span>';
      tr.appendChild(tdName); tr.appendChild(tdCond); tr.appendChild(tdChance); tr.appendChild(tdAmt);
      tbody.appendChild(tr);
    }

    table.addEventListener('sort', ev => {
      const { key, dir } = ev.detail;
      const idx = headers.findIndex(h => h.key === key);
      const rowsArr = Array.from(tbody.querySelectorAll('tr'));
      rowsArr.sort((ra, rb) => {
        const a = ra.children[idx].textContent.trim();
        const b = rb.children[idx].textContent.trim();
        let cmp = 0;
        if (key === 'chance') cmp = (parseFloat(a)||0) - (parseFloat(b)||0);
        else cmp = a.localeCompare(b, undefined, { sensitivity:'base', numeric:true });
        return dir === 'asc' ? cmp : -cmp;
      });
      tbody.innerHTML = '';
      rowsArr.forEach(r => tbody.appendChild(r));
    });

    return { table, tbody };
  }

  function formatCond(min, max){
    const hasMin = min !== null && min !== undefined;
    const hasMax = max !== null && max !== undefined;
    if (!hasMin && !hasMax) return '';
    const m1 = hasMin ? fmtNum(min) : '—';
    const m2 = hasMax ? fmtNum(max) : '—';
    return `${m1} – ${m2}`;
  }

  function formatComboCondition(cond){
    if (!cond || typeof cond !== 'object') return '';
    // Show min–max for items that have any condition bounds
    const parts = [];
    for (const [short, v] of Object.entries(cond)){
      const m = formatCond(v?.MinCondition ?? null, v?.MaxCondition ?? null);
      if (m) parts.push(`${normalizeItem(short)}: ${m}`);
    }
    return parts.join('<br/>');
  }

  function formatComboAmounts(amts){
    if (!amts || typeof amts !== 'object') return '';
    const min = amts.Min || {}; const max = amts.Max || {};
    const items = new Set([...Object.keys(min), ...Object.keys(max)]);
    const parts = [];
    for (const s of items){
      const a = min[s], b = max[s];
      if (a == null && b == null) continue;
      const m1 = a == null ? '—' : fmtNum(a);
      const m2 = b == null ? '—' : fmtNum(b);
      parts.push(`${normalizeItem(s)}: ${m1} – ${m2}`);
    }
    return parts.join('<br/>');
  }

  function formatAmountRange(min, max){
    if (min == null && max == null) return '';
    if (min == null) return `≤ ${fmtNum(max)}`;
    if (max == null) return `≥ ${fmtNum(min)}`;
    return `${fmtNum(min)} – ${fmtNum(max)}`;
  }

  function fmtNum(n){
    if (typeof n !== 'number' || Number.isNaN(n)) return '0';
    return (Math.round(n * 1000) / 1000).toString();
  }

  function downloadUpdatedNames(){
    // Merge existing names with unknowns as identity mappings
    const items = { ...state.names.items };
    const containers = { ...state.names.containers };
    for (const s of state.unknown.items){ if (!items[s]) items[s] = s; }
    for (const s of state.unknown.containers){ if (!containers[s]) containers[s] = s; }
    const blob = new Blob([JSON.stringify({ items, containers }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'names.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
})();
