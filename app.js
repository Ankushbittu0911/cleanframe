'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { original: null, edited: null, optimize: null, report: null, objectUrls: [] };
  const MAX_SCAN_BYTES = 4 * 1024 * 1024;
  const bytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = (message) => { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('show'), 2800); };
  const makeUrl = (file) => { const url = URL.createObjectURL(file); state.objectUrls.push(url); return url; };
  $('year').textContent = new Date().getFullYear();
  $('theme').addEventListener('click', () => document.body.classList.toggle('dark'));

  function attachPicker(inputId, dropId, role) {
    const input = $(inputId), drop = $(dropId);
    input.addEventListener('change', () => { if (input.files && input.files[0]) setFile(role, input.files[0]); });
    drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('over'); const file = [...(event.dataTransfer?.files || [])].find(f => f.type.startsWith('image/')); if (file) setFile(role, file); else toast('Please drop a supported image file.'); });
  }
  attachPicker('originalFile', 'originalDrop', 'original');
  attachPicker('editedFile', 'editedDrop', 'edited');
  attachPicker('optFile', 'optDrop', 'optimize');

  function setFile(role, file) {
    if (!file.type.startsWith('image/')) { toast('Please choose an image file.'); return; }
    state[role] = file;
    if (role === 'original' || role === 'edited') {
      $(role + 'Chip').classList.remove('hidden');
      $(role + 'Name').textContent = `${file.name} · ${bytes(file.size)}`;
      $(role + 'Prompt').textContent = 'Replace image';
      $('analyzeBtn').disabled = !(state.original || state.edited);
      $('analysis').classList.add('hidden');
      if (state.original && state.edited) $('analyzeBtn').textContent = 'Compare both images →';
      else $('analyzeBtn').textContent = 'Analyze image signals →';
    } else {
      $('optPrompt').textContent = 'Choose a different image';
      $('optPreviewWrap').classList.remove('hidden');
      $('optPreview').src = makeUrl(file);
      $('optFileName').textContent = file.name;
      $('optOriginalInfo').textContent = bytes(file.size);
      $('exportBtn').disabled = true;
      $('exportResult').classList.add('hidden');
      const img = new Image();
      img.onload = () => { $('width').value = img.naturalWidth; $('height').value = img.naturalHeight; $('exportBtn').disabled = false; };
      img.onerror = () => toast('This image format cannot be opened by this browser.');
      img.src = $('optPreview').src;
    }
  }
  document.querySelectorAll('[data-clear]').forEach(button => button.addEventListener('click', () => {
    const role = button.dataset.clear; state[role] = null; $(role + 'Chip').classList.add('hidden'); $(role + 'Prompt').textContent = role === 'original' ? 'Choose original image' : 'Choose edited image'; $(role + 'File').value = ''; $('analysis').classList.add('hidden'); $('analyzeBtn').disabled = !(state.original || state.edited); $('analyzeBtn').textContent = state.original && state.edited ? 'Compare both images →' : 'Analyze image signals →';
  }));

  async function inspectFile(file) {
    const head = await file.slice(0, Math.min(file.size, MAX_SCAN_BYTES)).arrayBuffer();
    const tail = file.size > MAX_SCAN_BYTES ? await file.slice(Math.max(MAX_SCAN_BYTES, file.size - 1024 * 1024)).arrayBuffer() : new ArrayBuffer(0);
    const decoder = new TextDecoder('latin1');
    const content = decoder.decode(head) + decoder.decode(tail);
    const has = (regex) => regex.test(content);
    const marker = {
      exif: has(/Exif\x00\x00|II\x2A\x00|MM\x00\x2A/),
      xmp: has(/http:\/\/ns\.adobe\.com\/xap\/1\.0|xmpmeta|XML:com\.adobe\.xmp/i),
      iptc: has(/Photoshop 3\.0|IPTC|8BIM/i),
      c2pa: has(/c2pa|jumbf|application\/c2pa/i),
      aiText: has(/trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia|digitalSourceType|generative fill|made with ai|ai[- ]generated|openai|midjourney|stable diffusion|adobe firefly|canva/i),
    };
    const softwareMatches = [...new Set((content.match(/(?:Adobe Photoshop|Adobe Firefly|Canva|ChatGPT|OpenAI|Google Gemini|Gemini|Midjourney|Stable Diffusion)[^\x00\r\n]{0,45}/gi) || []).map(s => s.trim().slice(0, 70)))].slice(0, 5);
    let dimensions = null;
    try { const url = URL.createObjectURL(file); dimensions = await new Promise(resolve => { const image = new Image(); image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }); }; image.onerror = () => { URL.revokeObjectURL(url); resolve(null); }; image.src = url; }); } catch { dimensions = null; }
    return {
      name: file.name, size: file.size, type: file.type || 'Unknown', lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      dimensions, markers: marker, softwareMatches, scanNote: `Scanned up to ${bytes(Math.min(file.size, MAX_SCAN_BYTES))} at the start${tail.byteLength ? ' and up to 1 MB at the end' : ''} of the file.`
    };
  }

  function statusLine(label, found, positiveText, negativeText) {
    return `<div class="signal-row"><span>${safe(label)}</span><span class="status ${found ? 'status-found' : 'status-none'}"><i></i>${safe(found ? positiveText : negativeText)}</span></div>`;
  }
  function signalCard(title, kicker, body, tone = 'neutral') {
    return `<article class="signal-card ${tone}"><div class="card-kicker">${safe(kicker)}</div><h4>${safe(title)}</h4><p>${safe(body)}</p></article>`;
  }
  function makeGuidance(record, workflow, editor, both) {
    const flags = Object.values(record.markers).filter(Boolean).length;
    let title, body;
    if (workflow === 'camera-ai') {
      title = flags ? 'Some file-level signals were found' : 'No listed marker was found in the scanned portions';
      body = 'Because this started as a real camera photo, compare the original and edited files. An editor may rewrite metadata during export. A marker scan cannot decide whether the visible content is authentic or AI-generated.';
    } else if (workflow === 'ai-generated') {
      title = 'Treat the image as AI-generated';
      body = 'A scan that finds no marker does not change how the image was created. Keep the creation context and use the platform disclosure controls where required.';
    } else if (workflow === 'mixed') {
      title = 'Mixed-origin content needs context';
      body = 'A file may contain both camera-captured and generated elements. File metadata alone cannot reliably describe which parts were changed.';
    } else {
      title = flags ? 'Some file-level signals were found' : 'No listed marker was found in the scanned portions';
      body = 'These results describe detectable file signals only. They cannot establish the full editing history or predict a platform label.';
    }
    const editorLine = editor && editor !== 'Not sure' ? `Tool selected: ${editor}. This is user-provided context, not a tool verified by the scan.` : 'The selected editing tool is not verified by the scan.';
    return `<div class="guidance-card"><div class="eyebrow">INTERPRETATION</div><h4>${safe(title)}</h4><p>${safe(body)}</p><small>${safe(editorLine)}</small>${both ? '<p class="guidance-extra">Use the side-by-side report below to see whether the detectable markers differ between the original and edited file.</p>' : ''}</div>`;
  }

  $('analyzeBtn').addEventListener('click', async () => {
    if (!state.original && !state.edited) return;
    const button = $('analyzeBtn'); button.disabled = true; button.textContent = 'Scanning locally…';
    try {
      const [original, edited] = await Promise.all([state.original ? inspectFile(state.original) : null, state.edited ? inspectFile(state.edited) : null]);
      const current = edited || original;
      const workflow = $('workflow').value, editor = $('editor').value;
      state.report = { product: 'CleanFrame', reportVersion: 2, createdAt: new Date().toISOString(), workflow, selectedEditor: editor, original, edited, interpretation: 'Best-effort marker scan only. Not a forensic examination or cryptographic C2PA validation.' };
      $('scanSummary').textContent = `${original && edited ? 'Both files scanned locally.' : 'One file scanned locally.'} ${current.scanNote}`;
      const markers = current.markers;
      $('reportGrid').innerHTML = [
        signalCard(markers.c2pa ? 'C2PA / JUMBF marker found' : 'No C2PA / JUMBF marker detected', 'CONTENT CREDENTIALS', markers.c2pa ? 'A matching marker was found in the scanned bytes. This does not validate the manifest or its issuer.' : 'No matching marker was found in the portions scanned. Credentials could still be stored elsewhere or encoded in an unrecognised way.', markers.c2pa ? 'tone-amber' : 'tone-neutral'),
        signalCard(markers.aiText ? 'Possible AI-related text found' : 'No listed AI-related text found', 'AI-RELATED METADATA TEXT', markers.aiText ? 'A text pattern associated with AI tools or source-type metadata was found. It is not proof that the whole image is AI-generated.' : 'No matching text pattern was found. Binary or pixel-embedded signals may not be visible to this scan.', markers.aiText ? 'tone-amber' : 'tone-neutral'),
        signalCard(markers.exif || markers.xmp || markers.iptc ? 'Common metadata marker(s) found' : 'No common metadata marker detected', 'IMAGE METADATA', `EXIF: ${markers.exif ? 'possible marker' : 'not detected'} · XMP: ${markers.xmp ? 'possible marker' : 'not detected'} · IPTC/Photoshop: ${markers.iptc ? 'possible marker' : 'not detected'}.`, 'tone-neutral'),
        signalCard('SynthID not checked', 'INVISIBLE WATERMARK', 'This browser app cannot reliably detect, verify or remove SynthID or other invisible pixel-embedded watermarks.', 'tone-blue')
      ].join('');
      if (original && edited) {
        $('comparePanel').classList.remove('hidden');
        $('compareRows').innerHTML = compareTable(original, edited);
      } else $('comparePanel').classList.add('hidden');
      $('guidance').innerHTML = makeGuidance(current, workflow, editor, Boolean(original && edited));
      $('analysis').classList.remove('hidden');
      $('analysis').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { toast(`Could not complete scan: ${error.message}`); }
    finally { button.disabled = false; button.textContent = state.original && state.edited ? 'Compare both images →' : 'Analyze image signals →'; }
  });

  function compareTable(a, b) {
    const rows = [
      ['File size', bytes(a.size), bytes(b.size)],
      ['Dimensions', a.dimensions ? `${a.dimensions.width} × ${a.dimensions.height}` : 'Unavailable', b.dimensions ? `${b.dimensions.width} × ${b.dimensions.height}` : 'Unavailable'],
      ['EXIF marker', a.markers.exif ? 'Possible marker' : 'Not detected', b.markers.exif ? 'Possible marker' : 'Not detected'],
      ['XMP marker', a.markers.xmp ? 'Possible marker' : 'Not detected', b.markers.xmp ? 'Possible marker' : 'Not detected'],
      ['IPTC / Photoshop marker', a.markers.iptc ? 'Possible marker' : 'Not detected', b.markers.iptc ? 'Possible marker' : 'Not detected'],
      ['C2PA / JUMBF marker', a.markers.c2pa ? 'Possible marker' : 'Not detected', b.markers.c2pa ? 'Possible marker' : 'Not detected'],
      ['AI-related text pattern', a.markers.aiText ? 'Possible match' : 'No match', b.markers.aiText ? 'Possible match' : 'No match'],
      ['Software strings', a.softwareMatches.join(', ') || 'None found', b.softwareMatches.join(', ') || 'None found']
    ];
    return `<div class="compare-table"><div class="compare-row compare-labels"><b>Signal</b><b>Original</b><b>Edited</b></div>${rows.map(row => `<div class="compare-row"><span>${safe(row[0])}</span><span>${safe(row[1])}</span><span>${safe(row[2])}</span></div>`).join('')}</div><p class="compare-footnote">Differences can result from ordinary export settings, file conversion, or editing software. A difference alone does not identify which tool made the change.</p>`;
  }

  $('downloadReport').addEventListener('click', () => {
    if (!state.report) return;
    downloadBlob(new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' }), 'cleanframe-analysis-report.json');
  });
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }

  $('quality').addEventListener('input', () => $('qualityValue').textContent = `${$('quality').value}%`);
  let originalRatio = 1;
  $('width').addEventListener('input', () => { if ($('aspectLock').checked && state.optimize) $('height').value = Math.max(1, Math.round(Number($('width').value) / originalRatio)); });
  $('height').addEventListener('input', () => { if ($('aspectLock').checked && state.optimize) $('width').value = Math.max(1, Math.round(Number($('height').value) * originalRatio)); });
  $('optPreview').addEventListener('load', () => { originalRatio = $('optPreview').naturalWidth / $('optPreview').naturalHeight || 1; });

  $('exportBtn').addEventListener('click', async () => {
    const file = state.optimize; if (!file) return;
    const button = $('exportBtn'); button.disabled = true; button.textContent = 'Processing locally…';
    try {
      const width = Number($('width').value), height = Number($('height').value), type = $('format').value, quality = Number($('quality').value) / 100;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12000 || height > 12000) throw new Error('Enter width and height from 1 to 12,000 pixels.');
      const image = new Image(); image.src = makeUrl(file); await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { alpha: type !== 'image/jpeg' });
      if (type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); }
      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('This format is not supported by your browser.')), type, quality));
      const extension = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
      const name = file.name.replace(/\.[^.]+$/, '') + `-optimized.${extension}`;
      const reduction = Math.round((1 - blob.size / file.size) * 100);
      $('exportResult').innerHTML = `<b>Optimized copy ready</b><span>${width} × ${height}px · ${bytes(blob.size)} · ${reduction >= 0 ? `${reduction}% smaller` : `${Math.abs(reduction)}% larger`}</span><button id="downloadOptimized" class="download-link">Download optimized copy ↓</button>`;
      $('exportResult').classList.remove('hidden');
      $('downloadOptimized').addEventListener('click', () => downloadBlob(blob, name));
      toast('Optimized copy created on this device.');
    } catch (error) { toast(error.message || 'Export failed.'); }
    finally { button.disabled = false; button.textContent = 'Export optimized copy ↗'; }
  });
  window.addEventListener('beforeunload', () => state.objectUrls.forEach(url => URL.revokeObjectURL(url)));
})();
